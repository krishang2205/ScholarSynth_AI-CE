import React from 'react';

interface ThemeToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ checked, onChange }) => {
  return (
    <label className={`theme-toggle ${checked ? 'theme-toggle-on' : ''}`}>      
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={checked ? 'Disable dark mode' : 'Enable dark mode'}
      />
      <span className="toggle-track">
        <span className="toggle-icon toggle-icon-sun" aria-hidden="true">
          {/* Sun icon */}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <circle cx="12" cy="12" r="4" />
            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="2" x2="12" y2="4" />
              <line x1="12" y1="20" x2="12" y2="22" />
              <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
              <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
              <line x1="2" y1="12" x2="4" y2="12" />
              <line x1="20" y1="12" x2="22" y2="12" />
              <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
              <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
            </g>
          </svg>
        </span>
        <span className="toggle-icon toggle-icon-moon" aria-hidden="true">
          {/* Moon icon */}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M21 12.79A9 9 0 0111.21 3 7 7 0 0012 17a7 7 0 009-4.21z" />
          </svg>
        </span>
        <span className="toggle-thumb" />
      </span>
    </label>
  );
};

export default ThemeToggle;
