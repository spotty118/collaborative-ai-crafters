
import AgentCore from './agentCore';
import MemorySystem from './memorySystem';
import ToolRegistry, { Tool } from './toolRegistry';
import { generateCompletion } from '../agent-llm';

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
    // Register a search tool
    const searchTool: Tool = {
      name: 'search',
      description: 'Search for information on a topic',
      category: 'information',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'The search query',
          required: true
        },
        {
          name: 'num_results',
          type: 'number',
          description: 'Number of results to return',
          required: false,
          default: 5
        }
      ],
      examples: [
        {
          description: 'Search for weather in San Francisco',
          params: {
            query: 'weather in San Francisco',
            num_results: 3
          }
        }
      ],
      execute: async (input: any, userId: string) => {
        console.log('Executing search with query:', input.query);
        return {
          success: true,
          results: [
            {
              title: 'Simulated search result 1',
              url: 'https://example.com/1',
              snippet: `Simulated result for: ${input.query}`
            },
            {
              title: 'Simulated search result 2',
              url: 'https://example.com/2',
              snippet: `More information about: ${input.query}`
            }
          ]
        };
      }
    };
    
    this.tools.registerTool(searchTool);

    // Register a code generation tool
    const codeGenTool: Tool = {
      name: 'generate_code',
      description: 'Generate code snippets based on requirements',
      category: 'development',
      parameters: [
        {
          name: 'language',
          type: 'string',
          description: 'Programming language to use',
          required: true
        },
        {
          name: 'requirements',
          type: 'string',
          description: 'Detailed description of code requirements',
          required: true
        },
        {
          name: 'include_comments',
          type: 'boolean',
          description: 'Whether to include comments in the code',
          required: false,
          default: true
        }
      ],
      examples: [
        {
          description: 'Generate a TypeScript function to calculate fibonacci numbers',
          params: {
            language: 'typescript',
            requirements: 'Create a recursive function to calculate the nth Fibonacci number',
            include_comments: true
          }
        }
      ],
      execute: async (input: any, userId: string) => {
        const { language, requirements, include_comments = true } = input;
        
        if (!language || !requirements) {
          throw new Error('Language and requirements are required parameters');
        }

        const prompt = `
You are an expert ${language} developer.
Write ${language} code that satisfies the following requirements:

${requirements}

${include_comments ? 'Include detailed comments to explain your code.' : 'Keep comments minimal.'}

Respond only with the code and necessary comments. Make sure the code is complete and functional.
`;

        try {
          const codeResult = await generateCompletion(prompt);
          
          // Extract code from the response if needed
          let cleanedCode = codeResult;
          if (codeResult.includes('```')) {
            const codeMatch = codeResult.match(/```(?:[\w-]*\n)?([\s\S]*?)```/);
            if (codeMatch && codeMatch[1]) {
              cleanedCode = codeMatch[1].trim();
            }
          }
          
          return {
            success: true,
            language,
            code: cleanedCode
          };
        } catch (error) {
          console.error('Code generation error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    };
    
    this.tools.registerTool(codeGenTool);

    // Register a calculator tool
    const calculatorTool: Tool = {
      name: 'calculator',
      description: 'Perform calculations',
      category: 'utilities',
      parameters: [
        {
          name: 'expression',
          type: 'string',
          description: 'The mathematical expression to evaluate',
          required: true
        }
      ],
      examples: [
        {
          description: 'Calculate 2 + 2',
          params: {
            expression: '2 + 2'
          }
        },
        {
          description: 'Calculate the square root of 16',
          params: {
            expression: 'Math.sqrt(16)'
          }
        }
      ],
      execute: async (input: any, userId: string) => {
        console.log('Executing calculation:', input.expression);
        try {
          // Simple eval for demonstration - in production, use a safe evaluation method
          // eslint-disable-next-line no-eval
          return {
            success: true,
            result: eval(input.expression)
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    };
    
    this.tools.registerTool(calculatorTool);
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
   * @param tool - Tool implementation
   * @returns - Success indicator
   */
  registerTool(tool: Tool): boolean {
    return this.tools.registerTool(tool);
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
