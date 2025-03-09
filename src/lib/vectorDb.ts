
import { supabase } from '@/integrations/supabase/client';

export interface EmbeddingRecord {
  id?: string;
  content: string;
  embedding: string; // Stored as string to match Supabase's vector type
  metadata?: Record<string, any>;
  project_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
}

/**
 * VectorDatabase class for handling embeddings and similarity search
 */
export class VectorDatabase {
  /**
   * Generate a simple embedding for text content
   * @param text The text to generate an embedding for
   * @returns A vector embedding (array of floats)
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Create a simple embedding vector based on the text
      // This is a simplified approach - in production you would use a proper embedding model
      const embedding = new Array(1536).fill(0);
      const textEncoder = new TextEncoder();
      const encoded = textEncoder.encode(text);
      
      // Create a deterministic embedding based on character codes
      for (let i = 0; i < encoded.length; i++) {
        embedding[i % 1536] = encoded[i] / 255;
      }
      
      return embedding;
    } catch (error) {
      console.error('Error generating simple embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Store text content with its embedding in the database
   * @param projectId The project ID to associate with this embedding
   * @param content The text content to store
   * @param metadata Optional metadata to store with the embedding
   * @returns The created embedding record
   */
  static async storeEmbedding(
    projectId: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<EmbeddingRecord> {
    try {
      const embeddingArray = await this.generateEmbedding(content);
      // Convert the number[] to a string for Supabase's vector type
      const embeddingString = JSON.stringify(embeddingArray);
      
      const { data, error } = await supabase
        .from('embeddings')
        .insert({
          content,
          embedding: embeddingString,
          metadata,
          project_id: projectId
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return data as EmbeddingRecord;
    } catch (error) {
      console.error('Error storing embedding:', error);
      throw new Error('Failed to store embedding in the database');
    }
  }

  /**
   * Search for similar content using an embedding
   * @param projectId The project ID to search within
   * @param queryText The text to search for
   * @param threshold The similarity threshold (0-1)
   * @param limit Maximum number of results to return
   * @returns Array of search results ordered by similarity
   */
  static async searchSimilar(
    projectId: string,
    queryText: string,
    threshold = 0.7,
    limit = 5
  ): Promise<SearchResult[]> {
    try {
      const queryEmbeddingArray = await this.generateEmbedding(queryText);
      const queryEmbeddingString = JSON.stringify(queryEmbeddingArray);
      
      const { data, error } = await supabase
        .rpc('match_embeddings', {
          query_embedding: queryEmbeddingString,
          match_threshold: threshold,
          match_count: limit,
          project_filter: projectId
        });
      
      if (error) {
        throw error;
      }
      
      return data as SearchResult[];
    } catch (error) {
      console.error('Error searching embeddings:', error);
      throw new Error('Failed to search similar content');
    }
  }

  /**
   * Get all embeddings for a project
   * @param projectId The project ID
   * @returns Array of embedding records
   */
  static async getProjectEmbeddings(projectId: string): Promise<EmbeddingRecord[]> {
    try {
      const { data, error } = await supabase
        .from('embeddings')
        .select('*')
        .eq('project_id', projectId);
      
      if (error) {
        throw error;
      }
      
      return data as EmbeddingRecord[];
    } catch (error) {
      console.error('Error getting project embeddings:', error);
      throw new Error('Failed to retrieve project embeddings');
    }
  }

  /**
   * Delete an embedding by ID
   * @param id The embedding ID to delete
   * @returns Boolean indicating success
   */
  static async deleteEmbedding(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('embeddings')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting embedding:', error);
      throw new Error('Failed to delete embedding');
    }
  }
}
