import React, { useState, useEffect } from 'react';
import ThemeToggle from './common/ThemeToggle';
import { UserProfile } from '../../types';
import { API_CONFIG } from '../../config/api-config';
import { safeSendMessage } from '../../utils/message-utils';

interface SettingsProps {
}

const Settings: React.FC<SettingsProps> = () => {
  const [settings, setSettings] = useState<any>({});
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form states
  const [apiKey, setApiKey] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [profileForm, setProfileForm] = useState({
    topics: '',
    style: 'academic',
    verbosity: 'detailed',
    preferredLength: 'medium',
    researchFocus: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [settingsResponse, profileResponse] = await Promise.all([
        safeSendMessage({ type: 'GET_SETTINGS' }), // => { settings }
        safeSendMessage({ type: 'GET_USER_PROFILE' }) // => { profile }
      ]);

      if (settingsResponse?.settings) {
        setSettings(settingsResponse.settings);
        setApiKey(settingsResponse.settings.geminiApiKey || '');
        if (typeof settingsResponse.settings.darkMode === 'boolean') {
          setDarkMode(settingsResponse.settings.darkMode);
          updateDocumentTheme(settingsResponse.settings.darkMode);
        }
      }

      if (profileResponse?.profile) {
        const profile = profileResponse.profile;
        setUserProfile(profile);
        setProfileForm({
          topics: profile.topics?.join(', ') || '',
          style: profile.style || 'academic',
          verbosity: profile.verbosity || 'detailed',
          preferredLength: profile.preferredLength || 'medium',
          researchFocus: profile.researchFocus?.join(', ') || ''
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showMessage('error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSaveApiKey = async () => {
    try {
      setSaving(true);
      const response = await safeSendMessage({ type: 'SET_API_KEY', data: { apiKey: apiKey.trim() } });
      if (response?.success) {
        showMessage('success', 'API key saved successfully');
        setSettings((prev: any) => ({ ...prev, geminiApiKey: apiKey.trim() }));
      } else {
        showMessage('error', response?.error || 'Failed to save API key');
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      showMessage('error', 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const updateDocumentTheme = (enabled: boolean) => {
    const root = document.getElementById('root');
    if (!root) return;
    if (enabled) root.classList.add('dark'); else root.classList.remove('dark');
  };

  const handleToggleDarkMode = async () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    updateDocumentTheme(newValue);
    try {
      await safeSendMessage({ type: 'SETTINGS_UPDATE', data: { darkMode: newValue } });
    } catch (e) {
      // fallback direct save using storage message already existing (reuse saveSettings path via SET_API_KEY not suitable) -> create generic save
      // If background doesn't handle SETTINGS_UPDATE yet, we store directly via runtime message
      try { await safeSendMessage({ type: 'SAVE_SETTINGS', data: { settings: { darkMode: newValue } } }); } catch {}
    }
  };

  const handleSaveProfile = async () => {
    try {
      console.log('Starting to save profile...');
      setSaving(true);
      const updatedProfile: UserProfile = {
        userId: userProfile?.userId || 'temp-user', // Will be set by storage service
        topics: profileForm.topics.split(',').map(t => t.trim()).filter(t => t),
        style: profileForm.style as 'academic' | 'casual' | 'technical',
        verbosity: profileForm.verbosity as 'detailed' | 'comprehensive' | 'concise',
        preferredLength: profileForm.preferredLength as 'short' | 'medium' | 'long',
        researchFocus: profileForm.researchFocus.split(',').map(t => t.trim()).filter(t => t),
        createdAt: userProfile?.createdAt || new Date(),
        updatedAt: new Date()
      };

      console.log('Profile to save:', updatedProfile);

  const response = await safeSendMessage({ type: 'SAVE_USER_PROFILE', data: { profile: updatedProfile } });

      console.log('Save profile response:', response);

      if (response?.success) {
        setUserProfile(updatedProfile);
        console.log('Profile saved successfully, showing success message');
        showMessage('success', 'Profile saved successfully');
      } else {
        console.log('Profile save failed:', response?.error);
        showMessage('error', response?.error || 'Failed to save profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      showMessage('error', 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const testApiKey = async () => {
    try {
      setSaving(true);
      const response = await safeSendMessage({ type: 'TEST_API_KEY' });
      if (response?.success) {
        showMessage('success', 'API key is working correctly!');
      } else {
        showMessage('error', response?.error || 'API key test failed');
      }
    } catch (error) {
      console.error('Error testing API key:', error);
      showMessage('error', 'Failed to test API key');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      {/* Message Alert */}
      {message && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {message.text}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title">⚙️ ScholarSynth AI Settings</div>
        </div>
        <div className="card-content">
          {/* API Configuration */}
          <div className="form-section" style={{ marginBottom: '2rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
              <h3 style={{ 
                fontSize: 'var(--font-size-lg)', 
                fontWeight: '600', 
                color: 'var(--gray-800)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                Appearance
              </h3>
              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                <ThemeToggle checked={darkMode} onChange={() => handleToggleDarkMode()} />
                <span style={{ fontSize:'var(--font-size-sm)', fontWeight:500 }}>{darkMode ? 'Dark Mode' : 'Light Mode'}</span>
              </div>
            </div>
            <h3 style={{ 
              fontSize: 'var(--font-size-lg)', 
              fontWeight: '600', 
              color: 'var(--gray-800)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🔑 API Configuration
            </h3>
            
            {API_CONFIG.GEMINI_API_KEY ? (
              <div style={{
                background: 'var(--primary-50)',
                border: '1px solid var(--primary-200)',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--success-600)' }}>✅</span>
                  <strong style={{ color: 'var(--primary-700)' }}>Built-in API Key Active</strong>
                </div>
                <p style={{ 
                  fontSize: 'var(--font-size-sm)', 
                  color: 'var(--gray-600)', 
                  margin: 0 
                }}>
                  ScholarSynth AI is ready to use with our built-in API key. No configuration needed!
                </p>
              </div>
            ) : (
              <div style={{
                background: 'var(--warning-50)',
                border: '1px solid var(--warning-200)',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--warning-600)' }}>⚠️</span>
                  <strong style={{ color: 'var(--warning-700)' }}>API Key Required</strong>
                </div>
                <p style={{ 
                  fontSize: 'var(--font-size-sm)', 
                  color: 'var(--gray-600)', 
                  margin: 0 
                }}>
                  Please add your Google Gemini API key to use ScholarSynth AI features.
                </p>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Your API Key (Optional)</label>
              <input
                type="password"
                className="form-input"
                placeholder={API_CONFIG.GEMINI_API_KEY ? "Using built-in key (leave blank)" : "Enter your Gemini API key"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ marginBottom: '0.75rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn btn-primary"
                  onClick={handleSaveApiKey}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save API Key'}
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={testApiKey}
                  disabled={saving}
                >
                  Test Connection
                </button>
              </div>
            </div>
          </div>

          {/* User Profile */}
          <div className="form-section">
            <h3 style={{ 
              fontSize: 'var(--font-size-lg)', 
              fontWeight: '600', 
              color: 'var(--gray-800)',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              👤 Research Profile
            </h3>

            <div className="form-group">
              <label className="form-label">Research Topics</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., machine learning, psychology, history"
                value={profileForm.topics}
                onChange={(e) => setProfileForm(prev => ({ ...prev, topics: e.target.value }))}
              />
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                Comma-separated list of your research interests
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Writing Style</label>
                <select
                  className="form-select"
                  value={profileForm.style}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, style: e.target.value }))}
                >
                  <option value="academic">Academic</option>
                  <option value="casual">Casual</option>
                  <option value="technical">Technical</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Detail Level</label>
                <select
                  className="form-select"
                  value={profileForm.verbosity}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, verbosity: e.target.value }))}
                >
                  <option value="concise">Concise</option>
                  <option value="detailed">Detailed</option>
                  <option value="comprehensive">Comprehensive</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Research Focus Areas</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., data analysis, literature review, experimental design"
                value={profileForm.researchFocus}
                onChange={(e) => setProfileForm(prev => ({ ...prev, researchFocus: e.target.value }))}
              />
            </div>

            <button 
              className="btn btn-primary"
              onClick={handleSaveProfile}
              disabled={saving}
              style={{ width: '100%' }}
            >
              {saving ? 'Saving Profile...' : 'Save Research Profile'}
            </button>
          </div>

          {/* About */}
          <div style={{ 
            marginTop: '2rem', 
            padding: '1rem', 
            background: 'var(--gray-50)', 
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--gray-200)'
          }}>
            <h4 style={{ 
              fontSize: 'var(--font-size-base)', 
              fontWeight: '600', 
              color: 'var(--gray-800)', 
              marginBottom: '0.5rem' 
            }}>
              About ScholarSynth AI
            </h4>
            <p style={{ 
              fontSize: 'var(--font-size-sm)', 
              color: 'var(--gray-600)', 
              margin: 0,
              lineHeight: '1.5'
            }}>
              AI-powered research assistant that synthesizes knowledge from web content with intelligent 
              summarization, semantic search, and context-aware insights. Built to enhance your research workflow.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
