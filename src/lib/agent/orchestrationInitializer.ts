
import { Agent, Project } from '@/lib/types';
import { createMessage, getAgents } from '@/lib/api';
import { broadcastMessage } from './messageBroker';
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
