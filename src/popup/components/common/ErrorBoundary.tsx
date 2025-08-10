import React from 'react';

interface ErrorBoundaryProps {
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren<ErrorBoundaryProps>, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('UI ErrorBoundary caught error:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: '1rem', fontFamily: 'Inter, sans-serif' }}>
          <h3 style={{ marginTop: 0 }}>Something went wrong.</h3>
          <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>{this.state.error?.message}</p>
          <button onClick={this.handleReload} style={{
            background: 'linear-gradient(90deg,#1976d2,#1565c0)',
            color: '#fff',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: 'pointer'
          }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
