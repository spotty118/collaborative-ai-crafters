import { supabase } from "@/integrations/supabase/client";
import { broadcastMessage } from "./messageBroker";
import { Agent, Project } from "@/lib/types";
import { toast } from "sonner";

/**
 * Agent Core Module
 * 
 * The central reasoning and planning engine for the agentic AI system.
 * Handles task decomposition, reasoning, and action execution.
 */
class AgentCore {
  private llm: any; // LLM service for reasoning
  private memory: any; // Memory system for storing context
  private tools: any; // Available tools for the agent
  private activeTasks: Map<string, any>; // Currently running tasks
  private maxRecursionDepth: number; // Prevent infinite loops
  private systemAgent: Agent; // System agent for broadcasting messages

  constructor({ llmService, memorySystem, toolRegistry }: { 
    llmService: any; 
    memorySystem: any; 
    toolRegistry: any;
  }) {
    this.llm = llmService;
    this.memory = memorySystem;
    this.tools = toolRegistry;
    this.activeTasks = new Map();
    this.maxRecursionDepth = 5;
    
    // Initialize system agent for broadcasting messages
    this.systemAgent = {
      id: 'system',
      name: 'System',
      type: 'architect',
      status: 'idle',
      description: 'System agent for notifications',
    };
  }

  /**
   * Process a user request and generate a response
   * @param projectId - Project identifier
   * @param userInput - User's request text
   * @returns Promise with the agent's response
   */
  async processUserRequest(projectId: string, userInput: string): Promise<any> {
    try {
      console.log(`Processing user request for project ${projectId}: ${userInput}`);
      
      // 1. Store user input in short-term memory
      await this.memory.addToShortTermMemory(projectId, {
        role: 'user',
        content: userInput,
        timestamp: Date.now()
      });

      // 2. Retrieve relevant context from memory
      const conversationContext = await this.memory.getConversationContext(projectId);
      const relevantMemories = await this.memory.retrieveRelevantMemories(projectId, userInput);
      
      // 3. Plan approach to respond to the request
      const plan = await this.createPlan(userInput, conversationContext, relevantMemories);
      
      // Fetch project data for broadcasting messages
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
        
      if (projectError) {
        console.error('Error fetching project data:', projectError);
        throw new Error(`Failed to fetch project data: ${projectError.message}`);
      }
      
      // Broadcast planning message
      await broadcastMessage(
        this.systemAgent,
        `Planning response to: "${userInput}"`,
        projectData
      );
      
      // 4. Execute the plan
      const executionResult = await this.executePlan(projectId, plan);
      
      // 5. Store the interaction in long-term memory
      await this.memory.addToLongTermMemory(projectId, {
        userInput,
        plan,
        result: executionResult,
        timestamp: Date.now()
      });

      // 6. Store agent's response in short-term memory
      await this.memory.addToShortTermMemory(projectId, {
        role: 'assistant',
        content: executionResult.response,
        timestamp: Date.now()
      });

      // Broadcast completion message
      await broadcastMessage(
        this.systemAgent,
        `Completed request: "${userInput}"`,
        projectData
      );

      return {
        response: executionResult.response,
        thinking: executionResult.thinking,
        toolsUsed: executionResult.toolsUsed
      };
    } catch (error) {
      console.error('Error processing user request:', error);
      
      // Show error toast
      toast.error(`Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        response: "I encountered an error while processing your request. Please try again.",
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a plan to address the user's request
   * @param userInput - User's request
   * @param conversationContext - Recent conversation history
   * @param relevantMemories - Relevant information from long-term memory
   * @returns Promise with the action plan
   */
  private async createPlan(userInput: string, conversationContext: any[], relevantMemories: any[]): Promise<any> {
    // Prompt the LLM to create a plan
    const planningPrompt = this.buildPlanningPrompt(
      userInput, 
      conversationContext, 
      relevantMemories,
      this.tools.getToolDescriptions()
    );
    
    const planResponse = await this.llm.generateCompletion(planningPrompt);
    
    try {
      // Parse the plan from the LLM's response
      const plan = JSON.parse(planResponse);
      return {
        goal: plan.goal,
        reasoning: plan.reasoning,
        steps: plan.steps,
        requiredTools: plan.requiredTools,
        estimatedComplexity: plan.estimatedComplexity
      };
    } catch (error) {
      console.error('Error parsing plan:', error);
      // Fallback to a simpler plan format
      return {
        goal: "Respond to user request",
        reasoning: "Direct response needed",
        steps: [{ 
          type: "generate_response", 
          input: userInput,
          context: conversationContext
        }],
        requiredTools: [],
        estimatedComplexity: "low"
      };
    }
  }

  /**
   * Build the prompt for the planning phase
   * @param userInput - User's request
   * @param conversationContext - Recent conversation history
   * @param relevantMemories - Relevant information from memory
   * @param availableTools - Descriptions of available tools
   * @returns Prompt for the LLM
   */
  private buildPlanningPrompt(
    userInput: string, 
    conversationContext: any[], 
    relevantMemories: any[], 
    availableTools: any[]
  ): string {
    return `
You are an advanced AI agent tasked with planning how to respond to a user request.

USER REQUEST: "${userInput}"

CONVERSATION CONTEXT:
${JSON.stringify(conversationContext, null, 2)}

RELEVANT MEMORIES:
${JSON.stringify(relevantMemories, null, 2)}

AVAILABLE TOOLS:
${JSON.stringify(availableTools, null, 2)}

Create a detailed plan to address the user's request. Include:
1. The overall goal
2. Your reasoning process
3. Step-by-step actions required
4. Tools needed for each step
5. Estimated complexity (low, medium, high)

Respond with a JSON object in the following format:
{
  "goal": "Clear description of what you aim to accomplish",
  "reasoning": "Explanation of your approach and why it's appropriate",
  "steps": [
    {
      "id": 1,
      "description": "Description of the step",
      "type": "tool_name or generate_response",
      "input": "Input for the tool or reasoning task",
      "expectedOutput": "What you expect to get from this step",
      "fallbackAction": "What to do if the step fails"
    }
  ],
  "requiredTools": ["list", "of", "required", "tool", "names"],
  "estimatedComplexity": "low|medium|high"
}
`;
  }

  /**
   * Execute the plan created by the planning phase
   * @param projectId - Project identifier
   * @param plan - The plan object
   * @returns Promise with execution results
   */
  private async executePlan(projectId: string, plan: any): Promise<any> {
    const results = {
      thinking: [],
      toolsUsed: [],
      intermediateResults: [],
      response: ""
    };

    try {
      // Record the overall plan reasoning
      results.thinking.push({
        type: 'planning',
        content: plan.reasoning
      });

      // Execute each step in the plan
      for (const step of plan.steps) {
        const stepResult = await this.executeStep(projectId, step, results);
        
        results.intermediateResults.push({
          stepId: step.id,
          description: step.description,
          result: stepResult
        });

        // If this is a critical step and it failed, we might need to replan
        if (stepResult.error && !step.fallbackAction) {
          const newPlan = await this.recoverFromFailure(projectId, plan, step, stepResult.error);
          // Replace remaining steps with the new plan
          const currentIndex = plan.steps.findIndex((s: any) => s.id === step.id);
          plan.steps = [
            ...plan.steps.slice(0, currentIndex + 1),
            ...newPlan.steps
          ];
        }
      }

      // Generate the final response
      results.response = await this.generateFinalResponse(projectId, plan, results.intermediateResults);
      
      return results;
    } catch (error) {
      console.error('Error executing plan:', error);
      
      // Generate a fallback response
      results.response = "I tried to help with your request but encountered an unexpected issue. Could you please try rephrasing or providing more details?";
      
      return results;
    }
  }

  /**
   * Execute a single step in the plan
   * @param projectId - Project identifier
   * @param step - Step to execute
   * @param results - Current execution results
   * @returns Promise with step execution result
   */
  private async executeStep(projectId: string, step: any, results: any): Promise<any> {
    try {
      // Record this step in the thinking process
      results.thinking.push({
        type: 'step',
        id: step.id,
        description: step.description
      });

      // If step is to generate a response using the LLM
      if (step.type === 'generate_response') {
        const response = await this.llm.generateCompletion(step.input);
        return { success: true, output: response };
      }
      
      // If step requires a tool
      if (this.tools.hasTool(step.type)) {
        const tool = this.tools.getTool(step.type);
        results.toolsUsed.push(step.type);
        
        const toolResult = await tool.execute(step.input, projectId);
        return { success: true, output: toolResult };
      }

      // If step type is not recognized
      return {
        success: false,
        error: `Unknown step type: ${step.type}`
      };
    } catch (error) {
      console.error(`Error executing step ${step.id}:`, error);
      
      // Try to execute fallback action if available
      if (step.fallbackAction) {
        results.thinking.push({
          type: 'fallback',
          stepId: step.id,
          description: `Using fallback for step ${step.id}`
        });
        
        return await this.executeFallback(projectId, step.fallbackAction);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute a fallback action when a step fails
   * @param projectId - Project identifier
   * @param fallbackAction - Description of fallback action
   * @returns Promise with fallback execution result
   */
  private async executeFallback(projectId: string, fallbackAction: string): Promise<any> {
    // Prompt the LLM to generate a fallback response
    const fallbackPrompt = `
The original plan step failed. Please generate an appropriate fallback response or action.
Fallback description: ${fallbackAction}

Respond with a JSON object:
{
  "action": "description of fallback action",
  "response": "text to present to user if this is a terminal fallback"
}
`;

    try {
      const fallbackResponse = await this.llm.generateCompletion(fallbackPrompt);
      const fallback = JSON.parse(fallbackResponse);
      
      return {
        success: true,
        output: fallback.response,
        action: fallback.action
      };
    } catch (error) {
      console.error('Error executing fallback:', error);
      return {
        success: false,
        error: 'Failed to execute fallback action',
        output: "I couldn't complete this part of your request."
      };
    }
  }

  /**
   * Generate a new plan to recover from a step failure
   * @param projectId - Project identifier
   * @param originalPlan - The original plan that failed
   * @param failedStep - The step that failed
   * @param errorMessage - Error description
   * @returns Promise with new recovery plan
   */
  private async recoverFromFailure(projectId: string, originalPlan: any, failedStep: any, errorMessage: string): Promise<any> {
    const recoveryPrompt = `
You are executing a plan to respond to a user request, but a step has failed.

ORIGINAL PLAN:
${JSON.stringify(originalPlan, null, 2)}

FAILED STEP:
${JSON.stringify(failedStep, null, 2)}

ERROR:
${errorMessage}

Create a new plan to recover from this failure and still achieve the original goal.
Focus on alternative approaches that don't rely on the failed component.

Respond with a JSON plan object with the same structure as the original plan.
`;

    try {
      const recoveryResponse = await this.llm.generateCompletion(recoveryPrompt);
      return JSON.parse(recoveryResponse);
    } catch (error) {
      console.error('Error creating recovery plan:', error);
      
      // Return a minimal plan that just generates an apologetic response
      return {
        goal: "Recover from error",
        reasoning: "Original plan failed, providing explanation to user",
        steps: [{
          id: 1,
          description: "Generate apologetic response",
          type: "generate_response",
          input: `I apologize, but I'm having trouble completing your request due to a technical issue. Specifically, I encountered a problem when trying to ${failedStep.description}. Could you try a different approach or rephrase your request?`
        }],
        requiredTools: [],
        estimatedComplexity: "low"
      };
    }
  }

  /**
   * Generate the final response to the user
   * @param projectId - Project identifier
   * @param plan - The executed plan
   * @param intermediateResults - Results from each step
   * @returns Promise with final response text
   */
  private async generateFinalResponse(projectId: string, plan: any, intermediateResults: any[]): Promise<string> {
    // If the plan only had one step and it was a direct response, just return that
    if (plan.steps.length === 1 && plan.steps[0].type === 'generate_response') {
      const result = intermediateResults[0]?.result;
      if (result && result.success) {
        return result.output;
      }
    }

    // Otherwise, generate a synthesized response
    const responsePrompt = `
You are an AI agent that has just executed a plan to address a user request.

ORIGINAL PLAN:
${JSON.stringify(plan, null, 2)}

EXECUTION RESULTS:
${JSON.stringify(intermediateResults, null, 2)}

Based on these results, generate a coherent, helpful response to the user.
Your response should:
1. Address their original request
2. Incorporate information gathered during plan execution
3. Be conversational and natural
4. Avoid mentioning the internal planning process unless relevant

Respond directly with the text for the user.
`;

    try {
      return await this.llm.generateCompletion(responsePrompt);
    } catch (error) {
      console.error('Error generating final response:', error);
      return "I've collected the information you requested, but I'm having trouble putting it all together. Here's what I found: " + 
        intermediateResults
          .filter(r => r.result.success)
          .map(r => r.result.output)
          .join(" ");
    }
  }
}

export default AgentCore;
