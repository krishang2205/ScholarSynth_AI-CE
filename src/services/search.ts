import { Note, SearchResult } from '../types';
import { storageService } from './storage';
import { aiService } from './ai';

class SearchService {
  private embeddingCache = new Map<string, number[]>();
  private searchCache = new Map<string, SearchResult[]>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private lastCacheCleanup = Date.now();

  async searchNotes(query: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      console.log('SearchService: Starting optimized search for query:', query);
      
      // Clean old cache entries
      this.cleanupCache();
      
      // Check cache first
      const cacheKey = `${query.toLowerCase()}_${limit}`;
      const cachedResults = this.searchCache.get(cacheKey);
      if (cachedResults) {
        console.log('SearchService: Returning cached results');
        return cachedResults;
      }

      // Generate embedding for the query
      console.log('SearchService: Generating query embedding...');
      let queryEmbedding: number[];
      try {
        queryEmbedding = await this.getCachedEmbedding(query);
        console.log('SearchService: Query embedding generated, length:', queryEmbedding.length);
      } catch (embeddingError) {
        console.error('SearchService: Failed to generate query embedding:', embeddingError);
        return this.optimizedTextBasedSearch(query, limit);
      }
      
      // Get all notes with their embeddings
      console.log('SearchService: Getting notes and embeddings...');
      const notes = await storageService.getAllNotes();
      const embeddings = await storageService.getAllEmbeddings();
      
      console.log('SearchService: Found', notes.length, 'notes and', embeddings.length, 'embeddings');
      
      // If no embeddings exist, use optimized text search
      if (embeddings.length === 0) {
        console.log('SearchService: No embeddings found, using optimized text-based search');
        return this.optimizedTextBasedSearch(query, limit);
      }
      
      // Create a map of note ID to embedding
      const embeddingMap = new Map<string, number[]>();
      embeddings.forEach(item => {
        embeddingMap.set(item.id, item.embedding);
      });

      // Calculate similarities with optimization
      const results: SearchResult[] = [];
      let vectorMismatchDetected = false;
      
      // Process notes in batches for better performance
      const batchSize = 50;
      for (let i = 0; i < notes.length; i += batchSize) {
        const batch = notes.slice(i, i + batchSize);
        
        for (const note of batch) {
          const noteEmbedding = embeddingMap.get(note.id);
          if (noteEmbedding) {
            try {
              // Check if embeddings have the same length
              if (queryEmbedding.length !== noteEmbedding.length) {
                console.warn(`Vector length mismatch for note ${note.id}: query=${queryEmbedding.length}, note=${noteEmbedding.length}`);
                vectorMismatchDetected = true;
                continue;
              }
              
              const similarity = this.optimizedCosineSimilarity(queryEmbedding, noteEmbedding);
              
              // Only add results with meaningful similarity
              if (similarity > 0.1) {
                results.push({
                  note,
                  similarity
                });
              }
            } catch (similarityError) {
              console.error('SearchService: Error calculating similarity for note', note.id, similarityError);
            }
          }
        }
      }

      // If vector mismatches were detected, regenerate embeddings and retry
      if (vectorMismatchDetected && results.length === 0) {
        console.log('SearchService: Vector mismatches detected, regenerating embeddings...');
        try {
          await this.regenerateEmbeddings();
          return this.searchNotes(query, limit);
        } catch (regenerationError) {
          console.error('SearchService: Failed to regenerate embeddings:', regenerationError);
          return this.optimizedTextBasedSearch(query, limit);
        }
      }

      console.log('SearchService: Calculated similarities for', results.length, 'notes');

      // Sort by similarity and return top results
      const finalResults = results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
        
      console.log('SearchService: Returning', finalResults.length, 'top results');
      
      // Cache the results
      this.searchCache.set(cacheKey, finalResults);
      
      return finalResults;
    } catch (error) {
      console.error('SearchService: Error in semantic search:', error);
      return this.optimizedTextBasedSearch(query, limit);
    }
  }

  private async getCachedEmbedding(text: string): Promise<number[]> {
    const cacheKey = `embedding_${text.toLowerCase()}`;
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const embedding = await aiService.generateEmbedding(text);
    this.embeddingCache.set(cacheKey, embedding);
    return embedding;
  }

  private optimizedCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    // Use a more efficient loop
    for (let i = 0; i < vecA.length; i++) {
      const a = vecA[i];
      const b = vecB[i];
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async optimizedTextBasedSearch(query: string, limit: number): Promise<SearchResult[]> {
    console.log('SearchService: Starting optimized text-based search for query:', query);
    const notes = await storageService.getAllNotes();
    const queryLower = query.toLowerCase();
    
    console.log('SearchService: Text search found', notes.length, 'notes');
    
    // Preprocess query for better matching
    const queryWords = this.preprocessQuery(queryLower);
    const results: SearchResult[] = [];
    
    for (const note of notes) {
      const searchText = this.preprocessText(`${note.title} ${note.content} ${note.summary} ${note.tags.join(' ')}`);
      
      // Enhanced scoring algorithm
      const score = this.calculateTextSimilarity(queryWords, searchText);
      
      if (score > 0.1) {
        results.push({
          note,
          similarity: score
        });
      }
    }

    console.log('SearchService: Text search found', results.length, 'matching notes');
    
    const finalResults = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
      
    console.log('SearchService: Text search returning', finalResults.length, 'top results');
    return finalResults;
  }

  private preprocessQuery(query: string): string[] {
    // Remove common words and normalize
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were']);
    return query
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .map(word => word.replace(/[^\w]/g, '').toLowerCase());
  }

  private preprocessText(text: string): string {
    return text.toLowerCase().replace(/[^\w\s]/g, ' ');
  }

  private calculateTextSimilarity(queryWords: string[], searchText: string): number {
    let totalScore = 0;
    let maxPossibleScore = queryWords.length;
    
    for (const word of queryWords) {
      if (searchText.includes(word)) {
        totalScore += 1;
      } else {
        // Fuzzy matching for similar words
        const similarWords = this.findSimilarWords(word, searchText);
        totalScore += similarWords * 0.5;
      }
    }
    
    return totalScore / maxPossibleScore;
  }

  private findSimilarWords(word: string, text: string): number {
    const textWords = text.split(/\s+/);
    let similarCount = 0;
    
    for (const textWord of textWords) {
      if (this.levenshteinDistance(word, textWord) <= 2) {
        similarCount++;
      }
    }
    
    return similarCount;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private cleanupCache(): void {
    const now = Date.now();
    if (now - this.lastCacheCleanup > this.CACHE_DURATION) {
      this.embeddingCache.clear();
      this.searchCache.clear();
      this.lastCacheCleanup = now;
      console.log('SearchService: Cache cleaned up');
    }
  }

  async searchByTags(tags: string[]): Promise<Note[]> {
    const notes = await storageService.getAllNotes();
    
    return notes.filter(note => {
      return tags.some(tag => 
        note.tags.some(noteTag => 
          noteTag.toLowerCase().includes(tag.toLowerCase())
        )
      );
    });
  }

  async searchByProject(projectId: string): Promise<Note[]> {
    return await storageService.getNotesByProject(projectId);
  }

  async searchByDateRange(startDate: Date, endDate: Date): Promise<Note[]> {
    const notes = await storageService.getAllNotes();
    
    return notes.filter(note => {
      const noteDate = new Date(note.createdAt);
      return noteDate >= startDate && noteDate <= endDate;
    });
  }

  async getRelatedNotes(noteId: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      const targetNote = await storageService.getNote(noteId);
      if (!targetNote) return [];

      const targetEmbedding = await storageService.getEmbedding(noteId);
      if (!targetEmbedding) return [];

      const notes = await storageService.getAllNotes();
      const embeddings = await storageService.getAllEmbeddings();
      
      const embeddingMap = new Map<string, number[]>();
      embeddings.forEach(item => {
        embeddingMap.set(item.id, item.embedding);
      });

      const results: SearchResult[] = [];
      
      for (const note of notes) {
        if (note.id === noteId) continue; // Skip the target note
        
        const noteEmbedding = embeddingMap.get(note.id);
        if (noteEmbedding) {
          const similarity = this.optimizedCosineSimilarity(targetEmbedding, noteEmbedding);
          results.push({
            note,
            similarity
          });
        }
      }

      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      console.error('Error finding related notes:', error);
      return [];
    }
  }

  async getPopularTopics(limit: number = 10): Promise<{ topic: string; count: number }[]> {
    const notes = await storageService.getAllNotes();
    const topicCount: { [key: string]: number } = {};
    
    notes.forEach(note => {
      note.tags.forEach(tag => {
        topicCount[tag] = (topicCount[tag] || 0) + 1;
      });
    });

    return Object.entries(topicCount)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getRecentNotes(limit: number = 10): Promise<Note[]> {
    const notes = await storageService.getAllNotes();
    
    return notes
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async getNotesByRating(minRating: number): Promise<Note[]> {
    const notes = await storageService.getAllNotes();
    
    return notes.filter(note => note.rating && note.rating >= minRating);
  }

  async regenerateEmbeddings(): Promise<void> {
    console.log('SearchService: Regenerating embeddings for all notes...');
    try {
      const notes = await storageService.getAllNotes();
      let regeneratedCount = 0;
      
      for (const note of notes) {
        try {
          const newEmbedding = await aiService.generateEmbedding(note.content);
          await storageService.saveEmbedding(note.id, newEmbedding);
          regeneratedCount++;
        } catch (error) {
          console.error(`Failed to regenerate embedding for note ${note.id}:`, error);
        }
      }
      
      console.log(`SearchService: Regenerated ${regeneratedCount} embeddings`);
    } catch (error) {
      console.error('SearchService: Error regenerating embeddings:', error);
    }
  }
}

export const searchService = new SearchService(); 