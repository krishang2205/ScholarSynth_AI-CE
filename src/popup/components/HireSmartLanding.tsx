import React from 'react';

const HireSmartLanding: React.FC = () => {
  return (
    <div className="hiresmart-landing">
      {/* Hero Section */}
      <div className="hero-section">
        <div className="hero-content">
          <div className="hero-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 3.5C14.8 3.3 14.4 3.1 14 3.1S13.2 3.3 13 3.5L7 7V9H21ZM16 10V15H8V10H2V21H22V10H16Z"/>
            </svg>
          </div>
          <h1 className="hero-title">HireSmart AI</h1>
          <p className="hero-subtitle">
            Revolutionize your hiring process with AI-powered candidate screening, 
            intelligent resume analysis, and smart interview assistance.
          </p>
        </div>
      </div>

      {/* Features Section */}
      <div className="features-section">
        <h2 className="section-title">Intelligent Recruitment Features</h2>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
            </div>
            <h3>Smart Resume Analysis</h3>
            <p>
              Automatically extract key skills, experience, and qualifications from resumes 
              using advanced AI to identify the best candidates quickly.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
              </svg>
            </div>
            <h3>Candidate Ranking</h3>
            <p>
              Get AI-powered candidate rankings based on job requirements, 
              skills match, and experience relevance to make better hiring decisions.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/>
              </svg>
            </div>
            <h3>Interview Assistant</h3>
            <p>
              Generate relevant interview questions, evaluate responses, 
              and get real-time insights during candidate interviews.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <h3>Skills Assessment</h3>
            <p>
              Automated technical and soft skills evaluation with 
              AI-generated assessments tailored to specific job roles.
            </p>
          </div>
        </div>
      </div>

      {/* Integration Section */}
      <div className="integration-section">
        <h2 className="section-title">Powered by ScholarSynth AI</h2>
        <div className="integration-content">
          <div className="integration-text">
            <p>
              HireSmart AI leverages the same advanced AI technology that powers 
              ScholarSynth AI's research capabilities, now optimized for recruitment and hiring.
            </p>
            <ul className="integration-features">
              <li>✨ Same Gemini AI technology for content analysis</li>
              <li>🔍 Advanced semantic search for candidate matching</li>
              <li>📊 Intelligent data visualization for hiring insights</li>
              <li>🤖 Context-aware AI assistance throughout the hiring process</li>
            </ul>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="cta-section">
        <div className="cta-content">
          <h2>Ready to Transform Your Hiring?</h2>
          <p>
            Experience the future of AI-powered recruitment with HireSmart AI's 
            intelligent hiring assistant capabilities.
          </p>
          <div className="cta-buttons">
            <button className="cta-primary">
              Coming Soon
            </button>
            <button className="cta-secondary">
              Learn More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HireSmartLanding;