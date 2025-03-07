/**
 * Memory System
 * 
 * Manages short-term and long-term memory for agents to provide context and recall.
 */
class MemorySystem {
  private shortTermMemory: Map<string, any[]>;
  private longTermMemory: Map<string, any[]>;
  private shortTermMemoryLimit: number;
  
  constructor() {
    this.shortTermMemory = new Map();
    this.longTermMemory = new Map();
    this.shortTermMemoryLimit = 10; // Default limit of conversation turns to remember
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
   */
  async addToLongTermMemory(userId: string, memoryItem: any): Promise<void> {
    if (!this.longTermMemory.has(userId)) {
      this.longTermMemory.set(userId, []);
    }
    
    const memory = this.longTermMemory.get(userId);
    if (memory) {
      memory.push({
        ...memoryItem,
        timestamp: Date.now()
      });
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
   * @returns Array of relevant memory items
   */
  async retrieveRelevantMemories(userId: string, query: string): Promise<any[]> {
    const memories = this.longTermMemory.get(userId) || [];
    
    // In a real implementation, we would compute embeddings and do similarity search
    // For now, we'll just do a simple text match
    return memories.filter(memory => {
      if (memory.userInput && typeof memory.userInput === 'string') {
        return memory.userInput.toLowerCase().includes(query.toLowerCase());
      }
      return false;
    }).slice(0, 5); // Return top 5 matches
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
   * Set the maximum number of items to keep in short-term memory
   * @param limit - Maximum number of items
   */
  setShortTermMemoryLimit(limit: number): void {
    this.shortTermMemoryLimit = limit;
  }
}

export default MemorySystem;
