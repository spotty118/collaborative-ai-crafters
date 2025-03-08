
// Agent Orchestration Edge Function
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabase-client.ts";
import { corsHeaders } from "../_shared/cors.ts";

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

if (!OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY environment variable is not set');
}

// Core Agent class
class Agent {
  role: string;
  model: string;
  memory: any[];
  taskHistory: any[];

  constructor(role: string, model: string) {
    this.role = role;
    this.model = model;
    this.memory = [];
    this.taskHistory = [];
  }

  async think(prompt: string) {
    try {
      // Enhanced thinking by leveraging Claude's reasoning capabilities
      const thinkingPrompt = `<thinking>
As a ${this.role} agent, I need to think deeply about this problem:

${prompt}

Let me break this down step by step:
1. What is being asked?
2. What information do I have?
3. What are the key constraints?
4. What approaches could I take?
5. What are the trade-offs of each approach?
6. What is my recommended solution?
</thinking>

Based on my analysis, here is my response:`;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://supabase.com",
          "X-Title": "Agentic Orchestration"
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: thinkingPrompt }],
          temperature: 0.2,
          max_tokens: 4000
        })
      });

      const data = await response.json();
      const thought = data.choices[0].message.content;
      this.memory.push({ prompt, thought });
      return thought;
    } catch (error) {
      console.error(`Error in ${this.role}'s thinking process:`, error);
      throw error;
    }
  }

  async executeTask(task: any) {
    const taskPrompt = `As a ${this.role} agent, execute the following task: ${task.description}
    
Previous context: ${JSON.stringify(task.context)}
Required output format: ${task.outputFormat}
`;
    
    const result = await this.think(taskPrompt);
    this.taskHistory.push({
      taskId: task.id,
      timestamp: new Date().toISOString(),
      task,
      result
    });
    
    return result;
  }
}

// Architect Agent - Main orchestrator
class ArchitectAgent extends Agent {
  agents: Record<string, Agent>;
  projectPlan: any;
  taskQueue: any[];
  completedTasks: any[];

  constructor(model: string) {
    super('Architect', model);
    this.agents = {};
    this.projectPlan = null;
    this.taskQueue = [];
    this.completedTasks = [];
  }

  registerAgent(agentId: string, agent: Agent) {
    this.agents[agentId] = agent;
    return this;
  }

  async designProject(projectDescription: string) {
    const designPrompt = `As the Architect agent, design a project plan for the following:
    
${projectDescription}

Create a detailed breakdown of:
1. Overall architecture and components needed
2. Specific tasks that need to be accomplished
3. Dependencies between tasks
4. What specialized agent should handle each task (choose from: coding, writing, research, analysis, creativity)
5. Expected outputs for each task

Format your response as a structured JSON object.`;

    const designThinking = await this.think(designPrompt);
    
    try {
      this.projectPlan = JSON.parse(designThinking);
      // Convert the project plan into actual tasks
      this.createTasksFromPlan();
      return this.projectPlan;
    } catch (error) {
      // If JSON parsing fails, try to extract JSON
      const jsonMatch = designThinking.match(/```json([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          this.projectPlan = JSON.parse(jsonMatch[1].trim());
          this.createTasksFromPlan();
          return this.projectPlan;
        } catch (innerError) {
          console.error("Failed to parse JSON from response:", innerError);
          throw new Error("Architect failed to create a valid project plan");
        }
      } else {
        console.error("Failed to parse JSON:", error);
        throw new Error("Architect failed to create a valid project plan");
      }
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
      result: null
    }));
  }

  getReadyTasks() {
    return this.taskQueue.filter(task => {
      if (task.status !== 'pending') return false;
      
      // Check if all dependencies are completed
      const allDependenciesMet = task.dependencies.every((depId: string) => {
        const depTask = this.completedTasks.find(t => t.id === depId);
        return depTask && depTask.status === 'completed';
      });
      
      return allDependenciesMet;
    });
  }

  async orchestrate() {
    while (this.taskQueue.length > 0) {
      const readyTasks = this.getReadyTasks();
      
      if (readyTasks.length === 0) {
        if (this.taskQueue.some(t => t.status === 'pending')) {
          throw new Error("Deadlock detected: There are pending tasks but none are ready to execute");
        }
        break;
      }
      
      // Process all ready tasks (could be done in parallel with Promise.all for efficiency)
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
        
        task.status = 'in-progress';
        try {
          task.result = await agent.executeTask(task);
          task.status = 'completed';
          
          // Move from queue to completed
          this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);
          this.completedTasks.push(task);
          
          console.log(`Completed task ${task.id}`);
        } catch (error) {
          task.status = 'failed';
          task.error = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed task ${task.id}:`, error);
          
          // Handle failure - could implement retry logic here
          this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);
          this.completedTasks.push(task);
        }
      }
    }
    
    return this.completedTasks;
  }

  async evaluateResults() {
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

    return await this.think(resultsPrompt);
  }
}

// Define specialized agents
class CodingAgent extends Agent {
  constructor(model: string) {
    super('Coding', model);
  }
}

class WritingAgent extends Agent {
  constructor(model: string) {
    super('Writing', model);
  }
}

class ResearchAgent extends Agent {
  constructor(model: string) {
    super('Research', model);
  }
}

class AnalysisAgent extends Agent {
  constructor(model: string) {
    super('Analysis', model);
  }
}

class CreativityAgent extends Agent {
  constructor(model: string) {
    super('Creativity', model);
  }
}

// Main orchestration control
async function runAgenticOrchestration(projectDescription: string, defaultModel: string, specializedModels: Record<string, string>) {
  // Create the architect
  const architect = new ArchitectAgent(defaultModel);
  
  // Register specialized agents
  architect
    .registerAgent('coding', new CodingAgent(specializedModels.coding))
    .registerAgent('writing', new WritingAgent(specializedModels.writing))
    .registerAgent('research', new ResearchAgent(specializedModels.research))
    .registerAgent('analysis', new AnalysisAgent(specializedModels.analysis))
    .registerAgent('creativity', new CreativityAgent(specializedModels.creativity));
  
  try {
    // Step 1: Design the project
    console.log("Architect designing project...");
    const projectPlan = await architect.designProject(projectDescription);
    console.log("Project plan created:", JSON.stringify(projectPlan, null, 2));
    
    // Step 2: Execute the plan
    console.log("Beginning project execution...");
    const results = await architect.orchestrate();
    console.log("Project execution completed");
    
    // Step 3: Evaluate results
    console.log("Evaluating project results...");
    const evaluation = await architect.evaluateResults();
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectDescription, projectId } = await req.json();
    
    if (!projectDescription) {
      return new Response(
        JSON.stringify({ error: 'Project description is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Configuration for models
    const defaultModel = 'anthropic/claude-3-7-sonnet-20250219';
    const specializedModels = {
      coding: 'anthropic/claude-3-7-sonnet-20250219',
      writing: 'anthropic/claude-3-7-sonnet-20250219',
      research: 'anthropic/claude-3-7-sonnet-20250219',
      analysis: 'anthropic/claude-3-7-sonnet-20250219',
      creativity: 'anthropic/claude-3-7-sonnet-20250219'
    };

    // Save project context if projectId is provided
    if (projectId) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) {
        console.error('Error fetching project:', projectError);
      } else {
        console.log('Project context:', project);
      }
    }

    // Run the orchestration
    const result = await runAgenticOrchestration(
      projectDescription,
      defaultModel,
      specializedModels
    );

    // Store results in Supabase if projectId is provided
    if (projectId) {
      // Store tasks
      for (const task of result.results) {
        const { error: taskError } = await supabase
          .from('tasks')
          .insert({
            project_id: projectId,
            title: task.description.substring(0, 50),
            description: task.description,
            status: task.status === 'completed' ? 'completed' : 'failed',
            assigned_to: task.assignedTo === 'coding' ? 'backend' : 
                        task.assignedTo === 'writing' ? 'frontend' : 
                        task.assignedTo === 'research' ? 'architect' : 
                        task.assignedTo === 'analysis' ? 'testing' : 'devops',
            metadata: {
              task_result: task.result,
              orchestration_id: task.id
            }
          });

        if (taskError) {
          console.error('Error saving task:', taskError);
        }
      }

      // Store evaluation as a message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          project_id: projectId,
          content: result.evaluation,
          sender: 'Architect',
          type: 'text'
        });

      if (messageError) {
        console.error('Error saving evaluation message:', messageError);
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in agent-orchestration function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
