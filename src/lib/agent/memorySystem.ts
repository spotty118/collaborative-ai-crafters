import { supabase } from "@/integrations/supabase/client";

/**
 * Memory System
 * 
 * Provides short-term and long-term memory capabilities for the agent.
 * Short-term memory maintains conversation context.
 * Long-term memory stores persistent knowledge using vector embeddings.
 */
class MemorySystem {
  private embeddingService: any;     // Service to generate embeddings
  private vectorStore: any;          // Vector database for semantic search
  private shortTermMemory: Map<string, any[]>; // In-memory storage for recent conversations
  private maxShortTermMemoryItems: number;     // Maximum number of items in short-term memory per user

  constructor({ embeddingService, vectorStore }: { 
    embeddingService: any; 
    vectorStore: any;
  }) {
    this.embeddingService = embeddingService;
    this.vectorStore = vectorStore;
    this.shortTermMemory = new Map();
    this.maxShortTermMemoryItems = 20;
  }

  /**
   * Add a message to short-term memory
   * @param projectId - Project identifier
   * @param message - Message object to store
   * @returns Promise<void>
   */
  async addToShortTermMemory(projectId: string, message: any): Promise<void> {
    if (!this.shortTermMemory.has(projectId)) {
      this.shortTermMemory.set(projectId, []);
    }

    const projectMemory = this.shortTermMemory.get(projectId);
    projectMemory?.push(message);

    // Trim to max size if needed
    if (projectMemory && projectMemory.length > this.maxShortTermMemoryItems) {
      projectMemory.splice(0, projectMemory.length - this.maxShortTermMemoryItems);
    }
  }

  /**
   * Get recent conversation context from short-term memory
   * @param projectId - Project identifier
   * @returns Promise<Array> - List of recent messages
   */
  async getConversationContext(projectId: string): Promise<any[]> {
    return this.shortTermMemory.get(projectId) || [];
  }

  /**
   * Add information to long-term memory
   * @param projectId - Project identifier
   * @param memoryItem - Information to store
   * @returns Promise<string> - ID of the stored memory
   */
  async addToLongTermMemory(projectId: string, memoryItem: any): Promise<string> {
    try {
      // Create a text representation of the memory item
      const textRepresentation = this.createTextRepresentation(memoryItem);
      
      // Generate embedding for the text
      const embedding = await this.embeddingService.generateEmbedding(textRepresentation);
      
      // Store in vector database with metadata
      const memoryId = await this.vectorStore.addItem({
        projectId,
        embedding,
        text: textRepresentation,
        metadata: {
          type: memoryItem.type || 'general',
          timestamp: memoryItem.timestamp || Date.now(),
          source: memoryItem.source || 'conversation',
          importance: memoryItem.importance || this.calculateImportance(memoryItem)
        },
        rawData: memoryItem
      });
      
      return memoryId;
    } catch (error) {
      console.error('Error adding to long-term memory:', error);
      // Fallback to just returning a random ID if vector storage fails
      return `memory_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
  }

  /**
   * Create a text representation of a memory item for embedding
   * @param memoryItem - Item to represent as text
   * @returns string - Text representation
   */
  private createTextRepresentation(memoryItem: any): string {
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
   * @returns number - Importance score between 0-1
   */
  private calculateImportance(memoryItem: any): number {
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
    const textContent = this.createTextRepresentation(memoryItem).toLowerCase();
    
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
   * Retrieve relevant memories based on semantic similarity
   * @param projectId - Project identifier
   * @param query - Text to find relevant memories for
   * @param options - Search options
   * @returns Promise<Array> - Relevant memory items
   */
  async retrieveRelevantMemories(
    projectId: string, 
    query: string, 
    options: {
      limit?: number;
      minSimilarity?: number;
      includeMetadata?: boolean;
    } = {}
  ): Promise<any[]> {
    try {
      const {
        limit = 5,
        minSimilarity = 0.7,
        includeMetadata = true
      } = options;
      
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      
      // Search the vector database
      const searchResults = await this.vectorStore.search({
        projectId,
        embedding: queryEmbedding,
        limit,
        minSimilarity
      });
      
      // Format results based on options
      return searchResults.map(result => {
        if (includeMetadata) {
          return {
            content: result.rawData,
            similarity: result.similarity,
            metadata: result.metadata
          };
        }
        return result.rawData;
      });
    } catch (error) {
      console.error('Error retrieving memories:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Store fact in memory with appropriate categorization
   * @param projectId - Project identifier
   * @param fact - Text of the fact to store
   * @param category - Category label for the fact
   * @returns Promise<string> - ID of the stored memory
   */
  async storeFact(projectId: string, fact: string, category: string = 'general'): Promise<string> {
    return this.addToLongTermMemory(projectId, {
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
   * @param projectId - Project identifier
   * @param preferenceKey - The preference type/category
   * @param preferenceValue - The value of the preference
   * @returns Promise<string> - ID of the stored memory
   */
  async storeUserPreference(projectId: string, preferenceKey: string, preferenceValue: any): Promise<string> {
    return this.addToLongTermMemory(projectId, {
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
   * @param projectId - Project identifier
   * @param preferenceKey - Optional specific preference to retrieve
   * @returns Promise<object|Array> - User preference(s)
   */
  async getUserPreferences(projectId: string, preferenceKey: string | null = null): Promise<any> {
    try {
      // Using a custom query to search for preferences
      const queryText = preferenceKey 
        ? `user preference for ${preferenceKey}`
        : `user preferences`;
        
      const results = await this.retrieveRelevantMemories(projectId, queryText, {
        limit: preferenceKey ? 3 : 10,
        minSimilarity: 0.6
      });
      
      // Filter to only include preference-type memories
      const preferences = results
        .filter(item => 
          item.content.type === 'preference' &&
          (!preferenceKey || item.content.key === preferenceKey)
        )
        .map(item => ({
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
   * Clear short-term memory for a project
   * @param projectId - Project identifier
   */
  clearShortTermMemory(projectId: string): void {
    this.shortTermMemory.delete(projectId);
  }

  /**
   * Delete specific memories from the long-term store
   * @param projectId - Project identifier
   * @param memoryIds - IDs of memories to delete
   * @returns Promise<boolean> - Success indicator
   */
  async deleteMemories(projectId: string, memoryIds: string[]): Promise<boolean> {
    try {
      await this.vectorStore.deleteItems(projectId, memoryIds);
      return true;
    } catch (error) {
      console.error('Error deleting memories:', error);
      return false;
    }
  }

  /**
   * Parse a time frame string into milliseconds
   * @param timeFrame - Time frame string (e.g., '1h', '7d')
   * @returns number - Time frame in milliseconds
   * @private
   */
  private _parseTimeFrame(timeFrame: string): number {
    const unit = timeFrame.slice(-1);
    const value = parseInt(timeFrame.slice(0, -1), 10);
    
    switch (unit) {
      case 'h': return value * 60 * 60 * 1000; // hours
      case 'd': return value * 24 * 60 * 60 * 1000; // days
      case 'w': return value * 7 * 24 * 60 * 60 * 1000; // weeks
      case 'm': return value * 30 * 24 * 60 * 60 * 1000; // months (approximate)
      default: return 7 * 24 * 60 * 60 * 1000; // default to 7 days
    }
  }
}

export default MemorySystem;
