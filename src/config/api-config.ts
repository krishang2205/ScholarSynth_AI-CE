// API Configuration for ScholarSynth AI
export const API_CONFIG = {
  // Gemini API configuration
  GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY_HERE', // Replace with actual API key
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
  
  // Embedding API configuration  
  EMBEDDING_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent',
  
  // API settings
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.7,
  TOP_K: 40,
  TOP_P: 0.95,
  
  // Rate limiting
  REQUESTS_PER_MINUTE: 60,
  
  // Default prompts
  SUMMARIZATION_PROMPT: 'Please provide a clear and concise summary of the following text, focusing on the key points and main ideas:',
  TOPIC_EXTRACTION_PROMPT: 'Extract the main topics and keywords from the following text. Provide them as a comma-separated list:'
};

// Type definitions for API configuration
export interface APIConfig {
  GEMINI_API_KEY: string;
  GEMINI_API_URL: string;
  EMBEDDING_API_URL: string;
  MAX_TOKENS: number;
  TEMPERATURE: number;
  TOP_K: number;
  TOP_P: number;
  REQUESTS_PER_MINUTE: number;
  SUMMARIZATION_PROMPT: string;
  TOPIC_EXTRACTION_PROMPT: string;
}