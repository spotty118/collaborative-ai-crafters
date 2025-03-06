
import { Agent, Project } from '@/lib/types';
import { createMessage, getAgents, createAgents, updateAgent } from '@/lib/api';
import { broadcastMessage } from './messageBroker';
import { toast } from 'sonner';
import { startAgentWithOrchestration } from './agentLifecycle';

/**
 * Initialize agent orchestration for a project
 */
export const initializeOrchestration = async (project: Project): Promise<void> => {
  if (!project.id) {
    console.error("Cannot initialize orchestration without a project ID");
    toast.error("Cannot initialize project: missing project ID");
    return;
  }
  
  try {
    console.log('Initializing agent orchestration for project:', project);
    
    // Get all available agents for this project
    let agents = project.agents;
    
    // If agents aren't provided with the project, fetch them
    if (!agents || agents.length === 0) {
      console.log('No agents provided with project, attempting to fetch agents...');
      try {
        agents = await getAgents(project.id);
        console.log('Fetched agents:', agents);
      } catch (error) {
        console.error('Error fetching agents:', error);
      }
    }
    
    // If still no agents, try to create default agents
    if (!agents || agents.length === 0) {
      console.log('No agents available, attempting to create default agents...');
      try {
        agents = await createAgents(project.id);
        console.log('Created default agents:', agents);
      } catch (error) {
        console.error('Error creating default agents:', error);
        toast.error("Failed to create agents. Please refresh the page and try again.");
        return;
      }
    }
    
    if (!agents || agents.length === 0) {
      console.warn('No agents available for orchestration even after creation attempt');
      toast.error("Failed to initialize agents. Please refresh the page.");
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
        console.log('Updating architect agent status to working...');
        await updateAgent(architectAgent.id, { status: 'working' });
        architectAgent.status = 'working'; // Update local object too
        console.log(`Updated architect agent status to working`);
      } catch (error) {
        console.error('Error updating architect agent status:', error);
        toast.error("Failed to update architect status. Continuing anyway...");
      }
    }
    
    // Inform the team that orchestration is starting
    try {
      console.log('Creating initial message from architect...');
      await createMessage({
        project_id: project.id,
        content: "Agent orchestration initialized. I'll be coordinating our team's communication and work allocation as the Architect.",
        sender: architectAgent.name,
        type: "text"
      });
      console.log('Initial message created successfully');
    } catch (error) {
      console.error('Error creating initial message:', error);
      toast.error("Communication error. Continuing anyway...");
    }
    
    // Broadcast initial message from architect to all agents
    const initialMessage = `
I'm taking the role of lead coordinator for project "${project.name}". 
Each of you will focus on your specialized areas while I ensure our components integrate properly.
Let's establish our initial goals and constraints based on the project requirements.
    `;
    
    // Broadcast message to all agents
    try {
      console.log('Broadcasting initial message to agents...');
      await broadcastMessage(architectAgent, initialMessage, project, 30);
      console.log('Initial broadcast completed successfully');
    } catch (error) {
      console.error('Error broadcasting initial message:', error);
      toast.error("Communication error. Continuing anyway...");
    }
    
    // Start each non-architect agent with a delay to prevent rate limiting
    const nonArchitectAgents = agents.filter(a => a.type !== 'architect' && a.status === 'idle');
    console.log(`Starting ${nonArchitectAgents.length} non-architect agents with delays...`);
    
    for (let i = 0; i < nonArchitectAgents.length; i++) {
      const agent = nonArchitectAgents[i];
      
      try {
        // Update agent status to working
        console.log(`Updating agent ${agent.name} status to working...`);
        await updateAgent(agent.id, { status: 'working' });
        agent.status = 'working'; // Update local object too
        
        // Start the agent with a 5-second delay between each
        setTimeout(() => {
          console.log(`Starting agent ${agent.name} after delay...`);
          startAgentWithOrchestration(agent, project)
            .then(() => console.log(`Agent ${agent.name} started successfully`))
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
    console.log('Orchestration initialization completed successfully');
  } catch (error) {
    console.error('Error initializing orchestration:', error);
    toast.error('Error starting agent orchestration. Please try again.');
  }
};
