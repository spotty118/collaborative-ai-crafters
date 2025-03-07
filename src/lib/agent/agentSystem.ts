
import AgentCore from './agentCore';
import MemorySystem from './memorySystem';
import ToolRegistry from './toolRegistry';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Agent System
 * 
 * Main entry point for the agent system. Coordinates between the agent core,
 * memory system, LLM service, and tools.
 */
class AgentSystem {
  private agentCore: AgentCore;
  private memorySystem: MemorySystem;
  private toolRegistry: ToolRegistry;
  private llmService: any;
  private initialized: boolean = false;
  
  /**
   * Initialize the agent system
   * This should be called before using any agent capabilities
   */
  async initialize(config: any = {}): Promise<boolean> {
    try {
      // Initialize the LLM service (connects to Supabase Edge Function)
      this.llmService = {
        generateCompletion: async (prompt: string) => {
          const { data, error } = await supabase.functions.invoke('agent-llm', {
            body: { prompt, type: 'completion' }
          });
          
          if (error) {
            console.error('Error in LLM service:', error);
            throw new Error(`LLM service error: ${error.message}`);
          }
          
          return data.completion;
        },
        
        generateEmbedding: async (text: string) => {
          const { data, error } = await supabase.functions.invoke('agent-llm', {
            body: { text, type: 'embedding' }
          });
          
          if (error) {
            console.error('Error in embedding service:', error);
            throw new Error(`Embedding service error: ${error.message}`);
          }
          
          return data.embedding;
        }
      };
      
      // Initialize the vector store
      const vectorStore = {
        addItem: async (item: any) => {
          // Temporarily simulated until we implement proper vector storage
          console.log('Adding item to vector store:', item);
          return `mem_${Date.now()}`;
        },
        
        search: async (query: any) => {
          // Temporarily return empty results until we implement proper vector search
          console.log('Searching vector store:', query);
          return [];
        },
        
        deleteItems: async (projectId: string, ids: string[]) => {
          console.log(`Deleting items ${ids.join(', ')} for project ${projectId}`);
          return true;
        },
        
        getRecent: async (projectId: string, limit: number, earliestTimestamp: number) => {
          console.log(`Getting ${limit} recent items for project ${projectId} since ${new Date(earliestTimestamp).toISOString()}`);
          return [];
        }
      };
      
      // Initialize the main components
      this.memorySystem = new MemorySystem({ 
        embeddingService: this.llmService,
        vectorStore
      });
      
      this.toolRegistry = new ToolRegistry();
      
      // Register default tools
      this.registerDefaultTools();
      
      this.agentCore = new AgentCore({
        llmService: this.llmService,
        memorySystem: this.memorySystem,
        toolRegistry: this.toolRegistry
      });
      
      this.initialized = true;
      console.log('Agent system initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing agent system:', error);
      toast.error(`Failed to initialize agent system: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
  
  /**
   * Register the default set of tools
   */
  private registerDefaultTools(): void {
    // Register a search tool
    this.toolRegistry.registerTool('search', {
      description: 'Search for information on the web',
      parameters: {
        query: 'The search query string'
      },
      execute: async (input: any) => {
        // Simplified mock implementation
        console.log(`Searching for: ${input.query}`);
        return `Results for "${input.query}"`;
      }
    }, 'information');
    
    // Register a code generation tool
    this.toolRegistry.registerTool('generate_code', {
      description: 'Generate code based on a specification',
      parameters: {
        language: 'The programming language',
        specification: 'What the code should do'
      },
      execute: async (input: any) => {
        // Simplified mock implementation
        console.log(`Generating ${input.language} code for: ${input.specification}`);
        return `// Generated ${input.language} code for ${input.specification}`;
      }
    }, 'development');
    
    // Register a task management tool
    this.toolRegistry.registerTool('create_task', {
      description: 'Create a new task in the project',
      parameters: {
        title: 'Task title',
        description: 'Task description',
        assignedTo: 'Agent ID to assign the task to'
      },
      execute: async (input: any, projectId: string) => {
        // Simplified mock implementation
        console.log(`Creating task "${input.title}" for project ${projectId}`);
        return `Task "${input.title}" created successfully`;
      }
    }, 'project');
  }
  
  /**
   * Process a user request using the agent
   * @param projectId - Project identifier
   * @param userInput - User's request text
   * @returns Promise with the agent's response
   */
  async processRequest(projectId: string, userInput: string): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return this.agentCore.processUserRequest(projectId, userInput);
  }
  
  /**
   * Register a custom tool for the agent to use
   * @param name - Tool identifier
   * @param tool - Tool implementation
   * @param category - Tool category
   * @returns boolean - Success indicator
   */
  registerTool(name: string, tool: any, category: string = 'custom'): boolean {
    return this.toolRegistry.registerTool(name, tool, category);
  }
  
  /**
   * Get the memory system instance
   * @returns MemorySystem - The memory system
   */
  getMemorySystem(): MemorySystem {
    return this.memorySystem;
  }
  
  /**
   * Get the tool registry instance
   * @returns ToolRegistry - The tool registry
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }
}

// Create a singleton instance
const agentSystem = new AgentSystem();

export default agentSystem;
