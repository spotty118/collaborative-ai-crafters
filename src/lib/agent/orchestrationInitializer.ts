
import { Agent, Project } from '@/lib/types';
import { createMessage, getAgents, updateAgent } from '@/lib/api';
import { broadcastMessage } from './messageBroker';
import { toast } from 'sonner';
import { startAgentWithOrchestration } from './agentLifecycle';

/**
 * Initialize agent orchestration for a project
 */
export const initializeOrchestration = async (project: Project): Promise<void> => {
  if (!project.id) {
    console.error("Cannot initialize orchestration without a project ID");
    return;
  }
  
  try {
    console.log('Initializing agent orchestration for project:', project.name);
    
    // Get all available agents for this project
    const agents = project.agents || await getAgents(project.id);
    
    if (!agents || agents.length === 0) {
      console.warn('No agents available for orchestration');
      toast.error("No agents found for this project. Please refresh the page.");
      return;
    }
    
    // Find the architect agent as the lead orchestrator
    const architectAgent = agents.find(a => a.type === 'architect');
    
    if (!architectAgent) {
      console.warn('Architect agent not available');
      toast.error("Architect agent not found. Please refresh the page.");
      return;
    }
    
    // Update architect's status to working if it's not already
    if (architectAgent.status !== 'working') {
      try {
        await updateAgent(architectAgent.id, { status: 'working' });
        architectAgent.status = 'working'; // Update local object too
        console.log(`Updated architect agent status to working`);
      } catch (error) {
        console.error('Error updating architect agent status:', error);
      }
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
I'm taking the role of lead coordinator for project "${project.name}". 
Each of you will focus on your specialized areas while I ensure our components integrate properly.
Let's establish our initial goals and constraints based on the project requirements.
    `;
    
    // Broadcast message to all agents
    await broadcastMessage(architectAgent, initialMessage, project, 30);
    
    // Start each non-architect agent with a delay to prevent rate limiting
    const nonArchitectAgents = agents.filter(a => a.type !== 'architect' && a.status === 'idle');
    
    for (let i = 0; i < nonArchitectAgents.length; i++) {
      const agent = nonArchitectAgents[i];
      
      try {
        // Update agent status to working
        await updateAgent(agent.id, { status: 'working' });
        agent.status = 'working'; // Update local object too
        
        // Start the agent with a 5-second delay between each
        setTimeout(() => {
          startAgentWithOrchestration(agent, project)
            .catch(err => {
              console.error(`Error starting agent ${agent.name}:`, err);
              toast.error(`Failed to start ${agent.name}. Please try restarting it.`);
            });
        }, (i + 1) * 5000);
        
        console.log(`Queued start for ${agent.name} with ${(i + 1) * 5}s delay`);
      } catch (error) {
        console.error(`Error queuing agent ${agent.name}:`, error);
        toast.error(`Failed to queue ${agent.name} for startup.`);
      }
    }
    
    toast.success("Orchestration initialized - agents will start automatically");
  } catch (error) {
    console.error('Error initializing orchestration:', error);
    toast.error('Error starting agent orchestration. Please try again.');
  }
};
