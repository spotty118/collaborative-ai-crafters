
import { Agent, Project } from '@/lib/types';
import { createMessage, getAgents } from '@/lib/api';
import { acquireToken, releaseToken } from './messageBroker';
import { initiateConversation } from './agentCommunication';
import { initializeOrchestration } from './orchestrationInitializer';

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
