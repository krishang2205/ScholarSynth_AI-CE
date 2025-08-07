/**
 * Enterprise-Grade Authentication Service
 * Handles user registration, login, session management, and security
 */

export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  createdAt: string;
  lastLogin: string | null;
  isActive: boolean;
  profileData?: {
    institution?: string;
    researchField?: string;
    avatar?: string;
  };
}

export interface AuthSession {
  userId: string;
  email: string;
  name: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    profileData?: any;
  };
  session?: AuthSession;
  error?: string;
  errorCode?: string;
}

class AuthenticationService {
  private readonly DB_NAME = 'ScholarSynth_Auth';
  private readonly DB_VERSION = 2;
  private readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  private db: IDBDatabase | null = null;
  private currentSession: AuthSession | null = null;

  /**
   * Initialize the authentication database
   */
  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(new Error('Failed to open authentication database'));
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Users table
        if (!db.objectStoreNames.contains('users')) {
          const usersStore = db.createObjectStore('users', { keyPath: 'id' });
          usersStore.createIndex('email', 'email', { unique: true });
          usersStore.createIndex('isActive', 'isActive', { unique: false });
        }

        // Sessions table
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionsStore = db.createObjectStore('sessions', { keyPath: 'token' });
          sessionsStore.createIndex('userId', 'userId', { unique: false });
          sessionsStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        // Login attempts tracking (for security)
        if (!db.objectStoreNames.contains('loginAttempts')) {
          const attemptsStore = db.createObjectStore('loginAttempts', { keyPath: 'email' });
          attemptsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Generate secure random ID
   */
  private generateId(): string {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Generate secure session token
   */
  private generateSessionToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hash password with salt using Web Crypto API
   */
  private async hashPassword(password: string): Promise<string> {
    const salt = 'scholar_synth_ai_salt_2024';
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate email format
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/(?=.*\d)/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    return { valid: true };
  }

  /**
   * Check login attempts for rate limiting
   */
  private async checkLoginAttempts(email: string): Promise<{ allowed: boolean; remainingTime?: number }> {
    if (!this.db) await this.initDB();

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['loginAttempts'], 'readonly');
      const store = transaction.objectStore('loginAttempts');
      const request = store.get(email);

      request.onsuccess = () => {
        const record = request.result;
        if (!record) {
          resolve({ allowed: true });
          return;
        }

        const now = Date.now();
        const timeSinceLastAttempt = now - record.timestamp;

        if (record.attempts >= this.MAX_LOGIN_ATTEMPTS) {
          if (timeSinceLastAttempt < this.LOCKOUT_DURATION) {
            const remainingTime = this.LOCKOUT_DURATION - timeSinceLastAttempt;
            resolve({ allowed: false, remainingTime });
            return;
          }
        }

        resolve({ allowed: true });
      };

      request.onerror = () => resolve({ allowed: true });
    });
  }

  /**
   * Record login attempt
   */
  private async recordLoginAttempt(email: string, success: boolean): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['loginAttempts'], 'readwrite');
      const store = transaction.objectStore('loginAttempts');
      const getRequest = store.get(email);

      getRequest.onsuccess = () => {
        const record = getRequest.result || { email, attempts: 0, timestamp: 0 };
        
        if (success) {
          // Clear attempts on successful login
          store.delete(email);
        } else {
          // Increment failed attempts
          record.attempts = (record.attempts || 0) + 1;
          record.timestamp = Date.now();
          store.put(record);
        }
        resolve();
      };

      getRequest.onerror = () => resolve();
    });
  }

  /**
   * Register a new user
   */
  async register(email: string, password: string, name: string): Promise<AuthResult> {
    try {
      if (!this.db) await this.initDB();

      // Validate inputs
      if (!email || !password || !name) {
        return { success: false, error: 'All fields are required', errorCode: 'MISSING_FIELDS' };
      }

      email = email.trim().toLowerCase();
      name = name.trim();

      if (!this.validateEmail(email)) {
        return { success: false, error: 'Please enter a valid email address', errorCode: 'INVALID_EMAIL' };
      }

      const passwordValidation = this.validatePassword(password);
      if (!passwordValidation.valid) {
        return { success: false, error: passwordValidation.message, errorCode: 'WEAK_PASSWORD' };
      }

      if (name.length < 2) {
        return { success: false, error: 'Name must be at least 2 characters long', errorCode: 'INVALID_NAME' };
      }

      // Check if user already exists
      console.log('Checking for existing user with email:', email);
      const existingUser = await this.getUserByEmail(email);
      console.log('Existing user found:', existingUser ? 'Yes' : 'No');
      
      if (existingUser) {
        return { 
          success: false, 
          error: 'You already have an account with this email. Please login instead.', 
          errorCode: 'EMAIL_EXISTS' 
        };
      }

      // Create new user
      const hashedPassword = await this.hashPassword(password);
      const userId = this.generateId();
      const now = new Date().toISOString();

      const user: User = {
        id: userId,
        email,
        name,
        password: hashedPassword,
        createdAt: now,
        lastLogin: null,
        isActive: true,
        profileData: {}
      };

      console.log('Creating new user:', { id: userId, email, name });

      // Save user to database
      await this.saveUser(user);

      // Verify user was saved
      const savedUser = await this.getUserByEmail(email);
      if (!savedUser) {
        throw new Error('Failed to save user to database');
      }

      console.log('User successfully created and verified');

      // Create session
      const session = await this.createSession(user);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profileData: user.profileData
        },
        session
      };

    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Registration failed. Please try again.', errorCode: 'REGISTRATION_ERROR' };
    }
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      if (!this.db) await this.initDB();

      email = email.trim().toLowerCase();

      // Check rate limiting
      const attemptCheck = await this.checkLoginAttempts(email);
      if (!attemptCheck.allowed) {
        const minutes = Math.ceil((attemptCheck.remainingTime || 0) / (1000 * 60));
        return { 
          success: false, 
          error: `Too many failed login attempts. Please try again in ${minutes} minute(s).`, 
          errorCode: 'RATE_LIMITED' 
        };
      }

      // Validate inputs
      if (!email || !password) {
        return { success: false, error: 'Email and password are required', errorCode: 'MISSING_CREDENTIALS' };
      }

      // Get user
      console.log('Attempting login for email:', email);
      const user = await this.getUserByEmail(email);
      console.log('User found:', user ? 'Yes' : 'No');
      
      if (!user) {
        await this.recordLoginAttempt(email, false);
        return { 
          success: false, 
          error: 'No account found with this email. Please sign up first.', 
          errorCode: 'ACCOUNT_NOT_FOUND' 
        };
      }

      if (!user.isActive) {
        return { success: false, error: 'Your account has been deactivated. Please contact support.', errorCode: 'ACCOUNT_DISABLED' };
      }

      // Verify password
      const hashedPassword = await this.hashPassword(password);
      console.log('Password verification:', user.password === hashedPassword ? 'Success' : 'Failed');
      
      if (user.password !== hashedPassword) {
        await this.recordLoginAttempt(email, false);
        return { 
          success: false, 
          error: 'Incorrect password. Please check your password and try again.', 
          errorCode: 'INCORRECT_PASSWORD' 
        };
      }

      // Success - clear login attempts
      await this.recordLoginAttempt(email, true);

      // Update last login
      user.lastLogin = new Date().toISOString();
      await this.saveUser(user);

      console.log('Login successful for user:', user.email);

      // Create session
      const session = await this.createSession(user);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profileData: user.profileData
        },
        session
      };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed. Please try again.', errorCode: 'LOGIN_ERROR' };
    }
  }

  /**
   * Create user session
   */
  private async createSession(user: User): Promise<AuthSession> {
    const token = this.generateSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.SESSION_DURATION);

    const session: AuthSession = {
      userId: user.id,
      email: user.email,
      name: user.name,
      token,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isActive: true
    };

    await this.saveSession(session);
    this.currentSession = session;

    // Store in Chrome storage for persistence
    await chrome.storage.local.set({
      authSession: session,
      userAuth: {
        isAuthenticated: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profileData: user.profileData
        },
        timestamp: Date.now()
      }
    });

    return session;
  }

  /**
   * Validate current session
   */
  async validateSession(): Promise<AuthResult> {
    try {
      // Check Chrome storage first
      const result = await chrome.storage.local.get(['authSession', 'userAuth']);
      
      if (!result.authSession || !result.userAuth) {
        return { success: false, error: 'No active session', errorCode: 'NO_SESSION' };
      }

      const session = result.authSession as AuthSession;
      const now = new Date();
      const expiresAt = new Date(session.expiresAt);

      if (now > expiresAt) {
        await this.logout();
        return { success: false, error: 'Session expired', errorCode: 'SESSION_EXPIRED' };
      }

      // Verify session in database
      const dbSession = await this.getSession(session.token);
      if (!dbSession || !dbSession.isActive) {
        await this.logout();
        return { success: false, error: 'Invalid session', errorCode: 'INVALID_SESSION' };
      }

      this.currentSession = session;
      return {
        success: true,
        user: result.userAuth.user,
        session
      };

    } catch (error) {
      console.error('Session validation error:', error);
      return { success: false, error: 'Session validation failed', errorCode: 'VALIDATION_ERROR' };
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      if (this.currentSession) {
        await this.invalidateSession(this.currentSession.token);
      }

      await chrome.storage.local.remove(['authSession', 'userAuth']);
      this.currentSession = null;
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): { id: string; email: string; name: string } | null {
    return this.currentSession ? {
      id: this.currentSession.userId,
      email: this.currentSession.email,
      name: this.currentSession.name
    } : null;
  }

  // Private database methods
  private async getUserByEmail(email: string): Promise<User | null> {
    if (!this.db) await this.initDB();

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['users'], 'readonly');
      const store = transaction.objectStore('users');
      const index = store.index('email');
      const request = index.get(email);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  private async saveUser(user: User): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['users'], 'readwrite');
      const store = transaction.objectStore('users');
      const request = store.put(user);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async saveSession(session: AuthSession): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.put(session);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async getSession(token: string): Promise<AuthSession | null> {
    if (!this.db) await this.initDB();

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.get(token);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  private async invalidateSession(token: string): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      store.delete(token);
      resolve();
    });
  }
}

export const authService = new AuthenticationService();
