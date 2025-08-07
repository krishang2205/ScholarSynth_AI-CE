import React, { useState } from 'react';
import { authService } from '../../services/auth';
import { notificationService } from '../../services/notifications';

interface AuthProps {
  onLogin: (userData: { id: string; email: string; name: string; profileData?: any }) => Promise<void>;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Client-side validation before API calls
      if (!formData.email.trim() || !formData.password) {
        notificationService.error(
          'Missing Information',
          'Please fill in all required fields.'
        );
        throw new Error('Please fill in all required fields');
      }

      if (!isLogin) {
        // Additional signup validation
        if (!formData.name.trim()) {
          notificationService.error(
            'Name Required',
            'Please enter your full name.'
          );
          throw new Error('Name is required');
        }

        if (formData.password !== formData.confirmPassword) {
          notificationService.error(
            'Password Mismatch',
            'Password and confirm password do not match.'
          );
          throw new Error('Passwords do not match');
        }
      }

      if (!isLogin) {
        // Registration
        console.log('Attempting registration for:', formData.email);
        const result = await authService.register(
          formData.email.trim(),
          formData.password,
          formData.name.trim()
        );

        console.log('Registration result:', result);

        if (!result.success) {
          // Show specific error messages with notifications
          if (result.errorCode === 'EMAIL_EXISTS') {
            notificationService.warning(
              'Account Already Exists',
              'You already have an account with this email. Please login instead or use a different email address.'
            );
            
            // Suggest switching to login mode
            setTimeout(() => {
              setIsLogin(true);
              setFormData(prev => ({ ...prev, name: '', confirmPassword: '' }));
            }, 2000);
          } else if (result.errorCode === 'WEAK_PASSWORD') {
            notificationService.error(
              'Password Too Weak',
              result.error || 'Please choose a stronger password with uppercase, lowercase, and numbers.'
            );
          } else if (result.errorCode === 'INVALID_EMAIL') {
            notificationService.error(
              'Invalid Email',
              'Please enter a valid email address.'
            );
          } else {
            notificationService.error(
              'Registration Failed',
              result.error || 'Unable to create account. Please try again.'
            );
          }
          throw new Error(result.error);
        }

        // Success notification
        notificationService.success(
          'Account Created Successfully!',
          `Welcome ${result.user?.name}! You're now logged in.`
        );

        // Auto-login after successful registration
        if (result.user) {
          await onLogin(result.user);
        }
      } else {
        // Login
        console.log('Attempting login for:', formData.email);
        const result = await authService.login(
          formData.email.trim(),
          formData.password
        );

        console.log('Login result:', result);

        if (!result.success) {
          // Show specific error messages with notifications
          if (result.errorCode === 'ACCOUNT_NOT_FOUND') {
            notificationService.warning(
              'Account Not Found',
              'No account found with this email. Please sign up first or check your email address.'
            );
            
            // Suggest switching to signup mode
            setTimeout(() => {
              setIsLogin(false);
              setFormData(prev => ({ ...prev, confirmPassword: '' }));
            }, 2000);
          } else if (result.errorCode === 'INCORRECT_PASSWORD') {
            notificationService.error(
              'Incorrect Password',
              'The password you entered is incorrect. Please try again or reset your password.'
            );
          } else if (result.errorCode === 'RATE_LIMITED') {
            notificationService.error(
              'Account Temporarily Locked',
              result.error || 'Too many failed attempts. Please wait before trying again.'
            );
          } else if (result.errorCode === 'ACCOUNT_DISABLED') {
            notificationService.error(
              'Account Disabled',
              'Your account has been deactivated. Please contact support.'
            );
          } else {
            notificationService.error(
              'Login Failed',
              result.error || 'Unable to login. Please check your credentials and try again.'
            );
          }
          throw new Error(result.error);
        }

        // Success notification
        notificationService.success(
          'Welcome Back!',
          `Successfully logged in as ${result.user?.name}`
        );

        if (result.user) {
          await onLogin(result.user);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (error) {
      setError(null);
    }

    // Real-time password confirmation validation
    if (name === 'confirmPassword' && !isLogin) {
      if (value && formData.password !== value) {
        setError('Passwords do not match');
      } else if (error === 'Passwords do not match') {
        setError(null);
      }
    }
    
    if (name === 'password' && !isLogin && formData.confirmPassword) {
      if (formData.confirmPassword && value !== formData.confirmPassword) {
        setError('Passwords do not match');
      } else if (error === 'Passwords do not match') {
        setError(null);
      }
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    setFormData({
      email: '',
      password: '',
      name: '',
      confirmPassword: ''
    });
    
    // Show helpful notification
    if (!isLogin) {
      notificationService.info(
        'Switched to Login',
        'Enter your existing account credentials to login.'
      );
    } else {
      notificationService.info(
        'Switched to Sign Up',
        'Create a new account to get started with ScholarSynth AI.'
      );
    }
  };

  const handleDemoLogin = async () => {
    try {
      setLoading(true);
      notificationService.info(
        'Demo Mode',
        'Logging in as guest user for demonstration...'
      );
      
      await onLogin({ 
        id: 'demo_user', 
        email: 'demo@scholarsynthAI.com', 
        name: 'Demo User',
        profileData: { institution: 'Demo Institution' }
      });
      
      notificationService.success(
        'Demo Access Granted',
        'Welcome to ScholarSynth AI! You\'re using demo mode with full features.'
      );
    } catch (error) {
      notificationService.error(
        'Demo Login Failed',
        'Unable to start demo mode. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Brand Header */}
      <div className="auth-header">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div className="auth-brand-text">
            <div className="auth-brand-title">ScholarSynth AI</div>
            <div className="auth-brand-subtitle">AI-Powered Research Assistant</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="auth-main">
        <div className="auth-form-container">
          <h2 className="auth-title">
            {isLogin ? 'Log In' : 'Create Account'}
          </h2>

          {error && <div className="auth-error">{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="auth-input"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="auth-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="password-group">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="auth-input"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    {showPassword ? (
                      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                    ) : (
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="auth-input"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? 'Please wait...' : (isLogin ? 'Log In' : 'Create Account')}
            </button>

            {isLogin && (
              <div className="auth-forgot">
                <a href="#" className="forgot-link">Forgot password?</a>
              </div>
            )}

            <div className="auth-switch">
              {isLogin ? "Don't have account? " : "Already have an account? "}
              <button
                type="button"
                className="auth-switch-btn"
                onClick={toggleMode}
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </div>

            {/* Demo Skip Button */}
            <div className="demo-section">
              <button
                type="button"
                onClick={handleDemoLogin}
                className="demo-btn"
                disabled={loading}
              >
                Continue as Guest (Demo)
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
