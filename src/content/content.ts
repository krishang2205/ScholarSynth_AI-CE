import { Note } from '../types';

class ContentScript {
  private summaryPopup: HTMLElement | null = null;
  private isPopupVisible = false;

  constructor() {
    this.init();
  }

  private init(): void {
    console.log('Content script initialized on:', window.location.href);
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Content script received message:', message.type);
      switch (message.type) {
        case 'SHOW_SUMMARY':
          this.showSummaryPopup(message.data.note, message.data.summary);
          break;
        case 'SHOW_ERROR':
          this.showErrorPopup(message.data.error);
          break;
      }
      // Send response to confirm message was received
      sendResponse({ received: true });
    });

  // Text selection summarize hint removed per request (no indicator shown now)
    
    // Close popup when clicking outside
    document.addEventListener('click', this.handleOutsideClick.bind(this));
    
    // Close popup on escape key
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  // handleTextSelection & showSummarizeIndicator removed

  private showSummaryPopup(note: Note, summary: string): void {
    // Remove existing popup
    this.removeSummaryPopup();

    // Create popup
    const popup = document.createElement('div');
    popup.id = 'ai-summary-popup';
    popup.innerHTML = `
      <div class="ai-popup-header">
        <div class="ai-header-left">
          <svg class="ai-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 2L13.09 8.26L19.91 9L13.09 9.74L12 16L10.91 9.74L4.09 9L10.91 8.26L12 2Z"/>
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <h3>ScholarSynth AI</h3>
        </div>
        <button class="ai-close-btn" id="ai-close-popup">×</button>
      </div>
      <div class="ai-popup-content">
        <div class="ai-summary-section">
          <div class="ai-summary-text">${summary}</div>
        </div>
        
        <div class="ai-metadata-section">
          <div class="ai-tags">
            <span class="ai-label">Tags:</span> 
            <span class="ai-tag-list">${note.tags.length > 0 ? note.tags.join(', ') : 'No tags'}</span>
          </div>
          <div class="ai-source">
            <span class="ai-label">Source:</span> 
            <span class="ai-source-text" title="${note.url}">${note.source}</span>
          </div>
        </div>
        
        <div class="ai-popup-actions">
          <button class="ai-action-btn ai-save-btn" id="ai-save-note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 3H5c-1.11 0-2 .89-2 2v14c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
            </svg>
            <span class="ai-btn-text">Save Note</span>
          </button>
          <div class="ai-rating-section">
            <span class="ai-rating-label">Rate this summary:</span>
            <div class="ai-rating-buttons">
              <button class="ai-action-btn ai-rate-btn" id="ai-rate-positive" title="Good summary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
                </svg>
              </button>
              <button class="ai-action-btn ai-rate-btn" id="ai-rate-negative" title="Poor summary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Position popup - make it more centered and responsive
    popup.style.position = 'fixed';
    popup.style.top = '20px';
    popup.style.right = '20px';
    popup.style.zIndex = '10001';
  popup.style.width = '440px';
  popup.style.maxWidth = 'min(440px, calc(100vw - 32px))';
  popup.style.maxHeight = '82vh';
  popup.style.display = 'flex';
  popup.style.flexDirection = 'column';
    popup.style.overflow = 'hidden';
    popup.style.borderRadius = '12px';
    popup.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.12)';
    popup.style.animation = 'slideInFromRight 0.3s ease-out';

  document.body.appendChild(popup);
    this.summaryPopup = popup;
    this.isPopupVisible = true;

    // Add event listeners
    this.addPopupEventListeners(note);
  }

  private addPopupEventListeners(note: Note): void {
    if (!this.summaryPopup) return;

    // Close button
    const closeBtn = this.summaryPopup.querySelector('#ai-close-popup');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.removeSummaryPopup());
    }

    // Save button
    const saveBtn = this.summaryPopup.querySelector('#ai-save-note');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveNote(note);
        saveBtn.textContent = '✓ Saved';
        saveBtn.setAttribute('disabled', 'true');
      });
    }

    // Rating buttons
    const positiveBtn = this.summaryPopup.querySelector('#ai-rate-positive');
    const negativeBtn = this.summaryPopup.querySelector('#ai-rate-negative');

    if (positiveBtn) {
      positiveBtn.addEventListener('click', () => {
        this.rateSummary(note.id, 'positive');
        (positiveBtn as HTMLElement).style.backgroundColor = '#4CAF50';
        negativeBtn?.setAttribute('disabled', 'true');
      });
    }

    if (negativeBtn) {
      negativeBtn.addEventListener('click', () => {
        this.rateSummary(note.id, 'negative');
        (negativeBtn as HTMLElement).style.backgroundColor = '#f44336';
        positiveBtn?.setAttribute('disabled', 'true');
      });
    }
  }

  private showErrorPopup(error: string): void {
    // Remove existing popup
    this.removeSummaryPopup();

    // Create error popup
    const popup = document.createElement('div');
    popup.id = 'ai-error-popup';
    popup.innerHTML = `
      <div class="ai-popup-header">
        <h3>Error</h3>
        <button class="ai-close-btn" id="ai-close-error">×</button>
      </div>
      <div class="ai-popup-content">
        <div class="ai-error-text">${error}</div>
      </div>
    `;

    // Position popup
    popup.style.position = 'fixed';
    popup.style.top = '20px';
    popup.style.right = '20px';
    popup.style.zIndex = '10001';
    popup.style.maxWidth = '300px';

    document.body.appendChild(popup);
    this.summaryPopup = popup;
    this.isPopupVisible = true;

    // Add close event listener
    const closeBtn = popup.querySelector('#ai-close-error');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.removeSummaryPopup());
    }
  }

  private removeSummaryPopup(): void {
    if (this.summaryPopup) {
      this.summaryPopup.remove();
      this.summaryPopup = null;
      this.isPopupVisible = false;
    }

    // Remove indicator
    const indicator = document.getElementById('ai-summarize-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  private handleOutsideClick(event: MouseEvent): void {
    if (this.summaryPopup && !this.summaryPopup.contains(event.target as Node)) {
      this.removeSummaryPopup();
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isPopupVisible) {
      this.removeSummaryPopup();
    }
  }

  private async saveNote(note: Note): Promise<void> {
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_NOTE',
        data: { note }
      });
    } catch (error) {
      console.error('Error saving note:', error);
    }
  }

  private async rateSummary(noteId: string, rating: 'positive' | 'negative'): Promise<void> {
    try {
      // Get the note and update its rating
      const response = await chrome.runtime.sendMessage({
        type: 'GET_NOTES'
      });

      if (response.notes) {
        const note = response.notes.find((n: Note) => n.id === noteId);
        if (note) {
          note.feedback = rating;
          note.updatedAt = new Date();
          
          await chrome.runtime.sendMessage({
            type: 'SAVE_NOTE',
            data: { note }
          });
        }
      }
    } catch (error) {
      console.error('Error rating summary:', error);
    }
  }
}

// Initialize content script
new ContentScript(); 