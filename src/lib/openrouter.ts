import { supabase } from '@/integrations/supabase/client';
import { Agent, Project, CodeFileDB } from '@/lib/types';
import { createTask, createCodeFile, createMessage, getAgents } from './api';
import { parseCodeBlocks, inferFilePath } from './codeParser';
import { getGitHubService } from './services/GitHubService';
import { toast } from 'sonner';
import { 
  initiateConversation, 
  broadcastMessage 
} from './agent/messageBroker';
import {
  startAgentWithOrchestration,
  stopAgentWithOrchestration,
  restartAgentWithOrchestration,
  handleTaskCompletion
} from './agent/orchestrator';

export interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    index: number;
    finish_reason: string;
  }[];
  error?: string;
}

/**
 * Send a prompt to an agent and get a response via OpenRouter
 */
export const sendAgentPrompt = async (
  agent: Agent,
  prompt: string,
  project?: Project
): Promise<string> => {
  try {
    console.log(`Sending prompt to ${agent.name} (${agent.type}) agent using google/gemini-2.0-flash-thinking-exp:free model`);
    
    // Prepare detailed project context including GitHub repo if available
    const projectContext = project ? {
      id: project.id,
      name: project.name,
      description: project.description,
      techStack: project.techStack,
      status: project.status,
      sourceType: project.sourceType,
      sourceUrl: project.sourceUrl
    } : {};
    
    // Add GitHub-specific analysis instructions if repo URL is available
    let enhancedPrompt = prompt;
    if (project?.sourceUrl && project.sourceUrl.includes('github.com')) {
      if (!enhancedPrompt.includes('analyze') && !enhancedPrompt.includes('repository')) {
        enhancedPrompt = `For the GitHub repository at ${project.sourceUrl}, ${enhancedPrompt}. When providing code solutions, use markdown code blocks with language and optional file path in square brackets. Example: \`\`\`typescript [src/example.ts]\`.`;
      }
    }
    
    // Add special instructions for Architect agent to lead the team
    if (agent.type === 'architect') {
      enhancedPrompt = `As the lead Architect agent, you are in charge of coordinating the entire development team. ${enhancedPrompt} Remember that you should delegate specialized tasks to the appropriate agents (frontend, backend, testing, devops) and make high-level design decisions that guide the project. Focus on system architecture, project structure, and technical leadership.`;
    }
    
    // Always include instruction to format code responses properly
    if (!enhancedPrompt.includes('code blocks')) {
      enhancedPrompt += ` When providing code, please use markdown code blocks with language and file path. For example: \`\`\`typescript [src/utils/helper.ts]\ncode here\n\`\`\``;
    }
    
    const { data, error } = await supabase.functions.invoke('openrouter', {
      body: {
        agentType: agent.type,
        prompt: enhancedPrompt,
        projectContext
      }
    });

    if (error) {
      console.error('Error calling OpenRouter function:', error);
      return `Error: ${error.message}`;
    }

    const response = data as OpenRouterResponse;
    
    if (response.error) {
      console.error('OpenRouter API error:', response.error);
      return `Error: ${response.error}`;
    }

    if (response.choices && response.choices.length > 0) {
      const content = response.choices[0].message.content;
      
      console.log("Received response from OpenRouter, parsing code blocks...");
      
      // Look for code blocks in the response
      const codeBlocks = parseCodeBlocks(content);
      console.log(`Found ${codeBlocks.length} code blocks in response`);
      
      // If we have code blocks and project has a project ID, save them as code files
      if (codeBlocks.length > 0 && project?.id) {
        try {
          console.log("Processing code blocks to save as files...");
          for (const block of codeBlocks) {
            const path = block.path || inferFilePath(block);
            console.log(`Processing code block: ${path} (${block.language})`);
            
            if (!block.content || block.content.trim() === '') {
              console.warn(`Empty content for ${path}, skipping`);
              continue;
            }
            
            const fileName = path.split('/').pop() || 'untitled';
            
            // Save to database
            console.log(`Creating code file in database: ${path}`);
            await createCodeFile({
              name: fileName,
              path: path,
              content: block.content,
              language: block.language,
              created_by: agent.name,
              last_modified_by: agent.name,
              project_id: project.id
            });
            
            console.log(`Saved code file: ${path}`);
            toast.success(`Created code file: ${path}`);
            
            // Try to commit to GitHub if configured
            if (project.sourceUrl && project.sourceUrl.includes('github.com')) {
              try {
                const github = getGitHubService();
                if (!github) {
                  console.warn('GitHub service not available - skipping commit');
                  continue;
                }
                
                await github.createOrUpdateFile(
                  path,
                  block.content,
                  `feat: ${agent.name} generated ${path}`
                );
                console.log(`Successfully committed ${path} to GitHub`);
              } catch (error) {
                if (error instanceof Error && error.message.includes('not initialized')) {
                  console.warn('GitHub service not initialized - skipping code commits');
                } else {
                  console.error('Error committing code to GitHub:', error);
                  toast.error('Failed to commit code to GitHub: ' + 
                    (error instanceof Error ? error.message : 'Unknown error')
                  );
                }
              }
            }
          }
        } catch (error) {
          console.error('Error saving code files:', error);
          toast.error('Error saving code files: ' + 
            (error instanceof Error ? error.message : 'Unknown error')
          );
        }
      }
      
      return content;
    }

    return 'No response generated. Please try again.';
  } catch (error) {
    console.error('Exception when calling OpenRouter:', error);
    return `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
  }
};

/**
 * Simulate inter-agent communication by creating messages between agents
 * Using the new orchestrated communication system
 */
export const simulateAgentCommunication = async (
  sourceAgent: Agent,
  targetAgent: Agent,
  message: string,
  project: Project
): Promise<void> => {
  if (!project.id) return;

  try {
    console.log(`${sourceAgent.name} is communicating with ${targetAgent.name}`);
    
    // Use the new message broker system for coordinated communication
    initiateConversation(sourceAgent, targetAgent, message, project);
  } catch (error) {
    console.error('Error in agent communication:', error);
    // Error handling
    try {
      await createMessage({
        project_id: project.id,
        content: `Communication interrupted due to system constraints. Will resume shortly. [Error: ${error instanceof Error ? error.message : 'Unknown error'}]`,
        sender: 'System',
        type: "text"
      });
    } catch (innerError) {
      console.error('Failed to send error message:', innerError);
    }
  }
};

/**
 * Analyze GitHub repository and create tasks
 */
export const analyzeGitHubAndCreateTasks = async (
  agent: Agent,
  project: Project
): Promise<boolean> => {
  if (!project.sourceUrl || !project.sourceUrl.includes('github.com')) {
    console.error('No GitHub repository URL found for this project');
    return false;
  }

  try {
    // Prioritize architect agent for analysis
    let analysisAgent = agent;
    if (agent.type !== 'architect') {
      // Find architect agent if available
      // Make sure to check if agents array exists first
      const architectAgent = project.agents ? 
        project.agents.find(a => a.type === 'architect') : 
        null;
      
      if (architectAgent) {
        console.log(`Delegating GitHub analysis to Architect agent instead of ${agent.name}`);
        analysisAgent = architectAgent;
      } else {
        // Fallback to fetch architect agent if not in project object
        console.log("No architect agent found in project.agents, fetching...");
        const fetchedAgents = await getAgents(project.id);
        const fetchedArchitect = fetchedAgents.find(a => a.type === 'architect');
        
        if (fetchedArchitect) {
          console.log(`Fetched Architect agent for GitHub analysis`);
          analysisAgent = fetchedArchitect;
        }
      }
    }
    
    // Create an analysis prompt based on the agent type
    const analysisPrompts: Record<string, string> = {
      'architect': `As the lead Architect, analyze the GitHub repository at ${project.sourceUrl} and create a comprehensive development plan. List 3-5 specific tasks to improve the overall architecture and project structure. Then specify which tasks should be delegated to other team members based on their specialties.`,
      'frontend': `Analyze the GitHub repository frontend at ${project.sourceUrl} and list 3-5 specific tasks to improve UI/UX, performance, and code quality.`,
      'backend': `Analyze the GitHub repository backend at ${project.sourceUrl} and list 3-5 specific tasks to improve API design, database optimization, and security.`,
      'testing': `Analyze the GitHub repository testing at ${project.sourceUrl} and list 3-5 specific tasks to improve test coverage and quality assurance.`,
      'devops': `Analyze the GitHub repository DevOps setup at ${project.sourceUrl} and list 3-5 specific tasks to improve CI/CD, deployment, and infrastructure.`
    };
    
    const prompt = analysisPrompts[analysisAgent.type] || `Analyze the GitHub repository at ${project.sourceUrl} and list 3-5 specific tasks to improve it.`;
    
    console.log(`Agent ${analysisAgent.name} analyzing GitHub repository: ${project.sourceUrl}`);
    
    // Get analysis response from AI
    const analysisResponse = await sendAgentPrompt(analysisAgent, prompt, project);
    
    // Parse tasks from the response and create them
    const tasks = parseTasksFromAIResponse(analysisResponse, analysisAgent, project);
    
    // Create each task in the database
    for (const task of tasks) {
      // Safely check for project.agents
      const agents = project.agents || await getAgents(project.id);
      
      await createTask({
        title: task.title,
        description: task.description,
        priority: 'medium',
        status: 'pending',
        assigned_to: task.title.toLowerCase().includes('frontend') ? 
          agents.find(a => a.type === 'frontend')?.id || analysisAgent.id :
          task.title.toLowerCase().includes('backend') ?
          agents.find(a => a.type === 'backend')?.id || analysisAgent.id :
          task.title.toLowerCase().includes('test') ?
          agents.find(a => a.type === 'testing')?.id || analysisAgent.id :
          task.title.toLowerCase().includes('deploy') || task.title.toLowerCase().includes('ci/cd') ?
          agents.find(a => a.type === 'devops')?.id || analysisAgent.id :
          analysisAgent.id,
        project_id: project.id
      });
    }
    
    console.log(`Agent ${analysisAgent.name} created ${tasks.length} tasks from GitHub analysis`);
    
    // If architect performed the analysis, have them delegate tasks to other agents using the new orchestration
    if (analysisAgent.type === 'architect') {
      setTimeout(async () => {
        const agents = project.agents || await getAgents(project.id);
        
        if (agents && agents.length > 0) {
          broadcastMessage(
            analysisAgent,
            `I've analyzed the repository and created tasks. Let's collaborate on implementing them efficiently.`,
            project,
            3
          );
        }
      }, 5000);
    }
    
    return true;
  } catch (error) {
    console.error('Error analyzing GitHub repository:', error);
    return false;
  }
};

/**
 * Parse tasks from AI response
 */
function parseTasksFromAIResponse(
  response: string,
  agent: Agent,
  project: Project
): Array<{title: string, description: string}> {
  const tasks: Array<{title: string, description: string}> = [];
  
  // Split response by common list markers and newlines
  const lines = response.split(/\n+/);
  
  let currentTask: {title: string, description: string} | null = null;
  
  for (const line of lines) {
    // Check if line starts with a number or bullet point, indicating a new task
    const taskMatch = line.match(/^(\d+[.)]|-|\*)\s+(.+)$/);
    
    if (taskMatch) {
      // If we have a current task, add it to the collection
      if (currentTask) {
        tasks.push(currentTask);
      }
      
      // Start a new task with this line as the title
      currentTask = {
        title: taskMatch[2].trim(),
        description: `Task suggested by ${agent.name} for ${project.name}`
      };
    } else if (currentTask && line.trim() && !line.startsWith('#')) {
      // Add non-empty, non-header lines to the current task description
      currentTask.description += '\n' + line.trim();
    }
  }
  
  // Add the last task if we have one
  if (currentTask) {
    tasks.push(currentTask);
  }
  
  // If we couldn't parse any tasks, create a general task based on the agent type
  if (tasks.length === 0) {
    const fallbackTasks: Record<string, string> = {
      'architect': 'Improve project architecture and coordinate team efforts',
      'frontend': 'Enhance user interface components',
      'backend': 'Optimize API and database operations',
      'testing': 'Increase test coverage',
      'devops': 'Streamline deployment process'
    };
    
    tasks.push({
      title: fallbackTasks[agent.type] || `${agent.name} improvement task`,
      description: `General improvement task from ${agent.name}:\n\n${response}`
    });
  }
  
  return tasks;
}

/**
 * Continue agent work on completion of a task
 * Now using the orchestrated approach
 */
export const continueAgentWork = async (
  agent: Agent, 
  project: Project, 
  completedTaskId?: string
): Promise<void> => {
  if (!project.id) return;
  
  try {
    console.log(`Continuing work for ${agent.name} after task completion`);
    
    // Use the orchestration system to handle task completion
    if (completedTaskId) {
      handleTaskCompletion(agent, completedTaskId, project);
    } else {
      // If no specific task was completed, just continue general work
      startAgentWithOrchestration(agent, project);
    }
  } catch (error) {
    console.error('Error in continuing agent work:', error);
  }
};

// Update the OpenRouter function to ensure Architect agent leads the team
export const updateOpenRouterForArchitectLeadership = async (project: Project): Promise<void> => {
  if (!project.id) return;
  
  try {
    // Get the architect agent
    const agents = project.agents || await getAgents(project.id);
    const architectAgent = agents.find(a => a.type === 'architect');
    
    if (!architectAgent) {
      console.log('No architect agent found to establish leadership');
      return;
    }
    
    // Initialize the orchestration with the architect as leader
    startAgentWithOrchestration(architectAgent, project);
  } catch (error) {
    console.error('Error establishing architect leadership:', error);
  }
};

/**
 * Handle rate limiting when communicating with the OpenRouter API
 */
export const handleRateLimiting = async (
  project: Project
): Promise<void> => {
  if (!project.id) return;
  
  try {
    // Log rate limiting issue
    await createMessage({
      project_id: project.id,
      content: "The AI service is experiencing high demand. Agents will communicate at a reduced frequency to ensure continuous operation.",
      sender: "System",
      type: "text"
    });
    
    // Get architect agent to manage the rate-limited situation
    const agents = project.agents || await getAgents(project.id);
    const architectAgent = agents.find(a => a.type === 'architect');
    
    if (architectAgent) {
      broadcastMessage(
        architectAgent,
        "Due to API rate limits, I'll be coordinating our communications more efficiently. We'll prioritize critical tasks and space out our interactions.",
        project,
        3
      );
    }
  } catch (error) {
    console.error('Error handling rate limiting:', error);
  }
};
