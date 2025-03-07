
/**
 * Embedding Service
 * 
 * Generates vector embeddings for text using API services.
 * Currently leverages the Supabase implementation but can be extended 
 * to directly use embedding providers.
 */
import { generateEmbedding } from '../agent-llm';

export type EmbeddingProvider = 'openai' | 'cohere';

export interface EmbeddingConfig {
  apiKey?: string;
  model?: string;
  provider?: EmbeddingProvider;
  dimensions?: number;
  batchSize?: number;
}

class EmbeddingService {
  private apiKey: string;
  private model: string;
  private provider: EmbeddingProvider;
  private dimensions?: number;
  private batchSize: number;

  constructor(config: EmbeddingConfig = {}) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'text-embedding-3-small';
    this.provider = config.provider || 'openai';
    this.dimensions = config.dimensions;
    this.batchSize = config.batchSize || 10;
  }

  /**
   * Generate an embedding for a single text
   * Using the Supabase implementation
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Use the existing implementation from agent-llm.ts
    try {
      return await generateEmbedding(text);
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batches
   */
  async generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    // Process all texts
    const processedTexts = texts.map(text => this._processInputText(text));
    
    // Split into batches to avoid rate limits
    const batches: string[][] = [];
    for (let i = 0; i < processedTexts.length; i += this.batchSize) {
      batches.push(processedTexts.slice(i, i + this.batchSize));
    }

    // Process each batch
    const results: number[][] = [];
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(text => this.generateEmbedding(text))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Process and sanitize input text
   */
  private _processInputText(text: string | any): string {
    if (typeof text !== 'string') {
      text = String(text);
    }
    
    // Remove excessive whitespace
    let processed = text.trim().replace(/\s+/g, ' ');
    
    // Truncate if too long (depends on model)
    const maxLength = this._getMaxInputLength();
    if (processed.length > maxLength) {
      processed = processed.substring(0, maxLength);
    }
    
    return processed;
  }

  /**
   * Get maximum input text length based on the model
   */
  private _getMaxInputLength(): number {
    // Different models have different limits
    const model = this.model.toLowerCase();
    
    if (model.includes('ada')) return 8191;
    if (model.includes('babbage')) return 16382; 
    if (model.includes('curie')) return 16382;
    if (model.includes('davinci')) return 16382;
    if (model.includes('embedding-3')) return 8191;
    
    // Default conservative limit
    return 8000;
  }
}

export default EmbeddingService;
