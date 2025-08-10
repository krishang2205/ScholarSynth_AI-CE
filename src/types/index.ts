export interface Note {
  id: string;
  userId: string; // Add user identification
  title: string;
  content: string;
  summary: string;
  source: string;
  url: string;
  tags: string[];
  project: string;
  createdAt: Date;
  updatedAt: Date;
  rating?: number; // 1-5 scale
  feedback?: 'positive' | 'negative';
  embedding?: number[];
}

export interface UserProfile {
  userId: string; // Add user identification
  topics: string[];
  style: 'academic' | 'casual' | 'technical' | 'creative';
  verbosity: 'concise' | 'detailed' | 'comprehensive';
  preferredLength: 'short' | 'medium' | 'long';
  researchFocus: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  userId: string; // Add user identification
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  relatedNotes?: string[]; // Note IDs
  streaming?: boolean; // transient ui state
}

export interface Project {
  id: string;
  userId: string; // Add user identification
  name: string;
  description: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export interface EmbeddingResponse {
  embedding: {
    values: number[];
  };
}

export interface SearchResult {
  note: Note;
  similarity: number;
}

export interface VisualizationData {
  nodes: Array<{
    id: string;
    label: string;
    type: 'topic' | 'note' | 'project';
    size: number;
    color: string;
  }>;
  links: Array<{
    source: string;
    target: string;
    strength: number;
  }>;
} 