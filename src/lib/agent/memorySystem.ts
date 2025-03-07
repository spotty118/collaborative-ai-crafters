/**
 * Memory System
 * 
 * Manages short-term and long-term memory for agents to provide context and recall.
 * Supports vector embeddings for semantic search capabilities.
 */
import { generateEmbedding } from '../agent-llm';

class MemorySystem {
  private shortTermMemory: Map<string, any[]>;
  private longTermMemory: Map<string, any[]>;
  private shortTermMemoryLimit: number;
  
  constructor() {
    this.shortTermMemory = new Map();
    this.longTermMemory = new Map();
    this.shortTermMemoryLimit = 20; // Increased from 10 to match the reference implementation
  }
  
  /**
   * Add an item to short-term memory
   * @param userId - User identifier
   * @param memoryItem - Item to store
   */
  async addToShortTermMemory(userId: string, memoryItem: any): Promise<void> {
    if (!this.shortTermMemory.has(userId)) {
      this.shortTermMemory.set(userId, []);
    }
    
    const memory = this.shortTermMemory.get(userId);
    if (memory) {
      memory.push(memoryItem);
      
      // Keep short-term memory within limit
      if (memory.length > this.shortTermMemoryLimit) {
        memory.shift(); // Remove oldest item
      }
    }
  }
  
  /**
   * Add an item to long-term memory
   * @param userId - User identifier
   * @param memoryItem - Item to store
   * @returns - ID of the stored memory
   */
  async addToLongTermMemory(userId: string, memoryItem: any): Promise<string> {
    try {
      if (!this.longTermMemory.has(userId)) {
        this.longTermMemory.set(userId, []);
      }
      
      // Create a text representation of the memory item
      const textRepresentation = this.createTextRepresentation(memoryItem);
      
      // Generate embedding for the text (if embedding service is available)
      let embedding = null;
      try {
        embedding = await generateEmbedding(textRepresentation);
      } catch (error) {
        console.error('Error generating embedding:', error);
        // Continue without embedding if the service fails
      }
      
      const memoryWithMetadata = {
        ...memoryItem,
        id: `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        timestamp: memoryItem.timestamp || Date.now(),
        embedding,
        textRepresentation,
        importance: this.calculateImportance(memoryItem)
      };
      
      const memory = this.longTermMemory.get(userId);
      if (memory) {
        memory.push(memoryWithMetadata);
      }
      
      return memoryWithMetadata.id;
    } catch (error) {
      console.error('Error adding to long-term memory:', error);
      // Fallback to just returning a random ID if storage fails
      return `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
  }
  
  /**
   * Get recent conversation context from short-term memory
   * @param userId - User identifier
   * @returns Array of recent conversation items
   */
  async getConversationContext(userId: string): Promise<any[]> {
    return this.shortTermMemory.get(userId) || [];
  }
  
  /**
   * Retrieve relevant memories from long-term memory
   * @param userId - User identifier
   * @param query - Query to search for relevant memories
   * @param options - Search options
   * @returns Array of relevant memory items
   */
  async retrieveRelevantMemories(
    userId: string, 
    query: string, 
    options: { limit?: number; minSimilarity?: number; includeMetadata?: boolean } = {}
  ): Promise<any[]> {
    try {
      const {
        limit = 5,
        minSimilarity = 0.7,
        includeMetadata = true
      } = options;
      
      const memories = this.longTermMemory.get(userId) || [];
      
      if (memories.length === 0) {
        return [];
      }
      
      // If we have embeddings, use semantic search
      try {
        const queryEmbedding = await generateEmbedding(query);
        
        // Calculate similarities and sort
        const memoryWithSimilarity = memories
          .filter(memory => memory.embedding) // Only consider memories with embeddings
          .map(memory => {
            // Calculate cosine similarity between query and memory embeddings
            const similarity = this.cosineSimilarity(queryEmbedding, memory.embedding);
            return {
              ...memory,
              similarity
            };
          })
          .filter(memory => memory.similarity >= minSimilarity)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);
          
        // Format results
        if (includeMetadata) {
          return memoryWithSimilarity.map(memory => ({
            content: memory,
            similarity: memory.similarity,
            metadata: {
              timestamp: memory.timestamp,
              importance: memory.importance
            }
          }));
        }
        
        return memoryWithSimilarity;
      } catch (error) {
        console.error('Error performing vector search:', error);
        // Fall back to simple text search
      }
      
      // Fallback: Simple text search
      return memories
        .filter(memory => {
          const text = memory.textRepresentation || this.createTextRepresentation(memory);
          return text.toLowerCase().includes(query.toLowerCase());
        })
        .slice(0, limit);
    } catch (error) {
      console.error('Error retrieving memories:', error);
      return []; // Return empty array on error
    }
  }
  
  /**
   * Create a text representation of a memory item for embedding
   * @param memoryItem - Item to represent as text
   * @returns Text representation
   */
  createTextRepresentation(memoryItem: any): string {
    if (typeof memoryItem === 'string') {
      return memoryItem;
    }
    
    // Handle different types of memory items
    if (memoryItem.userInput && memoryItem.result) {
      // This is a task execution memory
      return `User asked: "${memoryItem.userInput}" Plan: ${
        memoryItem.plan?.reasoning || 'Direct response'
      } Result: ${
        typeof memoryItem.result.response === 'string' 
          ? memoryItem.result.response 
          : JSON.stringify(memoryItem.result)
      }`;
    }
    
    if (memoryItem.role === 'user' || memoryItem.role === 'assistant') {
      // This is a conversation message
      return `${memoryItem.role}: ${memoryItem.content}`;
    }
    
    // Generic approach for other types
    try {
      return JSON.stringify(memoryItem);
    } catch (e) {
      return `Memory item from ${new Date(memoryItem.timestamp || Date.now()).toISOString()}`;
    }
  }
  
  /**
   * Calculate importance score for memory prioritization
   * @param memoryItem - Memory item to evaluate
   * @returns Importance score between 0-1
   */
  calculateImportance(memoryItem: any): number {
    // This is a simple heuristic and could be replaced with ML-based scoring
    let score = 0.5; // Default medium importance
    
    // Recent memories are more important
    const ageInHours = (Date.now() - (memoryItem.timestamp || Date.now())) / (1000 * 60 * 60);
    if (ageInHours < 1) score += 0.2;
    else if (ageInHours > 72) score -= 0.2;
    
    // User inputs might be more important than system generations
    if (memoryItem.role === 'user') score += 0.1;
    
    // Items containing specific keywords might be more important
    const importantKeywords = ['remember', 'important', 'don\'t forget', 'later', 'preference'];
    const textContent = typeof memoryItem === 'string' 
      ? memoryItem 
      : this.createTextRepresentation(memoryItem).toLowerCase();
    
    for (const keyword of importantKeywords) {
      if (textContent.includes(keyword)) {
        score += 0.1;
        break; // Only add the bonus once
      }
    }
    
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * Calculate cosine similarity between two vectors
   * @param vec1 - First vector
   * @param vec2 - Second vector
   * @returns Similarity score between 0-1
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let vec1Magnitude = 0;
    let vec2Magnitude = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      vec1Magnitude += vec1[i] * vec1[i];
      vec2Magnitude += vec2[i] * vec2[i];
    }
    
    vec1Magnitude = Math.sqrt(vec1Magnitude);
    vec2Magnitude = Math.sqrt(vec2Magnitude);
    
    if (vec1Magnitude === 0 || vec2Magnitude === 0) {
      return 0;
    }
    
    return dotProduct / (vec1Magnitude * vec2Magnitude);
  }
  
  /**
   * Store fact in memory with appropriate categorization
   * @param userId - User identifier
   * @param fact - Text of the fact to store
   * @param category - Category label for the fact
   * @returns ID of the stored memory
   */
  async storeFact(userId: string, fact: string, category: string = 'general'): Promise<string> {
    return this.addToLongTermMemory(userId, {
      type: 'fact',
      content: fact,
      category,
      source: 'explicit_storage',
      timestamp: Date.now(),
      importance: 0.8 // Facts are generally high importance
    });
  }
  
  /**
   * Store user preference in memory
   * @param userId - User identifier
   * @param preferenceKey - The preference type/category
   * @param preferenceValue - The value of the preference
   * @returns ID of the stored memory
   */
  async storeUserPreference(userId: string, preferenceKey: string, preferenceValue: any): Promise<string> {
    return this.addToLongTermMemory(userId, {
      type: 'preference',
      key: preferenceKey,
      value: preferenceValue,
      source: 'inferred_from_conversation',
      timestamp: Date.now(),
      importance: 0.9 // User preferences are high importance
    });
  }
  
  /**
   * Retrieve user preferences
   * @param userId - User identifier
   * @param preferenceKey - Optional specific preference to retrieve
   * @returns User preference(s)
   */
  async getUserPreferences(userId: string, preferenceKey: string | null = null): Promise<any> {
    try {
      // Using a custom query to search for preferences
      const queryText = preferenceKey 
        ? `user preference for ${preferenceKey}`
        : `user preferences`;
        
      const results = await this.retrieveRelevantMemories(userId, queryText, {
        limit: preferenceKey ? 3 : 10,
        minSimilarity: 0.6
      });
      
      // Filter to only include preference-type memories
      const preferences = results
        .filter((item: any) => 
          item.content?.type === 'preference' &&
          (!preferenceKey || item.content?.key === preferenceKey)
        )
        .map((item: any) => ({
          key: item.content.key,
          value: item.content.value,
          timestamp: item.content.timestamp
        }));
      
      if (preferenceKey) {
        // Return the most recent preference if requesting a specific key
        return preferences.length > 0 
          ? preferences.sort((a, b) => b.timestamp - a.timestamp)[0]
          : null;
      }
      
      // Deduplicate preferences by key, keeping most recent
      const uniquePreferences: Record<string, any> = {};
      for (const pref of preferences) {
        if (!uniquePreferences[pref.key] || uniquePreferences[pref.key].timestamp < pref.timestamp) {
          uniquePreferences[pref.key] = pref;
        }
      }
      
      return Object.values(uniquePreferences);
    } catch (error) {
      console.error('Error retrieving user preferences:', error);
      return preferenceKey ? null : [];
    }
  }
  
  /**
   * Clear short-term memory for a user
   * @param userId - User identifier
   */
  clearShortTermMemory(userId: string): void {
    this.shortTermMemory.delete(userId);
  }
  
  /**
   * Clear long-term memory for a user
   * @param userId - User identifier
   */
  clearLongTermMemory(userId: string): void {
    this.longTermMemory.delete(userId);
  }
  
  /**
   * Delete specific memories from the long-term store
   * @param userId - User identifier
   * @param memoryIds - IDs of memories to delete
   * @returns Success indicator
   */
  async deleteMemories(userId: string, memoryIds: string[]): Promise<boolean> {
    try {
      const memories = this.longTermMemory.get(userId);
      if (!memories) return false;
      
      // Filter out the memories to delete
      const updatedMemories = memories.filter(
        memory => !memoryIds.includes(memory.id)
      );
      
      this.longTermMemory.set(userId, updatedMemories);
      return true;
    } catch (error) {
      console.error('Error deleting memories:', error);
      return false;
    }
  }
  
  /**
   * Set the maximum number of items to keep in short-term memory
   * @param limit - Maximum number of items
   */
  setShortTermMemoryLimit(limit: number): void {
    this.shortTermMemoryLimit = limit;
  }
}

export default MemorySystem;
