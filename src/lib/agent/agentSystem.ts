
import AgentCore from './agentCore';
import MemorySystem from './memorySystem';
import ToolRegistry, { Tool } from './toolRegistry';
import { generateCompletion } from '../agent-llm';
import { v4 as uuidv4 } from 'uuid';

// Define interface for agent-to-agent communication messages
interface AgentMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  type: 'request' | 'response' | 'update' | 'notification';
  metadata?: Record<string, any>;
}

// Define interface for running agent instances
interface AgentInstance {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'thinking' | 'working' | 'waiting' | 'completed';
  core: AgentCore;
  messageQueue: AgentMessage[];
  currentTask?: any;
  lastActivity: number;
}

/**
 * Main agent system that coordinates all agent components with real collaboration
 */
class AgentSystem {
  private core: AgentCore;
  private memory: MemorySystem;
  private tools: ToolRegistry;
  private isInitialized: boolean = false;
  private agents: Map<string, AgentInstance> = new Map();
  private messageBuffer: Map<string, AgentMessage[]> = new Map();
  private collaborationInterval: NodeJS.Timeout | null = null;

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
    
    // Setup the agent collaboration loop
    this.startCollaborationLoop();
    
    this.isInitialized = true;
    console.log('Agent system initialized with live collaboration');
  }

  /**
   * Start the real-time collaboration processing loop
   */
  private startCollaborationLoop(): void {
    if (this.collaborationInterval) {
      clearInterval(this.collaborationInterval);
    }
    
    this.collaborationInterval = setInterval(() => {
      this.processAgentMessages();
      this.checkAgentStatus();
    }, 1000); // Process messages every second
    
    console.log('Agent collaboration loop started');
  }
  
  /**
   * Stop the collaboration processing loop
   */
  stopCollaborationLoop(): void {
    if (this.collaborationInterval) {
      clearInterval(this.collaborationInterval);
      this.collaborationInterval = null;
      console.log('Agent collaboration loop stopped');
    }
  }
  
  /**
   * Process pending messages between agents
   */
  private async processAgentMessages(): Promise<void> {
    for (const [agentId, agent] of this.agents.entries()) {
      // Skip agents that aren't ready to process messages
      if (agent.status === 'thinking' || agent.status === 'waiting') {
        continue;
      }
      
      // Process any messages in the queue
      if (agent.messageQueue.length > 0) {
        const message = agent.messageQueue.shift();
        if (!message) continue;
        
        // Update agent status
        agent.status = 'thinking';
        agent.lastActivity = Date.now();
        
        try {
          // Process the message
          console.log(`Agent ${agent.name} processing message from ${message.from}`);
          
          const response = await this.processAgentMessage(agent, message);
          
          // Send response back to the sender
          this.sendAgentMessage({
            id: uuidv4(),
            from: agentId,
            to: message.from,
            content: response,
            timestamp: Date.now(),
            type: 'response',
            metadata: {
              inResponseTo: message.id
            }
          });
          
          // Update agent status
          agent.status = 'idle';
        } catch (error) {
          console.error(`Error processing message for agent ${agent.name}:`, error);
          agent.status = 'idle';
        }
      }
    }
  }
  
  /**
   * Check and update agent status based on activity
   */
  private checkAgentStatus(): void {
    const now = Date.now();
    
    for (const [agentId, agent] of this.agents.entries()) {
      // Check for stalled agents
      if ((agent.status === 'thinking' || agent.status === 'working') && 
          now - agent.lastActivity > 30000) { // 30 seconds timeout
        console.log(`Agent ${agent.name} appears stalled, resetting to idle`);
        agent.status = 'idle';
      }
    }
  }
  
  /**
   * Process a message received by an agent
   */
  private async processAgentMessage(agent: AgentInstance, message: AgentMessage): Promise<string> {
    // Construct a prompt for the agent to process the message
    const prompt = `
You are ${agent.name}, a ${agent.type} agent in a collaborative AI system.

You have received the following message from ${message.from}:

${message.content}

Based on your expertise as a ${agent.type} agent:
1. Analyze the message content
2. Consider how you can help with your specific skills
3. Provide a thoughtful, detailed response that offers real value

Your response should be concise yet comprehensive and directly address the message content.
`;

    try {
      // Use the agent's core to generate a response
      const result = await generateCompletion(prompt);
      return result;
    } catch (error) {
      console.error(`Error generating response for ${agent.name}:`, error);
      return `I apologize, but I'm currently experiencing a technical issue. Please try reaching out again in a moment.`;
    }
  }
  
  /**
   * Register a new agent in the system
   */
  registerAgent(name: string, type: string): string {
    const agentId = uuidv4();
    
    // Create a dedicated memory system for this agent
    const agentMemory = new MemorySystem();
    
    // Create a new agent core
    const agentCore = new AgentCore({
      memorySystem: agentMemory,
      toolRegistry: this.tools
    });
    
    // Register the agent
    this.agents.set(agentId, {
      id: agentId,
      name,
      type,
      status: 'idle',
      core: agentCore,
      messageQueue: [],
      lastActivity: Date.now()
    });
    
    // Initialize message buffer for this agent
    this.messageBuffer.set(agentId, []);
    
    console.log(`Agent ${name} (${type}) registered with ID ${agentId}`);
    return agentId;
  }
  
  /**
   * Send a message from one agent to another
   */
  sendAgentMessage(message: AgentMessage): boolean {
    // Validate message
    if (!message.from || !message.to || !message.content) {
      console.error('Invalid agent message:', message);
      return false;
    }
    
    // Check if recipient exists
    const recipient = this.agents.get(message.to);
    if (!recipient) {
      console.error(`Recipient agent ${message.to} not found`);
      return false;
    }
    
    // Add message to recipient's queue
    recipient.messageQueue.push(message);
    
    // Store message in buffer for history tracking
    const buffer = this.messageBuffer.get(message.to) || [];
    buffer.push(message);
    this.messageBuffer.set(message.to, buffer);
    
    console.log(`Message sent from ${message.from} to ${message.to}`);
    return true;
  }
  
  /**
   * Broadcast a message to all agents of a specific type
   */
  broadcastToAgentType(fromId: string, targetType: string, content: string): number {
    let count = 0;
    
    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.type === targetType && agentId !== fromId) {
        this.sendAgentMessage({
          id: uuidv4(),
          from: fromId,
          to: agentId,
          content,
          timestamp: Date.now(),
          type: 'notification'
        });
        count++;
      }
    }
    
    return count;
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
   * Create a team of agents to collaborate on a task
   */
  createAgentTeam(teamConfig: { name: string, agents: Array<{type: string, name: string}> }): string[] {
    const teamIds: string[] = [];
    
    // Create all the agents defined in the team
    for (const agentConfig of teamConfig.agents) {
      const agentId = this.registerAgent(agentConfig.name, agentConfig.type);
      teamIds.push(agentId);
    }
    
    console.log(`Created agent team "${teamConfig.name}" with ${teamIds.length} agents`);
    return teamIds;
  }
  
  /**
   * Assign a task to an agent team
   */
  async assignTeamTask(teamIds: string[], task: string, initiatorId?: string): Promise<void> {
    if (!teamIds || teamIds.length === 0) {
      throw new Error('No team members provided');
    }
    
    // Find the first agent to coordinate the task
    const coordinatorId = teamIds[0];
    const coordinator = this.agents.get(coordinatorId);
    
    if (!coordinator) {
      throw new Error('Coordinator agent not found');
    }
    
    // Generate initial task plan
    coordinator.status = 'thinking';
    coordinator.lastActivity = Date.now();
    
    const taskPlanPrompt = `
You are ${coordinator.name}, a ${coordinator.type} agent leading a team.

Your team has been assigned the following task: "${task}"

Your team members include:
${teamIds.slice(1).map(id => {
  const agent = this.agents.get(id);
  return agent ? `- ${agent.name}: ${agent.type}` : 'Unknown agent';
}).join('\n')}

Create a detailed plan for how your team should approach this task:
1. Break down the task into subtasks
2. Assign each subtask to the most appropriate team member
3. Specify any dependencies between subtasks
4. Provide clear success criteria for each subtask

Your plan will be used to coordinate the team's efforts. Be specific and thorough.
`;
    
    try {
      const taskPlan = await generateCompletion(taskPlanPrompt);
      
      // Distribute the plan to all team members
      for (const memberId of teamIds.slice(1)) {
        this.sendAgentMessage({
          id: uuidv4(),
          from: coordinatorId,
          to: memberId,
          content: `We have been assigned the following task: "${task}"\n\nHere is my plan:\n\n${taskPlan}\n\nPlease review your assigned subtasks and begin working on them immediately. Report back when you have made progress or if you encounter any issues.`,
          timestamp: Date.now(),
          type: 'request',
          metadata: {
            taskId: uuidv4(),
            isInitialAssignment: true
          }
        });
      }
      
      // Update coordinator status
      coordinator.status = 'working';
      coordinator.currentTask = task;
      
      console.log(`Task assigned to team with coordinator ${coordinator.name}`);
    } catch (error) {
      console.error('Error assigning team task:', error);
      coordinator.status = 'idle';
      throw error;
    }
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
  
  /**
   * Get all active agents
   * @returns - Map of agent instances
   */
  getAgents(): Map<string, AgentInstance> {
    return this.agents;
  }
}

// Export singleton instance
const agentSystem = new AgentSystem();
export default agentSystem;
