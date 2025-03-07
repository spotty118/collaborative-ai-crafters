
/**
 * Tool Registry
 * 
 * Manages the collection of tools available to the agent.
 * Provides interfaces for registering, discovering, and accessing tools.
 */
class ToolRegistry {
  private tools: Map<string, any>;
  private categories: Map<string, string[]>;
  
  constructor() {
    this.tools = new Map(); // Map of tool name to tool instance
    this.categories = new Map(); // Map of category name to list of tool names
  }

  /**
   * Register a new tool with the registry
   * @param name - Unique tool identifier
   * @param tool - Tool implementation object
   * @param category - Optional category for organization
   * @returns boolean - Success indicator
   */
  registerTool(name: string, tool: any, category: string = 'general'): boolean {
    if (!tool || typeof tool.execute !== 'function') {
      console.error('Invalid tool registration attempt:', tool);
      return false;
    }

    // Store the tool
    this.tools.set(name, tool);

    // Categorize the tool
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
        category: this.getToolCategory(name),
        parameters: tool.parameters || {},
        examples: tool.examples || []
      });
    }
    
    return descriptions;
  }

  /**
   * Get descriptions of tools by category
   * @param category - Category name
   * @returns Array - List of tool descriptions in the category
   */
  getToolDescriptionsByCategory(category: string): any[] {
    const toolNames = this.getToolsByCategory(category);
    return toolNames.map(name => {
      const tool = this.getTool(name);
      return {
        name,
        description: tool.description || "No description provided",
        parameters: tool.parameters || {},
        examples: tool.examples || []
      };
    });
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

  /**
   * Execute a tool by name
   * @param toolName - Name of the tool to execute
   * @param params - Parameters for the tool
   * @param userId - User identifier
   * @returns Promise<object> - Tool execution result
   */
  async executeTool(toolName: string, params: any, userId: string): Promise<any> {
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    try {
      return await tool.execute(params, userId);
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      throw new Error(`Failed to execute tool ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default ToolRegistry;
