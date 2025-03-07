/**
 * Tool Registry
 * 
 * Manages the collection of tools available to the agent.
 * Provides interfaces for registering, discovering, and accessing tools.
 */

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  default?: any;
}

export interface ToolExample {
  description: string;
  params: Record<string, any>;
}

export interface Tool {
  name: string;
  description: string;
  category?: string;
  parameters?: ToolParameter[];
  examples?: ToolExample[];
  execute: (params: any, userId: string) => Promise<any>;
}

class ToolRegistry {
  private tools: Map<string, Tool>;
  private categories: Map<string, string[]>;
  
  constructor() {
    this.tools = new Map(); // Map of tool name to tool instance
    this.categories = new Map(); // Map of category name to list of tool names
  }

  /**
   * Register a new tool with the registry
   * @param tool - Tool implementation object
   * @returns boolean - Success indicator
   */
  registerTool(tool: Tool): boolean {
    if (!tool || !tool.name || typeof tool.execute !== 'function') {
      console.error('Invalid tool registration attempt:', tool);
      return false;
    }

    // Store the tool
    this.tools.set(tool.name, tool);

    // Categorize the tool
    const toolCategory = tool.category || 'general';
    
    if (!this.categories.has(toolCategory)) {
      this.categories.set(toolCategory, []);
    }
    
    const categoryTools = this.categories.get(toolCategory);
    if (categoryTools && !categoryTools.includes(tool.name)) {
      categoryTools.push(tool.name);
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
   * @returns Tool - Tool instance
   */
  getTool(name: string): Tool {
    if (!this.tools.has(name)) {
      throw new Error(`Tool "${name}" not found in registry`);
    }
    
    return this.tools.get(name)!;
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
        parameters: tool.parameters || [],
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
        parameters: tool.parameters || [],
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

  /**
   * Validate parameters against tool requirements
   * @param toolName - Name of the tool
   * @param params - Parameters to validate
   * @returns object - Validation result
   */
  validateParameters(toolName: string, params: Record<string, any>): { valid: boolean; errors?: string[] } {
    const tool = this.getTool(toolName);
    if (!tool || !tool.parameters) {
      return { valid: true }; // No parameters to validate
    }
    
    const errors: string[] = [];
    
    // Check required parameters
    for (const param of tool.parameters) {
      if (param.required && (params[param.name] === undefined || params[param.name] === null)) {
        errors.push(`Required parameter '${param.name}' is missing`);
      }
    }
    
    // No need for type validation in TypeScript implementation as it's less commonly used at runtime
    
    return { 
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

export default ToolRegistry;
