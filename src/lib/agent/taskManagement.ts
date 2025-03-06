
import { Agent, Project, Task } from '@/lib/types';
import { createMessage, createTask, getAgents } from '@/lib/api';
import { sendAgentPrompt } from '@/lib/openrouter';
import { parseTasksFromArchitectResponse } from './utils/taskParser';
import { acquireToken, releaseToken, broadcastMessage } from './messageBroker';
import { initiateConversation } from './agentCommunication';

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
          
          // Create a condensed, human-readable summary of the architect's response
          const summaryResponse = response.split('\n\n')[0] + 
            "\n\nI've created new tasks based on our project needs and assigned them to appropriate team members.";
          
          await createMessage({
            project_id: project.id,
            content: summaryResponse,
            sender: agent.name,
            type: "text"
          });
          
          // Parse and create new tasks from the architect's response (using concise mode)
          const newTasks = parseTasksFromArchitectResponse(response, true);
          
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
          `I've completed task ${taskId}. What should I focus on next?`,
          project,
          2
        );
      }
    }
  } catch (error) {
    console.error('Error handling task completion:', error);
  }
};
