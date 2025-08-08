import { Note, UserProfile, Project, ChatMessage } from '../types';

class StorageService {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'ContextAwareAINotes';
  private readonly DB_VERSION = 1;

  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Notes store
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('project', 'project', { unique: false });
          notesStore.createIndex('tags', 'tags', { unique: false });
          notesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // User profile store
        if (!db.objectStoreNames.contains('userProfile')) {
          db.createObjectStore('userProfile', { keyPath: 'id' });
        }

        // Projects store
        if (!db.objectStoreNames.contains('projects')) {
          const projectsStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectsStore.createIndex('name', 'name', { unique: true });
        }

        // Chat messages store
        if (!db.objectStoreNames.contains('chatMessages')) {
          const chatStore = db.createObjectStore('chatMessages', { keyPath: 'id' });
          chatStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Embeddings store
        if (!db.objectStoreNames.contains('embeddings')) {
          db.createObjectStore('embeddings', { keyPath: 'id' });
        }

        // Users store for authentication
        if (!db.objectStoreNames.contains('users')) {
          const usersStore = db.createObjectStore('users', { keyPath: 'email' });
          usersStore.createIndex('email', 'email', { unique: true });
        }
      };
    });
  }

  // Notes operations
  async saveNote(note: Note): Promise<void> {
    if (!this.db) await this.initDB();
    
    // Ensure note has userId
    if (!note.userId) {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      note.userId = currentUser.id;
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notes'], 'readwrite');
      const store = transaction.objectStore('notes');
      const request = store.put(note);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getNote(id: string): Promise<Note | null> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getAllNotes(): Promise<Note[]> {
    if (!this.db) await this.initDB();
    
    const currentUser = await this.getCurrentUser();
    if (!currentUser) {
      console.warn('No authenticated user found, returning empty notes array');
      return [];
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const allNotes = request.result || [];
        // Filter notes by current user
        const userNotes = allNotes.filter(note => note.userId === currentUser.id);
        resolve(userNotes);
      };
    });
  }

  async getNotesByProject(projectId: string): Promise<Note[]> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notes'], 'readonly');
      const store = transaction.objectStore('notes');
      const index = store.index('project');
      const request = index.getAll(projectId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async deleteNote(id: string): Promise<void> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['notes'], 'readwrite');
      const store = transaction.objectStore('notes');
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // User profile operations
  async saveUserProfile(profile: UserProfile): Promise<void> {
    const currentUser = await this.getCurrentUser();
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }
    
    // Ensure profile has userId
    profile.userId = currentUser.id;
    
    await chrome.storage.local.set({ userProfile: profile });
  }

  async getUserProfile(): Promise<UserProfile | null> {
    const currentUser = await this.getCurrentUser();
    if (!currentUser) {
      console.warn('No authenticated user found, returning null profile');
      return null;
    }
    
    const result = await chrome.storage.local.get('userProfile');
    const profile = result.userProfile;
    
    // Only return profile if it belongs to current user
    if (profile && profile.userId === currentUser.id) {
      return profile;
    }
    
    // If no profile exists for current user, create a default one
    console.log('No profile found for current user, creating default profile');
    const defaultProfile: UserProfile = {
      userId: currentUser.id,
      topics: ['general', 'research'],
      style: 'academic',
      verbosity: 'detailed',
      preferredLength: 'medium',
      researchFocus: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save the default profile
    await this.saveUserProfile(defaultProfile);
    return defaultProfile;
  }

  // Projects operations
  async saveProject(project: Project): Promise<void> {
    if (!this.db) await this.initDB();
    
    // Ensure project has userId
    if (!project.userId) {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      project.userId = currentUser.id;
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['projects'], 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.put(project);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAllProjects(): Promise<Project[]> {
    if (!this.db) await this.initDB();
    
    const currentUser = await this.getCurrentUser();
    if (!currentUser) {
      console.warn('No authenticated user found, returning empty projects array');
      return [];
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['projects'], 'readonly');
      const store = transaction.objectStore('projects');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const allProjects = request.result || [];
        // Filter projects by current user
        const userProjects = allProjects.filter(project => project.userId === currentUser.id);
        resolve(userProjects);
      };
    });
  }

  // Chat messages operations
  async saveChatMessage(message: ChatMessage): Promise<void> {
    if (!this.db) await this.initDB();
    
    // Ensure message has userId
    if (!message.userId) {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }
      message.userId = currentUser.id;
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['chatMessages'], 'readwrite');
      const store = transaction.objectStore('chatMessages');
      const request = store.put(message);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getChatMessages(limit: number = 50): Promise<ChatMessage[]> {
    if (!this.db) await this.initDB();
    
    const currentUser = await this.getCurrentUser();
    if (!currentUser) {
      console.warn('No authenticated user found, returning empty chat messages array');
      return [];
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['chatMessages'], 'readonly');
      const store = transaction.objectStore('chatMessages');
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const allMessages = request.result || [];
        // Filter messages by current user
        const userMessages = allMessages.filter(message => message.userId === currentUser.id);
        resolve(userMessages.slice(-limit));
      };
    });
  }

  // Embeddings operations
  async saveEmbedding(id: string, embedding: number[]): Promise<void> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['embeddings'], 'readwrite');
      const store = transaction.objectStore('embeddings');
      const request = store.put({ id, embedding });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getEmbedding(id: string): Promise<number[] | null> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['embeddings'], 'readonly');
      const store = transaction.objectStore('embeddings');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.embedding || null);
    });
  }

  async getAllEmbeddings(): Promise<{ id: string; embedding: number[] }[]> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['embeddings'], 'readonly');
      const store = transaction.objectStore('embeddings');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  // Settings operations
  async saveSettings(settings: any): Promise<void> {
  // Merge with existing settings to avoid overwriting unrelated keys
  const current = await this.getSettings();
  const merged = { ...current, ...settings };
  await chrome.storage.local.set({ settings: merged });
  }

  async getSettings(): Promise<any> {
    const result = await chrome.storage.local.get('settings');
    return result.settings || {};
  }

  // User authentication operations
  async registerUser(email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> {
    if (!this.db) await this.initDB();
    
    try {
      // Check if user already exists
      const existingUser = await this.getUser(email);
      if (existingUser) {
        return { success: false, error: 'User already exists with this email' };
      }

      // Hash password (simple hash for demo - in production use proper hashing)
      const hashedPassword = await this.hashPassword(password);
      
      const user = {
        email,
        password: hashedPassword,
        name,
        createdAt: new Date().toISOString(),
        lastLogin: null
      };

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        const request = store.put(user);

        request.onerror = () => resolve({ success: false, error: 'Failed to create user' });
        request.onsuccess = () => resolve({ success: true });
      });
    } catch (error) {
      return { success: false, error: 'Registration failed' };
    }
  }

  async loginUser(email: string, password: string): Promise<{ success: boolean; user?: any; error?: string }> {
    if (!this.db) await this.initDB();
    
    try {
      const user = await this.getUser(email);
      if (!user) {
        return { success: false, error: 'No account found with this email' };
      }

      const hashedPassword = await this.hashPassword(password);
      if (user.password !== hashedPassword) {
        return { success: false, error: 'Incorrect password' };
      }

      // Update last login
      user.lastLogin = new Date().toISOString();
      await this.updateUser(user);

      return { 
        success: true, 
        user: { email: user.email, name: user.name } 
      };
    } catch (error) {
      return { success: false, error: 'Login failed' };
    }
  }

  private async getUser(email: string): Promise<any | null> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['users'], 'readonly');
      const store = transaction.objectStore('users');
      const request = store.get(email);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  private async updateUser(user: any): Promise<void> {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['users'], 'readwrite');
      const store = transaction.objectStore('users');
      const request = store.put(user);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private async hashPassword(password: string): Promise<string> {
    // Simple hash for demo - in production use proper crypto libraries like bcrypt
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'scholar_synth_salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Get current authenticated user
  async getCurrentUser(): Promise<{ id: string; email: string; name: string } | null> {
    try {
      const result = await chrome.storage.local.get(['userAuth']);
      if (result.userAuth && result.userAuth.isAuthenticated && result.userAuth.user) {
        return result.userAuth.user;
      }
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }
}

export const storageService = new StorageService(); 