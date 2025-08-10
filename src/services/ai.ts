import { GeminiResponse, EmbeddingResponse, UserProfile } from '../types';
import { storageService } from './storage';
import { API_CONFIG } from '../config/api-config';

class AIService {
  private geminiApiKey: string | null = null;
  private readonly GEMINI_API_URL = API_CONFIG.GEMINI_API_URL;
  private readonly EMBEDDING_API_URL = API_CONFIG.EMBEDDING_API_URL;
  
  // Built-in API key from config file
  private readonly BUILT_IN_API_KEY = API_CONFIG.GEMINI_API_KEY;

  async initialize(): Promise<void> {
    // First try to get user-provided API key from settings
    const settings = await storageService.getSettings();
    this.geminiApiKey = settings.geminiApiKey || this.BUILT_IN_API_KEY;
    
    console.log('AI Service initialized. Using:', this.geminiApiKey === this.BUILT_IN_API_KEY ? 'Built-in API key' : 'User-provided API key');
    console.log('Has API key:', !!this.geminiApiKey);
    if (this.geminiApiKey && this.geminiApiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
      console.log('API key length:', this.geminiApiKey.length);
    }
  }

  private async makeGeminiRequest(url: string, data: any): Promise<any> {
    if (!this.geminiApiKey || this.geminiApiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      throw new Error('Gemini API key not configured. Please contact the developer or add your own API key in Settings.');
    }

    try {
      const response = await fetch(`${url}?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error details:', errorText);
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}. Please check the API key configuration.`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error && error.message.includes('API key')) {
        throw error;
      }
      throw new Error('Failed to connect to Gemini API. Please check your internet connection.');
    }
  }

  async summarizeText(
    text: string,
    userProfile: UserProfile,
    context?: string
  ): Promise<string> {
    try {
      const prompt = this.buildSummarizationPrompt(text, userProfile, context);
      
      const data = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: this.getMaxTokens(userProfile.preferredLength),
        }
      };

      const response: GeminiResponse = await this.makeGeminiRequest(this.GEMINI_API_URL, data);
      
      if (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
        const summary = response.candidates[0].content.parts[0].text.trim();
        
        // Quality check: ensure the summary is different from the original
        if (this.isSummaryQualityGood(text, summary)) {
          return summary;
        } else {
          console.warn('AI summary too similar to original, using improved local fallback');
          return this.improvedLocalSummarization(text, userProfile);
        }
      } else {
        throw new Error('Invalid response from Gemini API');
      }
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      // Fallback to local summarization
      return this.localSummarization(text, userProfile);
    }
  }

  private buildSummarizationPrompt(
    text: string,
    userProfile: UserProfile,
    context?: string
  ): string {
    const topics = userProfile.topics.join(', ');
    const style = userProfile.style;
    const verbosity = userProfile.verbosity;
    
    let prompt = `You are an expert summarization assistant specialized in research and academic content. Your task is to create a meaningful, condensed summary that captures the key points while using different vocabulary and phrasing than the original text.

IMPORTANT INSTRUCTIONS:
- DO NOT copy sentences verbatim from the original text
- Use different words and sentence structures
- Paraphrase and rephrase the content
- Focus on the main ideas and key insights
- Make the summary more concise and clear than the original

User Research Focus: ${topics}
Preferred Style: ${style}
Verbosity Level: ${verbosity}

${context ? `Context from previous research: ${context}\n\n` : ''}
Please provide a well-written summary of the following content:

"""${text}"""

Summary (use different vocabulary and sentence structure):`;

    return prompt;
  }

  private getMaxTokens(length: string): number {
    switch (length) {
      case 'short': return 150;
      case 'medium': return 300;
      case 'long': return 600;
      default: return 300;
    }
  }

  private async localSummarization(text: string, userProfile: UserProfile): Promise<string> {
    // Improved extractive summarization as fallback
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'a', 'an'];
    
    // Improved keyword extraction (excluding stop words)
    const wordFreq: { [key: string]: number } = {};
    words.forEach(word => {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (cleanWord.length > 3 && !stopWords.includes(cleanWord)) {
        wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
      }
    });

    // Score sentences based on meaningful keyword frequency
    const sentenceScores = sentences.map(sentence => {
      const sentenceWords = sentence.toLowerCase().split(/\s+/).map(w => w.replace(/[^\w]/g, ''));
      const score = sentenceWords.reduce((sum, word) => {
        if (word.length > 3 && !stopWords.includes(word)) {
          return sum + (wordFreq[word] || 0);
        }
        return sum;
      }, 0);
      return { sentence, score };
    });

    // Sort by score and take top sentences
    const topSentences = sentenceScores
      .sort((a, b) => b.score - a.score)
      .slice(0, this.getSentenceCount(userProfile.preferredLength))
      .map(item => item.sentence.trim());

    // Create a more intelligent summary
    const keyWords = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([word]) => word);

    let summary = topSentences.join('. ');
    
    // Add context if we have key concepts
    if (keyWords.length > 0) {
      summary = `This content focuses on ${keyWords.join(', ')}. ${summary}`;
    }

    return summary + '.';
  }

  private getSentenceCount(length: string): number {
    switch (length) {
      case 'short': return 2;
      case 'medium': return 4;
      case 'long': return 6;
      default: return 4;
    }
  }

  private isSummaryQualityGood(originalText: string, summary: string): boolean {
    // Check if summary is too similar to original text
    const originalWords = new Set(originalText.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const summaryWords = new Set(summary.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    // Calculate word overlap
    const intersection = new Set([...originalWords].filter(x => summaryWords.has(x)));
    const overlapRatio = intersection.size / Math.min(originalWords.size, summaryWords.size);
    
    // If more than 70% of words overlap, the summary is too similar
    return overlapRatio < 0.7;
  }

  private async improvedLocalSummarization(text: string, userProfile: UserProfile): Promise<string> {
    // Enhanced local summarization with better paraphrasing
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'a', 'an'];
    
    // Extract key concepts
    const wordFreq: { [key: string]: number } = {};
    words.forEach(word => {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (cleanWord.length > 3 && !stopWords.includes(cleanWord)) {
        wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
      }
    });

    // Get key concepts
    const keyConcepts = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);

    // Create a conceptual summary
    const sentenceCount = this.getSentenceCount(userProfile.preferredLength);
    const topSentences = sentences.slice(0, sentenceCount);
    
    // Build a more natural summary
    let summary = '';
    if (keyConcepts.length > 0) {
      summary = `The text explores ${keyConcepts.slice(0, 3).join(', ')}. `;
    }
    
    summary += `Key points include: ${topSentences.join(' Additionally, ')}.`;
    
    return summary;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const data = {
        model: 'models/embedding-001',
        content: {
          parts: [{
            text: text
          }]
        }
      };

      const response: EmbeddingResponse = await this.makeGeminiRequest(this.EMBEDDING_API_URL, data);
      
      if (response.embedding?.values) {
        // Ensure the embedding has exactly 128 dimensions
        const embedding = response.embedding.values;
        if (embedding.length !== 128) {
          console.warn(`API embedding length (${embedding.length}) doesn't match expected (128), using local fallback`);
          return this.localEmbedding(text);
        }
        return embedding;
      } else {
        throw new Error('Invalid embedding response');
      }
    } catch (error) {
      console.error('Error calling Gemini embedding API:', error);
      // Fallback to local embedding
      return this.localEmbedding(text);
    }
  }

  private async localEmbedding(text: string): Promise<number[]> {
    // Simple TF-IDF based embedding as fallback
    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const wordFreq: { [key: string]: number } = {};
    
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    // Create a simple 128-dimensional embedding
    const embedding = new Array(128).fill(0);
    const wordsArray = Object.keys(wordFreq);
    
    wordsArray.forEach((word, index) => {
      const hash = this.simpleHash(word);
      const position = hash % 128;
      embedding[position] += wordFreq[word];
    });

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  async answerQuery(
    query: string,
    relevantNotes: string[],
    userProfile: UserProfile
  ): Promise<string> {
    try {
      const context = relevantNotes.join('\n\n');
      
      const prompt = `You are a helpful research assistant. Answer the user's question based on the provided context and their research focus.

User Research Focus: ${userProfile.topics.join(', ')}
Preferred Style: ${userProfile.style}

Context from saved notes:
${context}

User Question: ${query}

Answer:`;

      const data = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.4,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 800,
        }
      };

      const response: GeminiResponse = await this.makeGeminiRequest(this.GEMINI_API_URL, data);
      
      if (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
        return response.candidates[0].content.parts[0].text.trim();
      } else {
        throw new Error('Invalid response from Gemini API');
      }
    } catch (error) {
      console.error('Error calling Gemini API for query:', error);
      return 'I apologize, but I encountered an error while processing your query. Please try again or check your API configuration.';
    }
  }

  async answerQueryStream(
    query: string,
    relevantNotes: string[],
    userProfile: UserProfile,
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    // Currently Gemini REST here doesn't expose streaming via this wrapper; simulate chunking
    const full = await this.answerQuery(query, relevantNotes, userProfile);
    if (signal?.aborted) throw new Error('aborted');
    const words = full.split(/(\s+)/); // keep spaces
    let assembled = '';
    for (let i = 0; i < words.length; i += 10) {
      if (signal?.aborted) throw new Error('aborted');
      const chunk = words.slice(i, i + 10).join('');
      assembled += chunk;
      onChunk(chunk);
      await new Promise(r => setTimeout(r, 40));
    }
    return assembled;
  }

  async extractTopics(text: string): Promise<string[]> {
    try {
      const prompt = `Extract the main topics and key concepts from the following text. Return only the topics as a comma-separated list, without explanations.

Text: """${text}"""

Topics:`;

      const data = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          topK: 20,
          topP: 0.9,
          maxOutputTokens: 100,
        }
      };

      const response: GeminiResponse = await this.makeGeminiRequest(this.GEMINI_API_URL, data);
      
      if (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
        const topicsText = response.candidates[0].content.parts[0].text.trim();
        return topicsText.split(',').map(topic => topic.trim()).filter(topic => topic.length > 0);
      } else {
        throw new Error('Invalid response from Gemini API');
      }
    } catch (error) {
      console.error('Error extracting topics:', error);
      // Fallback to simple keyword extraction
      return this.localTopicExtraction(text);
    }
  }

  private localTopicExtraction(text: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const wordFreq: { [key: string]: number } = {};
    
    words.forEach(word => {
      if (word.length > 4 && !this.isStopWord(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    return Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'];
    return stopWords.includes(word);
  }

  setApiKey(apiKey: string): void {
    this.geminiApiKey = apiKey;
    console.log('API key set directly. Length:', apiKey ? apiKey.length : 0);
  }

  hasApiKey(): boolean {
    return !!this.geminiApiKey;
  }
}

export const aiService = new AIService(); 