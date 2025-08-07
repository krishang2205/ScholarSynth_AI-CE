import { storageService } from '../services/storage';
import { aiService } from '../services/ai';
import { searchService } from '../services/search';
import { Note, UserProfile } from '../types';

// Initialize services
aiService.initialize();

// Local fallback functions when API is not available
function localSummarization(text: string): string {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const words = text.toLowerCase().split(/\s+/);
  const frequency: Record<string, number> = {};
  const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'a', 'an'];
  
  // Calculate word frequency (excluding stop words)
  words.forEach(word => {
    const cleanWord = word.replace(/[^\w]/g, '');
    if (cleanWord.length > 3 && !stopWords.includes(cleanWord)) {
      frequency[cleanWord] = (frequency[cleanWord] || 0) + 1;
    }
  });
  
  // Score sentences based on meaningful word frequency
  const scoredSentences = sentences.map(sentence => {
    const sentenceWords = sentence.toLowerCase().split(/\s+/).map(w => w.replace(/[^\w]/g, ''));
    const score = sentenceWords.reduce((sum, word) => {
      if (word.length > 3 && !stopWords.includes(word)) {
        return sum + (frequency[word] || 0);
      }
      return sum;
    }, 0);
    return { sentence: sentence.trim(), score };
  });
  
  // Get top sentences and create a more intelligent summary
  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.sentence);
  
  // Create a more natural summary by combining key concepts
  const keyWords = Object.entries(frequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
  
  let summary = topSentences.join('. ');
  
  // Add a brief overview if we have key concepts
  if (keyWords.length > 0) {
    summary = `This text discusses ${keyWords.slice(0, 3).join(', ')}. ${summary}`;
  }
  
  return summary + '.';
}

function localTopicExtraction(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/);
  const frequency: Record<string, number> = {};
  const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were'];
  
  words.forEach(word => {
    if (word.length > 4 && !stopWords.includes(word)) {
      frequency[word] = (frequency[word] || 0) + 1;
    }
  });
  
  return Object.entries(frequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
}

// Fallback function to show summary when content script injection fails
function showFallbackSummary(note: Note, summary: string): void {
  // Create a notification to show the summary
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'AI Summary Generated',
    message: `Summary: ${summary.substring(0, 100)}${summary.length > 100 ? '...' : ''}\n\nNote saved to your collection.`
  });
  
  console.log('Summary generated and note saved:', {
    title: note.title,
    summary: summary,
    content: note.content.substring(0, 100) + '...'
  });
}

// Create context menu on extension installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'summarizeWithAI',
    title: 'Summarize with ScholarSynth AI',
    contexts: ['selection']
  });

  // Initialize default user profile (will be set with userId when user logs in)
  // Note: This will be handled by the storage service when saveUserProfile is called
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'summarizeWithAI' && info.selectionText && tab?.id) {
    try {
      // Get user profile for context-aware summarization
      const userProfile = await storageService.getUserProfile();
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      let summary: string;
      let topics: string[];

      try {
        console.log('Attempting AI summarization with profile:', userProfile);
        // Try to generate summary with AI
        summary = await aiService.summarizeText(info.selectionText, userProfile);
        topics = await aiService.extractTopics(info.selectionText);
        console.log('AI summarization successful');
      } catch (aiError: any) {
        console.error('AI service failed, using local processing:', aiError);
        console.error('Error details:', aiError.message);
        // Fallback to local summarization if API fails
        summary = localSummarization(info.selectionText);
        topics = localTopicExtraction(info.selectionText);
        console.log('Using local summarization fallback');
      }

      // Get current user for note creation
      const currentUser = await storageService.getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      // Create note object
      const note: Note = {
        id: crypto.randomUUID(),
        userId: currentUser.id,
        title: `Summary from ${tab.title || 'Unknown Page'}`,
        content: info.selectionText,
        summary,
        source: tab.title || 'Unknown Page',
        url: tab.url || '',
        tags: topics,
        project: 'default',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save note and generate embedding
      await storageService.saveNote(note);
      const embedding = await aiService.generateEmbedding(note.content);
      await storageService.saveEmbedding(note.id, embedding);

      // Send message to content script to show summary
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'SHOW_SUMMARY',
          data: { note, summary }
        });
        console.log('Summary sent to content script successfully');
      } catch (messageError) {
        console.warn('Could not send message to content script, injecting script first:', messageError);
        
        // Try to inject content script first, then send message
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          console.log('Content script injected successfully');
          
          // Wait a bit for the content script to initialize
          setTimeout(async () => {
            try {
              if (tab?.id) {
                await chrome.tabs.sendMessage(tab.id, {
                  type: 'SHOW_SUMMARY',
                  data: { note, summary }
                });
                console.log('Summary sent to content script after injection');
              }
            } catch (retryError) {
              console.error('Failed to send message after script injection:', retryError);
              // Fallback: show summary in a new tab or notification
              showFallbackSummary(note, summary);
            }
          }, 200); // Increased wait time
        } catch (scriptError) {
          console.error('Failed to inject content script:', scriptError);
          // Fallback: show summary in a new tab or notification
          showFallbackSummary(note, summary);
        }
      }

    } catch (error) {
      console.error('Error processing summarization:', error);
      
      // Send error message to content script
      if (tab?.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'SHOW_ERROR',
            data: { error: 'Failed to generate summary. Please try again.' }
          });
        } catch (messageError) {
          console.warn('Could not send error message to content script:', messageError);
        }
      }
    }
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Important: Always return true for async operations to keep the message channel open
  const handleMessage = async () => {
    try {
      switch (message.type) {
        case 'GET_NOTES':
          const notes = await storageService.getAllNotes();
          sendResponse({ notes });
          break;

        case 'SAVE_NOTE':
          try {
            await storageService.saveNote(message.data.note);
            sendResponse({ success: true });
          } catch (error: any) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'DELETE_NOTE':
          try {
            await storageService.deleteNote(message.data.id);
            sendResponse({ success: true });
          } catch (error: any) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_USER_PROFILE':
          const profile = await storageService.getUserProfile();
          sendResponse({ profile });
          break;

        case 'SAVE_USER_PROFILE':
          try {
            console.log('Background: Saving user profile:', message.data.profile);
            await storageService.saveUserProfile(message.data.profile);
            console.log('Background: Profile saved successfully');
            sendResponse({ success: true });
          } catch (error: any) {
            console.error('Background: Error saving profile:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_PROJECTS':
          const projects = await storageService.getAllProjects();
          sendResponse({ projects });
          break;

        case 'SAVE_PROJECT':
          try {
            await storageService.saveProject(message.data.project);
            sendResponse({ success: true });
          } catch (error: any) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'SET_API_KEY':
          try {
            aiService.setApiKey(message.data.apiKey);
            await storageService.saveSettings({ geminiApiKey: message.data.apiKey });
            await aiService.initialize();
            
            // Test the API key immediately
            try {
              console.log('Testing API key...');
              const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${message.data.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{
                    parts: [{ text: 'Hello, this is a test. Please respond with "API key working!"' }]
                  }]
                })
              });
              
              if (testResponse.ok) {
                const testResult = await testResponse.json();
                console.log('API key test successful:', testResult);
              } else {
                const errorText = await testResponse.text();
                console.error('API key test failed:', testResponse.status, errorText);
              }
            } catch (testError) {
              console.error('API key test error:', testError);
            }
            
            sendResponse({ success: true });
          } catch (error: any) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_SETTINGS':
          const settings = await storageService.getSettings();
          sendResponse({ settings });
          break;

        case 'SEARCH_NOTES':
          try {
            console.log('Background: Starting search for query:', message.data.query);
            const results = await searchService.searchNotes(message.data.query, message.data.limit);
            console.log('Background: Search completed, found', results.length, 'results');
            sendResponse({ results });
          } catch (error: any) {
            console.error('Background: Search error:', error);
            sendResponse({ error: error.message });
          }
          break;

        case 'REGENERATE_EMBEDDINGS':
          try {
            console.log('Background: Starting embedding regeneration...');
            await searchService.regenerateEmbeddings();
            console.log('Background: Embedding regeneration completed');
            sendResponse({ success: true });
          } catch (error: any) {
            console.error('Background: Embedding regeneration error:', error);
            sendResponse({ error: error.message });
          }
          break;

        case 'ANSWER_QUERY':
          try {
            const userProfile = await storageService.getUserProfile();
            if (!userProfile) {
              sendResponse({ error: 'User profile not found' });
              return;
            }

            const answer = await aiService.answerQuery(message.data.query, message.data.context, userProfile);
            sendResponse({ answer });
          } catch (error: any) {
            sendResponse({ error: error.message });
          }
          break;

        case 'GET_CHAT_MESSAGES':
          try {
            const messages = await storageService.getChatMessages(message.data?.limit || 50);
            sendResponse({ messages });
          } catch (error: any) {
            sendResponse({ error: error.message });
          }
          break;

        case 'SAVE_CHAT_MESSAGE':
          try {
            await storageService.saveChatMessage(message.data.message);
            sendResponse({ success: true });
          } catch (error: any) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'TEST_API_KEY':
          try {
            await aiService.initialize();
            const currentUser = await storageService.getCurrentUser();
            const testProfile: UserProfile = {
              userId: currentUser?.id || 'test-user',
              topics: ['test'],
              style: 'academic',
              verbosity: 'detailed',
              preferredLength: 'short',
              researchFocus: [],
              createdAt: new Date(),
              updatedAt: new Date()
            };
            const testSummary = await aiService.summarizeText(
              'This is a test text to check if the API key is working correctly.',
              testProfile
            );
            sendResponse({ success: true, result: testSummary });
          } catch (error: any) {
            sendResponse({ success: false, error: error.message || 'Unknown error' });
          }
          break;

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error: any) {
      console.error('Message handling error:', error);
      sendResponse({ error: error.message || 'Internal error' });
    }
  };

  // Execute the async handler
  handleMessage();
  
  // Return true to indicate that we will send a response asynchronously
  return true;
});

// Handle tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    }).catch((error) => {
      // Content script might already be injected or the page doesn't allow it
      console.log('Content script injection note:', error.message);
    });
  }
});

// Also inject content script when extension starts
chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id && tab.url && tab.url.startsWith('http')) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).catch(() => {
          // Ignore errors for already injected scripts
        });
      }
    });
  });
}); 