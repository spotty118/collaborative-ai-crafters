
/**
 * Vector Store Service
 * 
 * Interface to a vector database for storing and querying embeddings.
 * This is a simplified in-memory implementation for demonstration.
 * In production, it would connect to a vector DB like Pinecone, Milvus, etc.
 */

export type VectorDBProvider = 'memory' | 'pinecone' | 'milvus' | 'qdrant';

export interface VectorStoreConfig {
  provider?: VectorDBProvider;
  host?: string;
  port?: number;
  apiKey?: string;
  namespace?: string;
  indexName?: string;
  dimensions?: number;
}

export interface VectorItem {
  id?: string;
  userId: string;
  embedding: number[];
  metadata?: Record<string, any>;
  text?: string;
  rawData?: any;
}

export interface SearchParams {
  userId: string;
  embedding: number[];
  limit?: number;
  minSimilarity?: number;
  filter?: Record<string, any> | null;
}

export interface SearchResult {
  id: string;
  score: number;
  userId: string;
  metadata: Record<string, any>;
  text?: string;
  rawData?: any;
}

class VectorStore {
  private provider: VectorDBProvider;
  private connectionConfig: {
    host?: string;
    port?: number;
    apiKey?: string;
    namespace: string;
    indexName: string;
    dimensions: number;
  };
  
  // In-memory storage for the mock implementation
  private items: Map<string, any>;
  
  constructor(config: VectorStoreConfig = {}) {
    this.provider = config.provider || 'memory';
    this.connectionConfig = {
      host: config.host,
      port: config.port,
      apiKey: config.apiKey,
      namespace: config.namespace || 'default',
      indexName: config.indexName || 'agent-memory',
      dimensions: config.dimensions || 1536  // Default for many embedding models
    };
    
    // Initialize in-memory storage
    this.items = new Map();
  }

  /**
   * Add an item to the vector store
   */
  async addItem(item: VectorItem): Promise<string> {
    try {
      // Validate the item
      if (!item.userId || !item.embedding) {
        throw new Error('UserId and embedding are required');
      }
      
      // Generate an ID if not provided
      const id = item.id || `${item.userId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // Store the item
      this.items.set(id, {
        id,
        userId: item.userId,
        embedding: item.embedding,
        metadata: item.metadata || {},
        text: item.text || '',
        rawData: item.rawData || {},
        timestamp: new Date().toISOString()
      });
      
      return id;
    } catch (error) {
      console.error('Error adding item to vector store:', error);
      throw error;
    }
  }

  /**
   * Search for similar items in the vector store
   */
  async search(params: SearchParams): Promise<SearchResult[]> {
    try {
      // Validate search parameters
      if (!params.userId || !params.embedding) {
        throw new Error('UserId and embedding are required for search');
      }
      
      const {
        userId,
        embedding,
        limit = 10,
        minSimilarity = 0.7,
        filter = null
      } = params;
      
      // In-memory search implementation
      const results: SearchResult[] = [];
      
      // Filter by userId
      for (const [id, item] of this.items.entries()) {
        if (item.userId === userId) {
          // Apply additional filters if provided
          if (filter && !this._matchesFilter(item, filter)) {
            continue;
          }
          
          // Calculate cosine similarity
          const similarity = this._cosineSimilarity(embedding, item.embedding);
          
          // Only include results above the similarity threshold
          if (similarity >= minSimilarity) {
            results.push({
              id,
              score: similarity,
              userId: item.userId,
              metadata: item.metadata || {},
              text: item.text,
              rawData: item.rawData
            });
          }
        }
      }
      
      // Sort by similarity (highest first) and limit results
      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      console.error('Error searching vector store:', error);
      throw error;
    }
  }

  /**
   * Delete items from the vector store
   */
  async deleteItems(userId: string, ids: string[]): Promise<boolean> {
    try {
      if (!userId || !ids || !Array.isArray(ids)) {
        throw new Error('UserId and array of IDs are required for deletion');
      }
      
      let deletedCount = 0;
      
      // Delete items that match both userId and id
      for (const id of ids) {
        const item = this.items.get(id);
        
        if (item && item.userId === userId) {
          this.items.delete(id);
          deletedCount++;
        }
      }
      
      return deletedCount > 0;
    } catch (error) {
      console.error('Error deleting items from vector store:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private _cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same dimensions');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }

  /**
   * Check if an item matches a filter
   */
  private _matchesFilter(item: any, filter: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      // Check metadata
      if (key.startsWith('metadata.')) {
        const metadataKey = key.substring(9);
        if (item.metadata[metadataKey] !== value) {
          return false;
        }
      } 
      // Check direct properties
      else if (item[key] !== value) {
        return false;
      }
    }
    
    return true;
  }
}

export default VectorStore;
