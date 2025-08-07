// Utility for reliable Chrome runtime messaging
export const sendRuntimeMessage = async (message: any, retries = 2): Promise<any> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Check if runtime is available
      if (!chrome.runtime?.id) {
        throw new Error('Extension runtime not available');
      }

      const response = await chrome.runtime.sendMessage(message);
      
      // Check if response indicates an error
      if (response && response.error) {
        throw new Error(response.error);
      }
      
      return response;
    } catch (error: any) {
      console.warn(`Message attempt ${attempt + 1} failed:`, error);
      
      // If it's the last attempt or a critical error, throw
      if (attempt === retries || error.message?.includes('Extension context invalidated')) {
        throw error;
      }
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 100));
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
