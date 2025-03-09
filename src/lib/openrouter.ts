import { supabase } from '@/integrations/supabase/client';
import { Agent, Project, SendAgentPromptOptions } from '@/lib/types';
import { getEnvVariable, getOpenRouterApiKey, setLocalEnvVariable } from '@/lib/env';
import { OpenRouter } from 'openrouter-sdk';

// Agent class for orchestration
class AgentOrchestrator {
  private agents: Record<string, Agent> = {};
  private project: Project;
  private taskQueue: any[] = [];
  private completedTasks: any[] = [];
  private projectPlan: any = null;
  private agentMemory: Record<string, string[]> = {};
  private lastAgentOutput: Record<string, string> = {};
  private openrouterClient: any = null;

  constructor(project: Project, agents: Agent[]) {
    this.project = project;
    
    // Register all agents by their type
    agents.forEach(agent => {
      this.agents[agent.type] = agent;
      this.agentMemory[agent.type] = [];
    });

    // Initialize reference to use OpenRouter
    const apiKey = getOpenRouterApiKey();
    if (apiKey) {
      this.openrouterClient = true; // Just indicate we have a key and can use OpenRouter
    }
  }

  async designProject(projectDescription: string): Promise<any> {
    if (!this.agents['architect']) {
      throw new Error('Architect agent is required for project design');
    }

    const designPrompt = `As the Architect agent, design a project plan for the following:
    
${projectDescription}

Create a detailed breakdown of:
1. Overall architecture and components needed
2. Specific tasks that need to be accomplished
3. Dependencies between tasks
4. What specialized agent should handle each task (choose from: frontend, backend, testing, devops)
5. Expected outputs for each task
6. INCLUDE SPECIFIC CODE FILE NAMES that need to be created by each agent

Format your response as a structured JSON object.`;

    try {
      // Use SDK directly to communicate with OpenRouter
      const designThinking = await this.sendPromptToAgent(
        this.agents['architect'], 
        designPrompt,
        { model: getDefaultModelForAgentType('architect'), ignoreStatus: true }
      );
      
      // Store in memory
      this.agentMemory['architect'].push(designThinking);
      this.lastAgentOutput['architect'] = designThinking;
      
      // Try to parse the JSON response
      try {
        // First try parsing directly
        this.projectPlan = JSON.parse(designThinking);
      } catch (error) {
        // If direct parsing fails, try to extract JSON from markdown code blocks
        const jsonMatch = designThinking.match(/```json([\s\S]*?)```/);
        if (jsonMatch && jsonMatch[1]) {
          this.projectPlan = JSON.parse(jsonMatch[1].trim());
        } else {
          throw new Error("Architect failed to create a valid project plan");
        }
      }
      
      // Convert the project plan into actual tasks
      this.createTasksFromPlan();
      return this.projectPlan;
    } catch (error) {
      console.error("Failed to design project:", error);
      throw error;
    }
  }

  createTasksFromPlan() {
    if (!this.projectPlan || !this.projectPlan.tasks) {
      throw new Error("Invalid project plan");
    }

    this.taskQueue = this.projectPlan.tasks.map((task: any, index: number) => ({
      id: `task-${index}`,
      description: task.description,
      assignedTo: task.assignedTo,
      dependencies: task.dependencies || [],
      status: 'pending',
      outputFormat: task.outputFormat || 'text',
      context: task.context || [],
      filename: task.filename || null,
      codeType: task.codeType || null,
      result: null
    }));
  }

  getReadyTasks() {
    return this.taskQueue.filter((task: any) => {
      if (task.status !== 'pending') return false;
      
      // Check if all dependencies are completed
      const allDependenciesMet = task.dependencies.every((depId: string) => {
        const depTask = this.completedTasks.find(t => t.id === depId);
        return depTask && depTask.status === 'completed';
      });
      
      return allDependenciesMet;
    });
  }

  async sendPromptToAgent(agent: Agent, prompt: string, options?: SendAgentPromptOptions): Promise<string> {
    if (!this.openrouterClient) {
      throw new Error('OpenRouter client is not initialized. Please provide an API key.');
    }

    const enhancedPrompt = addProjectContextToPrompt(prompt, this.project, options?.expectCode);
    const model = options?.model || getDefaultModelForAgentType(agent.type);
    const agentRole = getAgentRole(agent.type);
    
    // Construct messages for the LLM
    const messages = [];
    
    // Add system role if available
    if (agentRole) {
      messages.push({ role: 'system', content: agentRole });
    }
    
    // Add the main prompt as user message
    messages.push({ role: 'user', content: enhancedPrompt });
    
    try {
      const apiKey = getOpenRouterApiKey();
      if (!apiKey) {
        throw new Error('OpenRouter API key is required');
      }
      
      // Create OpenRouter instance
      const openRouter = new OpenRouter({ apiKey });
      
      // Make API call - use the completions.create method from the OpenRouter SDK
      const response = await openRouter.completions.create({
        model: model,
        messages: messages,
        temperature: 0.3,
        max_tokens: 1024,
      });
      
      // Extract response content
      if (response.choices && response.choices[0] && response.choices[0].message) {
        return response.choices[0].message.content;
      } else {
        throw new Error('Unexpected response format from OpenRouter');
      }
    } catch (error) {
      console.error('Error communicating with OpenRouter:', error);
      throw error;
    }
  }

  async orchestrate(): Promise<any[]> {
    while (this.taskQueue.length > 0) {
      const readyTasks = this.getReadyTasks();
      
      if (readyTasks.length === 0) {
        if (this.taskQueue.some(t => t.status === 'pending')) {
          throw new Error("Deadlock detected: There are pending tasks but none are ready to execute");
        }
        break;
      }
      
      // Process all ready tasks
      for (const task of readyTasks) {
        console.log(`Executing task ${task.id}: ${task.description}`);
        
        // Update task context with results from dependencies
        for (const depId of task.dependencies) {
          const depTask = this.completedTasks.find(t => t.id === depId);
          if (depTask) {
            task.context.push({
              from: depId,
              result: depTask.result
            });
          }
        }
        
        const agent = this.agents[task.assignedTo];
        if (!agent) {
          throw new Error(`No agent registered for role: ${task.assignedTo}`);
        }
        
        task.status = 'in_progress';
        try {
          // Get previous work from all agents to provide context
          const allAgentMemory = Object.entries(this.agentMemory)
            .map(([agentType, memory]) => {
              if (memory.length > 0) {
                return `${agentType.toUpperCase()} AGENT PREVIOUSLY SAID:\n${memory[memory.length - 1]}\n\n`;
              }
              return '';
            })
            .join('\n');
          
          // Prepare the task execution prompt
          const taskPrompt = `Execute the following task: ${task.description}
          
YOU MUST OUTPUT ACTUAL CODE, not just descriptions. Create complete, functional files.

${task.filename ? `Create this specific file: ${task.filename}` : ''}
${task.codeType ? `Write code in: ${task.codeType}` : ''}

Previous task context: ${JSON.stringify(task.context)}

Here's what other agents have said:
${allAgentMemory}

Required output format: ${task.outputFormat}

IMPORTANT: Always provide the entire code file with imports and all implementation details. DO NOT just provide code snippets.
If you're writing React components, include all necessary imports and the full component implementation.
`;
          
          // Execute the task using OpenRouter SDK
          task.result = await this.sendPromptToAgent(
            agent, 
            taskPrompt,
            { 
              model: getDefaultModelForAgentType(agent.type),
              ignoreStatus: true, // Bypass status check for orchestration
              expectCode: true    // Signal that we expect code
            }
          );
          
          // Store in agent memory
          this.agentMemory[agent.type].push(task.result);
          this.lastAgentOutput[agent.type] = task.result;
          
          task.status = 'completed';
          
          // If this task is creating a code file, try to extract the code and save it
          if (task.filename) {
            try {
              const extractedCode = extractCodeFromResponse(task.result, task.codeType || '');
              if (extractedCode) {
                // Save the code file to the database
                await saveCodeFile(this.project.id, task.filename, extractedCode, agent.type);
              }
            } catch (codeError) {
              console.error(`Failed to extract or save code:`, codeError);
            }
          }
          
          // Move from queue to completed
          this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);
          this.completedTasks.push(task);
          
          console.log(`Completed task ${task.id}`);
        } catch (error) {
          task.status = 'failed';
          task.error = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed task ${task.id}:`, error);
          
          this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);
          this.completedTasks.push(task);
        }
      }
    }
    
    return this.completedTasks;
  }

  async evaluateResults(): Promise<string> {
    if (!this.agents['architect']) {
      throw new Error('Architect agent is required for project evaluation');
    }

    const resultsPrompt = `As the Architect agent, evaluate the results of the project:
    
Project Plan: ${JSON.stringify(this.projectPlan)}

Completed Tasks and Results:
${JSON.stringify(this.completedTasks, null, 2)}

Provide a comprehensive evaluation including:
1. Overall success of the project
2. Quality of individual task outputs
3. Areas for improvement
4. Recommendations for future iterations
`;

    return await this.sendPromptToAgent(
      this.agents['architect'], 
      resultsPrompt,
      { 
        model: getDefaultModelForAgentType('architect'),
        ignoreStatus: true // Bypass status check for evaluations
      }
    );
  }
  
  // Get the last output from a specific agent
  getAgentOutput(agentType: string): string {
    return this.lastAgentOutput[agentType] || '';
  }
}

// Function to extract code from a response
function extractCodeFromResponse(response: string, codeType: string): string | null {
  // Try to extract code from markdown code blocks
  const codeBlockRegex = new RegExp('```(?:' + codeType + ')?([\\s\\S]*?)```', 'g');
  const matches = [...response.matchAll(codeBlockRegex)];
  
  if (matches.length > 0) {
    // Return the contents of the first code block
    return matches[0][1].trim();
  }
  
  // If no code blocks found, return null
  return null;
}

// Function to save code to the database
async function saveCodeFile(projectId: string, filePath: string, content: string, createdBy: string): Promise<void> {
  try {
    const fileName = filePath.split('/').pop() || filePath;
    const fileExtension = fileName.split('.').pop() || '';
    let language = '';
    
    // Determine language based on file extension
    switch (fileExtension.toLowerCase()) {
      case 'js':
        language = 'javascript';
        break;
      case 'jsx':
        language = 'jsx';
        break;
      case 'ts':
        language = 'typescript';
        break;
      case 'tsx':
        language = 'tsx';
        break;
      case 'css':
        language = 'css';
        break;
      case 'html':
        language = 'html';
        break;
      case 'json':
        language = 'json';
        break;
      default:
        language = fileExtension;
    }
    
    // Save to database
    const { error } = await supabase.from('code_files').insert({
      project_id: projectId,
      name: fileName,
      path: filePath,
      content: content,
      language: language,
      created_by: createdBy,
      last_modified_by: createdBy
    });
    
    if (error) {
      throw error;
    }
    
    console.log(`Saved code file: ${filePath}`);
  } catch (error) {
    console.error('Error saving code file:', error);
    throw error;
  }
}

/**
 * Send a prompt to an agent through OpenRouter
 * @param agent The agent to send the prompt to
 * @param prompt The prompt to send
 * @param project The project context
 * @param options Additional options like model, images, and status check bypass
 * @returns The response from the agent
 */
export const sendAgentPrompt = async (
  agent: Agent,
  prompt: string,
  project: Project,
  options?: SendAgentPromptOptions
): Promise<string> => {
  console.log(`Sending prompt to ${agent.name} (${agent.type}) agent using ${options?.model || 'default'} model`);
  console.log(`Prompt: ${prompt.substring(0, 100)}...`);
  
  try {
    // Check if agent is in a stopped state, unless ignoreStatus is true
    if (!options?.ignoreStatus && agent.status === 'idle') {
      console.log(`Agent ${agent.name} is in idle state, stopping the operation`);
      throw new Error(`Agent ${agent.name} has been stopped or is idle. Please restart the agent to continue.`);
    }
    
    // Choose the model based on agent type or use the one specified in options
    const model = options?.model || getDefaultModelForAgentType(agent.type);
    
    // Enhance the prompt with project context
    const enhancedPrompt = addProjectContextToPrompt(prompt, project, options?.expectCode);
    
    // Get the OpenRouter API key
    const apiKey = getOpenRouterApiKey();
    
    // Use OpenRouter SDK directly (preferred approach)
    if (apiKey) {
      try {
        console.log('Using OpenRouter SDK directly');
        
        // Construct messages for OpenRouter
        const messages = [];
        
        // Check if this is a multimodal prompt with images
        if (options?.images && options.images.length > 0) {
          console.log('Processing multimodal prompt with images');
          
          const messageContent = [];
          
          // Add text content
          messageContent.push({
            type: 'text',
            text: `${getAgentRole(agent.type)}\n\n${enhancedPrompt}`
          });
          
          // Add image URLs
          for (const imageUrl of options.images) {
            messageContent.push({
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            });
          }
          
          messages.push({
            role: 'user',
            content: messageContent
          });
        } else {
          // Standard text-only prompt
          const agentRole = getAgentRole(agent.type);
          if (agentRole) {
            messages.push({ role: 'system', content: agentRole });
            messages.push({ role: 'user', content: enhancedPrompt });
          } else {
            messages.push({ role: 'user', content: enhancedPrompt });
          }
        }
        
        // Initialize the OpenRouter client with API key
        const openRouter = new OpenRouter({ apiKey });
        
        // Call OpenRouter API using the correct method for the SDK
        const completion = await openRouter.completions.create({
          model: model,
          messages: messages,
          temperature: 0.3,
          max_tokens: 1024,
        });
        
        if (completion.choices && completion.choices[0] && completion.choices[0].message) {
          return completion.choices[0].message.content;
        } else {
          throw new Error('Unexpected response format from OpenRouter');
        }
      } catch (error) {
        console.error('Error using OpenRouter SDK:', error);
        throw error;
      }
    } else {
      // Fallback to Edge Function if API key is not available locally
      // This will not be used if the SDK is properly configured
      console.log('Falling back to Edge Function as OpenRouter API key is not available');
      
      const requestPayload = {
        agentType: agent.type,
        prompt: enhancedPrompt,
        projectContext: {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
        },
        model,
        images: options?.images || [],
        context: options?.context || '',
        task: options?.task || '',
        expectCode: options?.expectCode || false
      };
      
      const { data, error } = await supabase.functions.invoke('openrouter', {
        body: requestPayload
      });
  
      if (error) {
        console.error('OpenRouter function error:', error);
        throw new Error(`OpenRouter function error: ${error.message}`);
      }
  
      if (!data) {
        console.error('No data returned from OpenRouter function');
        throw new Error('No response received from the AI service');
      }
  
      // Extract content from the response
      if (data.content) {
        return data.content;
      } else if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      } else {
        console.warn('Unexpected response format from OpenRouter:', data);
        return 'I received your request but encountered an issue processing it.';
      }
    }
  } catch (error) {
    console.error('Error in sendAgentPrompt:', error);
    throw new Error(`Failed to get response from OpenRouter: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Helper functions

/**
 * Get the default model for an agent type
 */
function getDefaultModelForAgentType(agentType: string): string {
  switch (agentType) {
    case 'architect':
    case 'backend':
      return 'anthropic/claude-3.5-sonnet:thinking';
    case 'frontend':
      return 'anthropic/claude-3.5-sonnet:thinking';
    case 'testing':
      return 'anthropic/claude-3.5-sonnet:thinking';
    case 'devops':
      return 'anthropic/claude-3.5-sonnet:thinking';
    default:
      return 'anthropic/claude-3.5-sonnet:thinking';
  }
}

/**
 * Add project context to a prompt
 */
function addProjectContextToPrompt(prompt: string, project: Project, expectCode?: boolean): string {
  let baseContext = `Project: ${project.name}
Description: ${project.description || 'No description'}
${project.tech_stack && project.tech_stack.length > 0 ? `Tech Stack: ${project.tech_stack.join(', ')}` : ''}

`;

  if (expectCode) {
    baseContext += `IMPORTANT: I need you to write complete, functional code files. Do not provide explanations or partial snippets.
1. Start by writing the full code file including all necessary imports
2. Make sure your code is complete and can be directly used in the project
3. Integrate with the existing tech stack: ${project.tech_stack?.join(', ') || 'React'}
4. Provide the entire implementation - no placeholders or TODOs
5. If you're writing a React component, include all necessary imports and the full component code

`;
  } else {
    baseContext += `IMPORTANT: When asked to create or modify code, you MUST provide complete, functional code files that can be directly used in the project. Don't provide snippets or partial code. Always include imports and full implementation.

`;
  }

  return baseContext + prompt;
}

/**
 * Analyze a GitHub repository and create tasks
 */
export const analyzeGitHubAndCreateTasks = async (
  repoUrl: string,
  project: Project
): Promise<void> => {
  console.log(`Analyzing GitHub repository: ${repoUrl} for project ${project.id}`);
};

/**
 * Orchestrate agents for project execution
 */
export const orchestrateAgents = async (
  project: Project,
  agents: Agent[],
  description: string
): Promise<{
  projectPlan: any;
  results: any[];
  evaluation: string;
}> => {
  try {
    const orchestrator = new AgentOrchestrator(project, agents);
    
    // Step 1: Design the project
    console.log("Architect designing project...");
    const projectPlan = await orchestrator.designProject(description);
    console.log("Project plan created:", JSON.stringify(projectPlan, null, 2));
    
    // Step 2: Execute the plan
    console.log("Beginning project execution...");
    const results = await orchestrator.orchestrate();
    console.log("Project execution completed");
    
    // Step 3: Evaluate results
    console.log("Evaluating project results...");
    const evaluation = await orchestrator.evaluateResults();
    console.log("Evaluation complete");
    
    return {
      projectPlan,
      results,
      evaluation
    };
  } catch (error) {
    console.error("Orchestration error:", error);
    throw error;
  }
}

// Agent roles for system prompts
function getAgentRole(agentType: string): string {
  switch (agentType) {
    case 'architect':
      return 'You are an experienced software architect whose PRIMARY ROLE is ORCHESTRATION. Your job is NOT to implement but to COORDINATE other agents. You MUST:\n\n1. First, create a high-level design (keep this VERY brief)\n2. Immediately DELEGATE all implementation tasks to specialized agents\n3. For EVERY design decision, explicitly state which agent should implement it\n4. ALWAYS end your responses with explicit activation instructions like: "I will now activate the frontend agent to implement the UI components" or "I will now activate the backend agent to implement the API endpoints"\n\nNEVER provide detailed implementation - your job is DELEGATION. Keep design brief and focus on assigning tasks to agents. DO NOT write code yourself - immediately delegate to the appropriate specialized agent.';
    case 'frontend':
      return 'You are a frontend development expert. Your expertise includes UI/UX implementation, responsive design, and modern frontend frameworks. Provide detailed guidance on creating effective user interfaces and client-side functionality. When asked to generate code, focus on creating complete files and components that meet the requirements. ALWAYS provide full, functional implementations, never partial code or snippets.';
    case 'backend':
      return 'You are a backend development expert. Your expertise includes API design, database modeling, and server-side architecture. Provide detailed guidance on creating robust, secure server-side applications. When asked to generate code, focus on creating complete files and components that meet the requirements. ALWAYS provide full, functional implementations, never partial code or snippets.';
    case 'testing':
      return 'You are a software testing expert. Your expertise includes test strategies, test automation, and quality assurance processes. Provide detailed guidance on ensuring software quality through effective testing. When asked to generate code, focus on creating complete files and components that meet the requirements. ALWAYS provide full, functional implementations, never partial code or snippets.';
    case 'devops':
      return 'You are a DevOps expert. Your expertise includes CI/CD pipelines, infrastructure as code, and deployment strategies. Provide detailed guidance on automating and optimizing development and deployment processes. When asked to generate code, focus on creating complete files and components that meet the requirements. ALWAYS provide full, functional implementations, never partial code or snippets.';
    default:
      return 'You are an AI assistant with expertise in software development. Provide helpful, accurate, and detailed responses to technical questions. When asked to generate code, focus on creating complete files and components that meet the requirements. ALWAYS provide full, functional implementations, never partial code or snippets.';
  }
}

/**
 * Sets the OpenRouter API key and returns a new OpenRouter client instance
 */
export const setOpenRouterApiKey = (apiKey: string): any | null => {
  if (!apiKey) return null;
  
  try {
    // Save to localStorage
    setLocalEnvVariable('OPENROUTER_API_KEY', apiKey);
    
    // Return true to indicate success
    return true;
  } catch (error) {
    console.error('Error setting OpenRouter API key:', error);
    return null;
  }
};
