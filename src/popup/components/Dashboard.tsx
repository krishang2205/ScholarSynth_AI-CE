import React, { useState, useEffect } from 'react';
import { Note, UserProfile } from '../../types';
import { safeSendMessage } from '../../utils/message-utils';

interface DashboardProps {
  onNavigate?: (view: 'dashboard' | 'notes' | 'search' | 'chat' | 'settings' | 'visualizations') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Loading dashboard data...');

      const [notesResponse, profileResponse] = await Promise.all([
        safeSendMessage({ type: 'GET_NOTES' }),
        safeSendMessage({ type: 'GET_USER_PROFILE' })
      ]);

      console.log('Notes response:', notesResponse);
      console.log('Profile response:', profileResponse);

      // Fix: Access notes directly from response, not from data.notes
      if (notesResponse && notesResponse.notes) {
        console.log('Setting notes:', notesResponse.notes);
        setNotes(notesResponse.notes);
      } else {
        console.log('No notes found or invalid response structure');
        setNotes([]);
      }

      // Fix: Access profile directly from response, not from data.profile
      if (profileResponse && profileResponse.profile) {
        console.log('Setting user profile:', profileResponse.profile);
        setUserProfile(profileResponse.profile);
      } else {
        console.log('No user profile found or invalid response structure');
        setUserProfile(null);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getTopTags = () => {
    const tagCounts: Record<string, number> = {};
    notes.forEach(note => {
      note.tags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));
  };

  const getRecentNotes = () => {
    return notes
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  };

  const getSnippet = (note: Note, max = 140) => {
    const base = (note.summary && note.summary.trim().length > 0)
      ? note.summary.trim()
      : (note.content || '').trim();
    if (!base) return '';
    // Remove excessive whitespace/newlines
    const clean = base.replace(/\s+/g, ' ');
    return clean.length > max ? clean.substring(0, max).trim() + '…' : clean;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <div className="empty-state-title">Error Loading Dashboard</div>
        <div className="empty-state-description">{error}</div>
        <button className="btn btn-primary" onClick={loadData}>
          Try Again
        </button>
      </div>
    );
  }

  const topTags = getTopTags();
  const recentNotes = getRecentNotes();

  // Debug logging for stats
  console.log('Dashboard stats:', {
    notesCount: notes.length,
    topTagsCount: topTags.length,
    recentNotesCount: recentNotes.length,
    userProfileTopicsCount: userProfile?.topics?.length || 0,
    topTags: topTags,
    recentNotes: recentNotes
  });

  return (
    <div className="dashboard-container fade-in">
      {/* Hero Section */}
      <div className="welcome-card">
        <div className="welcome-content">
          <div className="welcome-title">Research Dashboard</div>
          <div className="welcome-description">
            Advanced AI-powered research platform for scholarly synthesis, 
            semantic analysis, and knowledge discovery.
          </div>
        </div>
        <div className="hero-actions">
          <button 
            className="hero-action-primary"
            onClick={() => onNavigate?.('search')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}>
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            Begin Research
          </button>
          <button 
            className="hero-action-secondary"
            onClick={() => onNavigate?.('chat')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}>
              <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
            </svg>
            AI Analysis
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="stats-overview">
        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-icon">📚</div>
            <div className="stat-info">
              <span className="stat-number">{notes.length}</span>
              <span className="stat-label">Research Notes</span>
            </div>
          </div>
          <div className="stat-card secondary">
            <div className="stat-icon">🏷️</div>
            <div className="stat-info">
              <span className="stat-number">{topTags.length}</span>
              <span className="stat-label">Topics Explored</span>
            </div>
          </div>
          <div className="stat-card success">
            <div className="stat-icon">⚡</div>
            <div className="stat-info">
              <span className="stat-number">{recentNotes.length}</span>
              <span className="stat-label">Recent Activity</span>
            </div>
          </div>
          <div className="stat-card accent">
            <div className="stat-icon">🎯</div>
            <div className="stat-info">
              <span className="stat-number">{userProfile?.topics?.length || 0}</span>
              <span className="stat-label">Research Interests</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-section">
        <h3 className="section-title">Quick Actions</h3>
        <div className="action-grid">
          <button 
            className="action-card"
            onClick={() => onNavigate?.('notes')}
          >
            <div className="action-icon">📝</div>
            <div className="action-content">
              <div className="action-title">My Notes</div>
              <div className="action-subtitle">View & organize research</div>
            </div>
          </button>
          <button 
            className="action-card"
            onClick={() => onNavigate?.('visualizations')}
          >
            <div className="action-icon">📊</div>
            <div className="action-content">
              <div className="action-title">Insights</div>
              <div className="action-subtitle">Visualize connections</div>
            </div>
          </button>
          <button 
            className="action-card"
            onClick={() => onNavigate?.('settings')}
          >
            <div className="action-icon">⚙️</div>
            <div className="action-content">
              <div className="action-title">Settings</div>
              <div className="action-subtitle">Customize experience</div>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Notes */}
      {recentNotes.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Notes</div>
          </div>
          <div className="card-content">
            {recentNotes.map((note) => (
              <div key={note.id} className="note-item">
                <div className="note-title">{note.title}</div>
                <div className="note-summary" style={{ fontSize: '0.8rem', color: '#555' }}>
                  {getSnippet(note)}
                </div>
                <div className="note-meta">
                  <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                  <div className="note-tags">
                    {note.tags?.slice(0, 3).map((tag) => (
                      <span key={tag} className="note-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {notes.length > 3 && (
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', marginTop: '1rem' }}
                onClick={() => onNavigate?.('notes')}
              >
                View All Notes ({notes.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Topics */}
      {topTags.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <div className="card-title">Top Topics</div>
          </div>
          <div className="card-content">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {topTags.map(({ tag, count }) => (
                <span 
                  key={tag} 
                  className="note-tag" 
                  style={{ 
                    fontSize: '0.875rem',
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => onNavigate?.('search')}
                  title={`${count} notes`}
                >
                  {tag} ({count})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {notes.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🧠</div>
          <div className="empty-state-title">Start Your Research Journey</div>
          <div className="empty-state-description">
            Select text on any webpage, right-click, and choose "Summarize with ScholarSynth AI" 
            to create your first intelligent note.
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => onNavigate?.('settings')}
          >
            Configure Settings
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;