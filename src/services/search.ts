import { Note, SearchResult } from '../types';
import { storageService } from './storage';
import { aiService } from './ai';

class SearchService {
  async searchNotes(query: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      console.log('SearchService: Starting search for query:', query);
      
      // Generate embedding for the query
      console.log('SearchService: Generating query embedding...');
      let queryEmbedding: number[];
      try {
        queryEmbedding = await aiService.generateEmbedding(query);
        console.log('SearchService: Query embedding generated, length:', queryEmbedding.length);
      } catch (embeddingError) {
        console.error('SearchService: Failed to generate query embedding:', embeddingError);
        // Fallback to text-based search immediately
        console.log('SearchService: Falling back to text-based search due to embedding error');
        return this.textBasedSearch(query, limit);
      }
      
      // Get all notes with their embeddings
      console.log('SearchService: Getting notes and embeddings...');
      const notes = await storageService.getAllNotes();
      const embeddings = await storageService.getAllEmbeddings();
      
      console.log('SearchService: Found', notes.length, 'notes and', embeddings.length, 'embeddings');
      
      // If no embeddings exist, fallback to text search
      if (embeddings.length === 0) {
        console.log('SearchService: No embeddings found, using text-based search');
        return this.textBasedSearch(query, limit);
      }
      
      // Create a map of note ID to embedding
      const embeddingMap = new Map<string, number[]>();
      embeddings.forEach(item => {
        embeddingMap.set(item.id, item.embedding);
      });

      // Calculate similarities
      const results: SearchResult[] = [];
      let vectorMismatchDetected = false;
      
      for (const note of notes) {
        const noteEmbedding = embeddingMap.get(note.id);
        if (noteEmbedding) {
          try {
            // Check if embeddings have the same length
            if (queryEmbedding.length !== noteEmbedding.length) {
              console.warn(`Vector length mismatch for note ${note.id}: query=${queryEmbedding.length}, note=${noteEmbedding.length}`);
              vectorMismatchDetected = true;
              // Skip this note and continue with others
              continue;
            }
            
            const similarity = this.cosineSimilarity(queryEmbedding, noteEmbedding);
            results.push({
              note,
              similarity
            });
          } catch (similarityError) {
            console.error('SearchService: Error calculating similarity for note', note.id, similarityError);
            // Skip this note and continue with others
          }
        }
      }

      // If vector mismatches were detected, regenerate embeddings and retry
      if (vectorMismatchDetected && results.length === 0) {
        console.log('SearchService: Vector mismatches detected, regenerating embeddings...');
        try {
          await this.regenerateEmbeddings();
          // Retry the search with regenerated embeddings
          return this.searchNotes(query, limit);
        } catch (regenerationError) {
          console.error('SearchService: Failed to regenerate embeddings:', regenerationError);
          // Fallback to text-based search
          return this.textBasedSearch(query, limit);
        }
      }

      console.log('SearchService: Calculated similarities for', results.length, 'notes');

      // Sort by similarity and return top results
      const finalResults = results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
        
      console.log('SearchService: Returning', finalResults.length, 'top results');
      return finalResults;
    } catch (error) {
      console.error('SearchService: Error in semantic search:', error);
      // Fallback to text-based search
      console.log('SearchService: Falling back to text-based search');
      return this.textBasedSearch(query, limit);
    }
  }

  private async textBasedSearch(query: string, limit: number): Promise<SearchResult[]> {
    console.log('SearchService: Starting text-based search for query:', query);
    const notes = await storageService.getAllNotes();
    const queryLower = query.toLowerCase();
    
    console.log('SearchService: Text search found', notes.length, 'notes');
    
    const results: SearchResult[] = [];
    
    for (const note of notes) {
      const searchText = `${note.title} ${note.content} ${note.summary} ${note.tags.join(' ')}`.toLowerCase();
      
      // Simple keyword matching
      const queryWords = queryLower.split(/\s+/);
      let matchCount = 0;
      
      queryWords.forEach(word => {
        if (searchText.includes(word)) {
          matchCount++;
        }
      });
      
      const similarity = matchCount / queryWords.length;
      
      if (similarity > 0) {
        results.push({
          note,
          similarity
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

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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
          const similarity = this.cosineSimilarity(targetEmbedding, noteEmbedding);
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