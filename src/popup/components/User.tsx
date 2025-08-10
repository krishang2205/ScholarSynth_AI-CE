import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storage';

interface UserProfile {
  name: string;
  email: string;
  institution: string;
  researchField: string;
  joinDate: string;
  notesCount: number;
  totalSummaries: number;
  apiUsage: number;
}

interface UserProps {
  onLogout?: () => Promise<void>;
  onGoSettings?: () => void; // navigate to settings view
}

const User: React.FC<UserProps> = ({ onLogout, onGoSettings }) => {
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Dr. Scholar',
    email: 'scholar@university.edu',
    institution: 'Research University',
    researchField: 'Computer Science',
    joinDate: 'January 2024',
    notesCount: 0,
    totalSummaries: 0,
    apiUsage: 85
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(userProfile);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      // Get user auth data
      const result = await chrome.storage.local.get(['userAuth']);
      if (result.userAuth && result.userAuth.user) {
        const userData = result.userAuth.user;
        setUserProfile(prev => ({
          ...prev,
          name: userData.name || 'User',
          email: userData.email || 'user@example.com'
        }));
        setEditForm(prev => ({
          ...prev,
          name: userData.name || 'User',
          email: userData.email || 'user@example.com'
        }));
      }

      // Get notes count
      const notes = await storageService.getAllNotes();
      setUserProfile(prev => ({
        ...prev,
        notesCount: notes.length,
        totalSummaries: notes.reduce((sum: number, note: any) => sum + (note.summary ? 1 : 0), 0)
      }));
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleSave = async () => {
    setUserProfile(editForm);
    setIsEditing(false);
    // You could save to storage here if needed
  };

  const handleCancel = () => {
    setEditForm(userProfile);
    setIsEditing(false);
  };

  const stats = [
    { label: 'Notes Created', value: userProfile.notesCount, icon: '📝' },
    { label: 'AI Summaries', value: userProfile.totalSummaries, icon: '🤖' },
    { label: 'API Usage', value: `${userProfile.apiUsage}%`, icon: '⚡' },
    { label: 'Member Since', value: userProfile.joinDate, icon: '📅' }
  ];

  return (
    <div className="user-profile">
      <div className="user-header">
        <div className="user-avatar-large">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
        
        <div className="user-info-header">
          {isEditing ? (
            <div className="edit-form">
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                className="edit-input user-name-input"
                placeholder="Full Name"
              />
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                className="edit-input"
                placeholder="Email"
              />
              <input
                type="text"
                value={editForm.institution}
                onChange={(e) => setEditForm(prev => ({ ...prev, institution: e.target.value }))}
                className="edit-input"
                placeholder="Institution"
              />
              <input
                type="text"
                value={editForm.researchField}
                onChange={(e) => setEditForm(prev => ({ ...prev, researchField: e.target.value }))}
                className="edit-input"
                placeholder="Research Field"
              />
            </div>
          ) : (
            <div className="user-details-main">
              <h2 className="user-name">{userProfile.name}</h2>
              <p className="user-email">{userProfile.email}</p>
              <p className="user-institution">{userProfile.institution}</p>
              <p className="user-field">{userProfile.researchField}</p>
            </div>
          )}
          
          <div className="user-actions">
            {isEditing ? (
              <div className="edit-actions">
                <button onClick={handleSave} className="btn-save">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                  Save
                </button>
                <button onClick={handleCancel} className="btn-cancel">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setIsEditing(true)} className="btn-edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="user-stats">
        <h3 className="stats-title">Activity Overview</h3>
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <div key={index} className="stat-card">
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-content">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="user-preferences">
        <h3 className="preferences-title">Quick Actions</h3>
        <div className="action-buttons">
          <button className="action-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Export Data
          </button>
          <button className="action-btn" onClick={onGoSettings}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
            </svg>
            Preferences
          </button>
          <button className="action-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
            Contact Support
          </button>
        </div>
      </div>

      {/* Account Section */}
      {onLogout && (
        <div className="account-section">
          <h3 className="preferences-title">Account</h3>
          <button onClick={onLogout} className="signout-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default User;
