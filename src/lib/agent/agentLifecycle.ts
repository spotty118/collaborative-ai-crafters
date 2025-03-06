
import { Agent, Project } from '@/lib/types';
import { createMessage, getAgents, updateAgent } from '@/lib/api';
import { acquireToken, releaseToken, broadcastMessage } from './messageBroker';
import { initiateConversation } from './agentCommunication';
import { initializeOrchestration } from './orchestrationInitializer';
import { handleTaskCompletion } from './taskManagement';

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
    
    // If agent was idle, first update status to working
    if (agent.status === 'idle') {
      agent.status = 'working';
      await updateAgent(agent.id, { status: 'working' });
    }
    
    // Get up-to-date list of all agents
    const agents = project.agents || await getAgents(project.id);
    const activeAgents = agents.filter(a => a.status === 'working');
    
    // If this is the architect (first or restarting)
    if (agent.type === 'architect') {
      await createMessage({
        project_id: project.id,
        content: `I'm the lead architect for project "${project.name}". I'll be coordinating our team's efforts.`,
        sender: agent.name,
        type: "text"
      });
      
      // Initialize orchestration with a short delay to ensure message is saved
      setTimeout(() => {
        initializeOrchestration(project);
      }, 1000);
      
      return;
    }
    
    // For non-architect agents
    await createMessage({
      project_id: project.id,
      content: `I'm online and ready to assist with ${agent.type} tasks for project "${project.name}".`,
      sender: agent.name,
      type: "text"
    });
    
    // If architect is active, report to them
    const architectAgent = agents.find(a => a.type === 'architect' && a.status === 'working');
    
    if (architectAgent) {
      // Acquire token before communicating
      if (acquireToken(agent.id)) {
        try {
          setTimeout(() => {
            initiateConversation(
              agent,
              architectAgent,
              `I've come online as the ${agent.type} specialist. What should I focus on first?`,
              project,
              2
            );
          }, 2000);
        } finally {
          // Release token after a delay to allow conversation to start
          setTimeout(() => releaseToken(agent.id), 3000);
        }
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
    
    // Update agent status
    agent.status = 'working';
    await updateAgent(agent.id, { status: 'working' });
    
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
      // Acquire token before communicating
      if (acquireToken(agent.id)) {
        try {
          setTimeout(() => {
            initiateConversation(
              agent,
              architectAgent,
              `I've been restarted and am ready to continue my work as the ${agent.type} specialist. What's the current project status?`,
              project,
              2
            );
          }, 2000);
        } finally {
          // Release token after a delay
          setTimeout(() => releaseToken(agent.id), 3000);
        }
      }
    } else if (agent.type === 'architect') {
      // If this is the architect restarting, they should re-establish leadership
      setTimeout(() => {
        initializeOrchestration(project);
      }, 2000);
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
    
    // Update agent status
    agent.status = 'idle';
    await updateAgent(agent.id, { status: 'idle' });
    
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
            if (acquireToken(tempLead.id)) {
              try {
                broadcastMessage(
                  tempLead,
                  `The Architect has designated me as temporary coordinator. Let's continue our current tasks while maintaining project coherence.`,
                  project,
                  30
                );
              } finally {
                setTimeout(() => releaseToken(tempLead.id), 2000);
              }
            }
          }, 3000);
        }
      }
    }
  } catch (error) {
    console.error('Error stopping agent with orchestration:', error);
  }
};

/**
 * Continue agent work on completion of a task
 */
export const continueAgentWork = async (
  agent: Agent, 
  project: Project, 
  completedTaskId?: string
): Promise<void> => {
  if (!project.id) return;
  
  try {
    console.log(`Continuing work for ${agent.name} after task completion`);
    
    // Use the task management system to handle task completion
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
