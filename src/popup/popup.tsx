import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import NotesList from './components/NotesList';
import Search from './components/Search';
import Chat from './components/Chat';
import Settings from './components/Settings';
import Visualizations from './components/Visualizations';
import User from './components/User';
import Auth from './components/Auth';
import HireSmartLanding from './components/HireSmartLanding';
import { authService } from '../services/auth';
import { safeSendMessage } from '../utils/message-utils';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastProvider } from './components/common/ToastProvider';

type ViewType = 'dashboard' | 'notes' | 'search' | 'chat' | 'settings' | 'visualizations' | 'user' | 'hiresmart';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check authentication status and initialize app
    const initializeApp = async () => {
      try {
        const sessionResult = await authService.validateSession();
        if (sessionResult.success && sessionResult.user) {
          setIsAuthenticated(true);
          setCurrentUser(sessionResult.user);
        } else {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
        // load settings for dark mode
        try {
          const resp = await safeSendMessage({ type: 'GET_SETTINGS' });
          const dm = resp?.settings?.darkMode;
          if (typeof dm === 'boolean') {
            setDarkMode(dm);
            const root = document.getElementById('root');
            if (root) { if (dm) root.classList.add('dark'); else root.classList.remove('dark'); }
          }
        } catch (e) { /* ignore */ }
      } catch (error) {
        console.error('Error checking auth status:', error);
        setIsAuthenticated(false);
        setCurrentUser(null);
      } finally {
        // Simulate loading time for smooth transition
        setTimeout(() => {
          setIsLoading(false);
        }, 800);
      }
    };

    initializeApp();
  }, []);

  const handleLogin = async (userData: any) => {
    setIsAuthenticated(true);
    setCurrentUser(userData);
  };

  const handleLogout = async () => {
    await authService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentView('dashboard');
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="loading-text">Initializing ScholarSynth AI...</div>
      </div>
    );
  }

  // Show authentication screen if not authenticated
  if (!isAuthenticated) {
    return <Auth onLogin={handleLogin} />;
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentView} />;
      case 'notes':
        return <NotesList />;
      case 'search':
        return <Search />;
      case 'chat':
        return <Chat />;
      case 'settings':
        return <Settings />;
      case 'visualizations':
        return <Visualizations />;
      case 'user':
        return <User onLogout={handleLogout} onGoSettings={() => setCurrentView('settings')} />;
      case 'hiresmart':
        return <HireSmartLanding />;
      default:
        return <Dashboard onNavigate={setCurrentView} />;
    }
  };

  return (
    <ErrorBoundary>
      <ToastProvider>
        <div className="app-container">
          <div className="header">
            <div className="brand">
              <div className="brand-icon"></div>
              <div>
                <div className="brand-title">ScholarSynth AI</div>
                <div className="brand-subtitle">AI-Powered Research Assistant</div>
              </div>
            </div>
          </div>
          <div className="main-layout">
            <Navigation 
              currentView={currentView} 
              onViewChange={setCurrentView}
              currentUser={currentUser}
            />
            <div className="main-content">
              {renderCurrentView()}
            </div>
          </div>
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
