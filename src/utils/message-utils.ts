// Utility for reliable Chrome runtime messaging
export const sendRuntimeMessage = async (message: any, retries = 3): Promise<any> => {
  let delay = 80;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (!chrome.runtime?.id) throw new Error('Extension runtime not available');
      const response = await chrome.runtime.sendMessage(message);
      if (response && response.error) throw new Error(response.error);
      return response;
    } catch (error: any) {
      const msg = error?.message || '';
      console.warn(`[Messaging] Attempt ${attempt + 1} failed for type=${message?.type}:`, msg);
      const terminal = attempt === retries || msg.includes('Extension context invalidated');
      if (terminal) throw error;
      // Backoff a bit longer for the common race where the service worker is cold starting
      if (msg.includes('Could not establish connection') || msg.includes('Receiving end does not exist')) {
        delay += 120; // extend backoff
      }
      await new Promise(r => setTimeout(r, delay));
    }
  }
};

// Check if extension context is valid
export const isExtensionContextValid = (): boolean => {
  try {
    return !!(chrome.runtime && chrome.runtime.id);
  } catch (error) {
    return false;
  }
};

// Safe message sender with context validation
export const safeSendMessage = async (message: any): Promise<any> => {
  if (!isExtensionContextValid()) {
    throw new Error('Extension context is invalid. Please reload the extension.');
  }
  
  return sendRuntimeMessage(message);
};
