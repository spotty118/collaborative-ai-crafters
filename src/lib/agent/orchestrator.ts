
import { Agent, Project, Task } from '@/lib/types';
import { sendAgentPrompt } from '@/lib/openrouter';
import { createMessage, getAgents, createTask } from '@/lib/api';
import { 
  acquireToken, 
  releaseToken, 
  initiateConversation, 
  broadcastMessage, 
  resolveConflict 
} from './messageBroker';
import { toast } from 'sonner';

/**
 * Initialize agent orchestration for a project
 */
export const initializeOrchestration = async (project: Project): Promise<void> => {
  if (!project.id) return;
  
  try {
    console.log('Initializing agent orchestration for project:', project.name);
    
    // Get all available agents for this project
    const agents = project.agents || await getAgents(project.id);
    
    if (!agents || agents.length === 0) {
      console.warn('No agents available for orchestration');
      return;
    }
    
    // Find the architect agent as the lead orchestrator
    const architectAgent = agents.find(a => a.type === 'architect');
    
    if (!architectAgent || architectAgent.status !== 'working') {
      console.warn('Architect agent not available or not working');
      return;
    }
    
    // Inform the team that orchestration is starting
    await createMessage({
      project_id: project.id,
      content: "Agent orchestration initialized. I'll be coordinating our team's communication and work allocation as the Architect.",
      sender: architectAgent.name,
      type: "text"
    });
    
    // Broadcast initial message from architect to all agents
    const initialMessage = `
I'm taking the role of lead coordinator for our project "${project.name}". 
Each of you will focus on your specialized areas while I ensure our components integrate properly.
Let's establish our initial goals and constraints.
    `;
    
    broadcastMessage(architectAgent, initialMessage, project, 3);
    
  } catch (error) {
    console.error('Error initializing orchestration:', error);
    toast.error('Error starting agent orchestration');
  }
};

/**
 * Handle agent task completion and coordinate next steps
 */
export const handleTaskCompletion = async (
  agent: Agent,
  taskId: string,
  project: Project
): Promise<void> => {
  if (!project.id) return;
  
  try {
    console.log(`Agent ${agent.name} completed task ${taskId}`);
    
    // Create a completion message
    await createMessage({
      project_id: project.id,
      content: `I've completed task ${taskId}. Ready for the next assignment.`,
      sender: agent.name,
      type: "text"
    });
    
    // If agent is architect, they should delegate next tasks
    if (agent.type === 'architect') {
      // Only proceed if we can acquire the communication token
      if (acquireToken(agent.id)) {
        try {
          const nextStepsPrompt = `
You've just completed task ${taskId} for project "${project.name}". 
As the lead Architect, what are the next 1-2 critical tasks that should be prioritized? 
For each task, specify which specialist agent (frontend, backend, testing, or devops) should handle it and why.
          `;
          
          const response = await sendAgentPrompt(agent, nextStepsPrompt, project);
          
          await createMessage({
            project_id: project.id,
            content: response,
            sender: agent.name,
            type: "text"
          });
          
          // Parse and create new tasks from the architect's response
          const newTasks = parseTasksFromArchitectResponse(response);
          
          // Get all agents for assignment
          const agents = project.agents || await getAgents(project.id);
          
          // Create each task in the database
          for (const task of newTasks) {
            // Determine the appropriate agent for the task
            let assignedAgentId = agent.id; // Default to architect
            
            if (task.agentType) {
              const targetAgent = agents.find(a => a.type === task.agentType);
              if (targetAgent) {
                assignedAgentId = targetAgent.id;
              }
            }
            
            await createTask({
              title: task.title,
              description: task.description,
              priority: 'medium',
              status: 'pending',
              assigned_to: assignedAgentId,
              project_id: project.id
            });
          }
          
          // Broadcast next steps to the team
          broadcastMessage(
            agent, 
            `I've updated our task list based on our progress. Please check your assigned tasks.`, 
            project,
            2
          );
        } finally {
          // Always release the token when done
          releaseToken(agent.id);
        }
      }
    } else {
      // For non-architect agents, report to architect
      const agents = project.agents || await getAgents(project.id);
      const architectAgent = agents.find(a => a.type === 'architect' && a.status === 'working');
      
      if (architectAgent) {
        initiateConversation(
          agent,
          architectAgent,
          `I've completed task ${taskId}. Here's a summary of what I did: [Task completion]. What should I focus on next?`,
          project,
          2
        );
      }
    }
  } catch (error) {
    console.error('Error handling task completion:', error);
  }
};

/**
 * Parse tasks from architect's response
 */
function parseTasksFromArchitectResponse(
  response: string
): Array<{title: string, description: string, agentType?: string}> {
  const tasks: Array<{title: string, description: string, agentType?: string}> = [];
  
  // Look for common task formats in the response
  const lines = response.split(/\n+/);
  
  let currentTask: {title: string, description: string, agentType?: string} | null = null;
  
  for (const line of lines) {
    // Check for task headers or list items
    const taskMatch = line.match(/^(Task \d+:|[*-]\s+|^\d+\.\s+)(.+)$/i);
    
    if (taskMatch) {
      // If we have a current task, add it to the list
      if (currentTask) {
        tasks.push(currentTask);
      }
      
      // Start a new task
      currentTask = {
        title: taskMatch[2].trim(),
        description: ''
      };
    } else if (currentTask) {
      // Add lines to current task description and look for agent assignment
      currentTask.description += line.trim() + '\n';
      
      // Check for agent type mentions
      const agentTypeMatch = line.match(/assigned to:?\s+(\w+)|(\w+)\s+agent|specialist/i);
      if (agentTypeMatch) {
        const agentType = (agentTypeMatch[1] || agentTypeMatch[2]).toLowerCase();
        
        // Map common agent references to our types
        if (agentType.includes('front')) {
          currentTask.agentType = 'frontend';
        } else if (agentType.includes('back') || agentType.includes('api')) {
          currentTask.agentType = 'backend';
        } else if (agentType.includes('test') || agentType.includes('qa')) {
          currentTask.agentType = 'testing';
        } else if (agentType.includes('devops') || agentType.includes('deploy')) {
          currentTask.agentType = 'devops';
        } else if (agentType.includes('arch')) {
          currentTask.agentType = 'architect';
        }
      }
    }
  }
  
  // Add the last task if we have one
  if (currentTask) {
    tasks.push(currentTask);
  }
  
  return tasks;
}

/**
 * Start agent work with proper orchestration
 */
export const startAgentWithOrchestration = async (
  agent: Agent,
  project: Project
): Promise<void> => {
  if (!project.id) return;
  
  try {
    console.log(`Starting agent ${agent.name} with orchestration`);
    
    // If this is the first agent to start, initialize the orchestration
    const agents = project.agents || await getAgents(project.id);
    const activeAgents = agents.filter(a => a.status === 'working');
    
    if (activeAgents.length <= 1) {
      // This is the first or only active agent
      await createMessage({
        project_id: project.id,
        content: `I'm the first agent online for project "${project.name}". Initializing my work.`,
        sender: agent.name,
        type: "text"
      });
      
      // If this is the architect, they should lead the orchestration
      if (agent.type === 'architect') {
        initializeOrchestration(project);
      }
    } else {
      // Join existing team
      const teamMessage = `I'm joining the team to work on project "${project.name}" as the ${agent.type} specialist.`;
      
      await createMessage({
        project_id: project.id,
        content: teamMessage,
        sender: agent.name,
        type: "text"
      });
      
      // If architect is active, report to them
      const architectAgent = agents.find(a => a.type === 'architect' && a.status === 'working' && a.id !== agent.id);
      
      if (architectAgent) {
        initiateConversation(
          agent,
          architectAgent,
          `I've come online and am ready to assist with ${agent.type} tasks. What should I focus on first?`,
          project,
          2
        );
      }
    }
  } catch (error) {
    console.error('Error starting agent with orchestration:', error);
  }
};

/**
 * Restart an agent with orchestration
 */
export const restartAgentWithOrchestration = async (
  agent: Agent,
  project: Project
): Promise<void> => {
  if (!project.id) return;
  
  try {
    console.log(`Restarting agent ${agent.name} with orchestration`);
    
    await createMessage({
      project_id: project.id,
      content: `I'm resuming my work on project "${project.name}" after restart.`,
      sender: agent.name,
      type: "text"
    });
    
    // Similar logic to starting an agent, but with restart context
    const agents = project.agents || await getAgents(project.id);
    const architectAgent = agents.find(a => a.type === 'architect' && a.status === 'working' && a.id !== agent.id);
    
    if (architectAgent) {
      initiateConversation(
        agent,
        architectAgent,
        `I've been restarted and am ready to continue my work as the ${agent.type} specialist. What's the current project status?`,
        project,
        2
      );
    } else if (agent.type === 'architect') {
      // If this is the architect restarting, they should re-establish leadership
      setTimeout(() => {
        initializeOrchestration(project);
      }, 3000);
    }
  } catch (error) {
    console.error('Error restarting agent with orchestration:', error);
  }
};

/**
 * Stop agent with proper handoff
 */
export const stopAgentWithOrchestration = async (
  agent: Agent,
  project: Project
): Promise<void> => {
  if (!project.id) return;
  
  try {
    console.log(`Stopping agent ${agent.name} with orchestration`);
    
    // Inform the team that this agent is going offline
    await createMessage({
      project_id: project.id,
      content: `I'm pausing my work on project "${project.name}" for now.`,
      sender: agent.name,
      type: "text"
    });
    
    // If this agent holds the communication token, release it
    if (acquireToken(agent.id)) {
      releaseToken(agent.id);
    }
    
    // If this is the architect, designate a temporary lead if possible
    if (agent.type === 'architect') {
      const agents = project.agents || await getAgents(project.id);
      const activeAgents = agents.filter(a => a.id !== agent.id && a.status === 'working');
      
      if (activeAgents.length > 0) {
        // Find the most suitable temporary lead (backend or frontend preferred)
        const tempLead = activeAgents.find(a => a.type === 'backend') || 
                          activeAgents.find(a => a.type === 'frontend') ||
                          activeAgents[0];
        
        if (tempLead) {
          await createMessage({
            project_id: project.id,
            content: `As I'm going offline, ${tempLead.name} will coordinate the team until I return.`,
            sender: agent.name,
            type: "text"
          });
          
          setTimeout(() => {
            broadcastMessage(
              tempLead,
              `The Architect has designated me as temporary coordinator. Let's continue our current tasks while maintaining project coherence.`,
              project,
              2
            );
          }, 3000);
        }
      }
    }
  } catch (error) {
    console.error('Error stopping agent with orchestration:', error);
  }
};
