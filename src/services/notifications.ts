/**
 * User Notification Service for Toast Messages and Alerts
 */

export interface NotificationConfig {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  persistent?: boolean;
}

class NotificationService {
  private notifications: Map<string, HTMLElement> = new Map();
  private container: HTMLElement | null = null;

  constructor() {
    this.createContainer();
  }

  /**
   * Create notification container
   */
  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    `;
    document.body.appendChild(this.container);
  }

  /**
   * Show notification
   */
  show(config: NotificationConfig): string {
    const id = Date.now().toString();
    const notification = this.createNotification(id, config);
    
    if (this.container) {
      this.container.appendChild(notification);
      this.notifications.set(id, notification);

      // Auto-remove after duration
      if (!config.persistent) {
        setTimeout(() => {
          this.remove(id);
        }, config.duration || 5000);
      }
    }

    return id;
  }

  /**
   * Create notification element
   */
  private createNotification(id: string, config: NotificationConfig): HTMLElement {
    const notification = document.createElement('div');
    notification.style.cssText = `
      min-width: 320px;
      max-width: 400px;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      opacity: 0;
      transform: translateX(100%) scale(0.8);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      pointer-events: auto;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    `;

    // Set background color based on type
    const colors = {
      success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
    };

    notification.style.background = colors[config.type];

    // Add content
    notification.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="flex-shrink: 0; margin-top: 2px;">
          ${this.getIcon(config.type)}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; margin-bottom: 4px; font-size: 15px;">
            ${config.title}
          </div>
          <div style="opacity: 0.9; word-wrap: break-word;">
            ${config.message}
          </div>
        </div>
        <button style="
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s ease;
          flex-shrink: 0;
        " onclick="notificationService.remove('${id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    `;

    // Add click to dismiss
    notification.addEventListener('click', () => {
      this.remove(id);
    });

    // Trigger animation
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0) scale(1)';
    });

    return notification;
  }

  /**
   * Get icon for notification type
   */
  private getIcon(type: string): string {
    const icons = {
      success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
      info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'
    };
    return icons[type as keyof typeof icons] || icons.info;
  }

  /**
   * Remove notification
   */
  remove(id: string): void {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%) scale(0.8)';
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        this.notifications.delete(id);
      }, 300);
    }
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this.notifications.forEach((_, id) => {
      this.remove(id);
    });
  }

  /**
   * Predefined notification methods
   */
  success(title: string, message: string, duration?: number): string {
    return this.show({
      type: 'success',
      title,
      message,
      duration
    });
  }

  error(title: string, message: string, duration?: number): string {
    return this.show({
      type: 'error',
      title,
      message,
      duration: duration || 7000
    });
  }

  warning(title: string, message: string, duration?: number): string {
    return this.show({
      type: 'warning',
      title,
      message,
      duration
    });
  }

  info(title: string, message: string, duration?: number): string {
    return this.show({
      type: 'info',
      title,
      message,
      duration
    });
  }
}

// Create global instance
export const notificationService = new NotificationService();

// Make it globally available for onclick handlers
(window as any).notificationService = notificationService;
