
import AgentCore from './agentCore';
import MemorySystem from './memorySystem';
import ToolRegistry from './toolRegistry';

/**
 * Main agent system that coordinates all agent components
 */
class AgentSystem {
  private core: AgentCore;
  private memory: MemorySystem;
  private tools: ToolRegistry;
  private isInitialized: boolean = false;

  constructor() {
    this.memory = new MemorySystem();
    this.tools = new ToolRegistry();
    this.core = new AgentCore({
      memorySystem: this.memory,
      toolRegistry: this.tools
    });
  }

  /**
   * Initialize the agent system
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // Register default tools
    this.registerDefaultTools();
    
    this.isInitialized = true;
    console.log('Agent system initialized');
  }

  /**
   * Register default tools
   */
  private registerDefaultTools(): void {
    // Register a search tool example
    this.tools.registerTool('search', {
      name: 'search',
      description: 'Search for information on a topic',
      parameters: {
        query: {
          type: 'string',
          description: 'The search query'
        }
      },
      execute: async (input: any) => {
        console.log('Executing search with query:', input.query);
        return `Simulated search results for: ${input.query}`;
      }
    }, 'information');

    // Register a calculator tool example
    this.tools.registerTool('calculator', {
      name: 'calculator',
      description: 'Perform calculations',
      parameters: {
        expression: {
          type: 'string',
          description: 'The mathematical expression to evaluate'
        }
      },
      execute: async (input: any) => {
        console.log('Executing calculation:', input.expression);
        try {
          // Simple eval for demonstration - in production, use a safe evaluation method
          // eslint-disable-next-line no-eval
          return `Result: ${eval(input.expression)}`;
        } catch (error) {
          return `Error calculating: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }
    }, 'utilities');
  }

  /**
   * Process a user request
   * @param userId - User identifier
   * @param userInput - User's request text
   * @returns - Agent's response
   */
  async processUserRequest(userId: string, userInput: string): Promise<any> {
    if (!this.isInitialized) {
      this.initialize();
    }

    return await this.core.processUserRequest(userId, userInput);
  }

  /**
   * Register a new tool
   * @param name - Tool name
   * @param tool - Tool implementation
   * @param category - Tool category
   * @returns - Success indicator
   */
  registerTool(name: string, tool: any, category: string = 'general'): boolean {
    return this.tools.registerTool(name, tool, category);
  }

  /**
   * Get the memory system
   * @returns - Memory system
   */
  getMemorySystem(): MemorySystem {
    return this.memory;
  }

  /**
   * Get the tool registry
   * @returns - Tool registry
   */
  getToolRegistry(): ToolRegistry {
    return this.tools;
  }
}

// Export singleton instance
const agentSystem = new AgentSystem();
export default agentSystem;
