
/**
 * Tool Registry
 * 
 * Manages the available tools that an agent can use to complete tasks.
 * Provides registration, discovery, and execution interfaces.
 */
class ToolRegistry {
  private tools: Map<string, any>;
  private categories: Map<string, string[]>;
  
  constructor() {
    this.tools = new Map();
    this.categories = new Map();
  }
  
  /**
   * Register a new tool
   * @param name - Unique tool identifier
   * @param tool - Tool implementation object
   * @param category - Optional category for organization
   * @returns boolean - Success indicator
   */
  registerTool(name: string, tool: any, category: string = 'general'): boolean {
    if (this.tools.has(name)) {
      console.warn(`Tool "${name}" is already registered. Overwriting.`);
    }
    
    this.tools.set(name, tool);
    
    // Add to category
    if (!this.categories.has(category)) {
      this.categories.set(category, []);
    }
    
    const categoryTools = this.categories.get(category);
    if (categoryTools && !categoryTools.includes(name)) {
      categoryTools.push(name);
    }
    
    return true;
  }
  
  /**
   * Unregister a tool
   * @param name - Tool identifier to remove
   * @returns boolean - Success indicator
   */
  unregisterTool(name: string): boolean {
    if (!this.tools.has(name)) {
      return false;
    }
    
    this.tools.delete(name);
    
    // Remove from all categories
    for (const [category, tools] of this.categories.entries()) {
      const index = tools.indexOf(name);
      if (index >= 0) {
        tools.splice(index, 1);
      }
    }
    
    return true;
  }
  
  /**
   * Check if a tool exists
   * @param name - Tool identifier
   * @returns boolean - Whether the tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
  
  /**
   * Get a tool by name
   * @param name - Tool identifier
   * @returns object - Tool instance
   */
  getTool(name: string): any {
    if (!this.tools.has(name)) {
      throw new Error(`Tool "${name}" not found in registry`);
    }
    
    return this.tools.get(name);
  }
  
  /**
   * Get all tools in a category
   * @param category - Category name
   * @returns Array - List of tool names in the category
   */
  getToolsByCategory(category: string): string[] {
    return this.categories.get(category) || [];
  }
  
  /**
   * Get all tool categories
   * @returns Array - List of category names
   */
  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }
  
  /**
   * Get descriptions of all registered tools
   * @returns Array - Tool descriptions
   */
  getToolDescriptions(): any[] {
    const descriptions = [];
    
    for (const [name, tool] of this.tools.entries()) {
      descriptions.push({
        name,
        description: tool.description || "No description provided",
        parameters: tool.parameters || {},
        category: this.getToolCategory(name)
      });
    }
    
    return descriptions;
  }
  
  /**
   * Get the category of a tool
   * @param name - Tool identifier
   * @returns string - Category name
   */
  private getToolCategory(name: string): string {
    for (const [category, tools] of this.categories.entries()) {
      if (tools.includes(name)) {
        return category;
      }
    }
    
    return 'uncategorized';
  }
}

export default ToolRegistry;
