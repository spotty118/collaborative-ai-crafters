
import { Agent, Project } from '@/lib/types';
import { createMessage, updateAgent } from '@/lib/api';
import { sendAgentPrompt } from '@/lib/openrouter';
import { acquireToken, releaseToken, getTokenState } from './messageBroker';
import { initializeCrewAI, createInitialCrewTasks } from './crewAI';
import { toast } from 'sonner';

/**
 * Start an agent with orchestration
 */
export const startAgentWithOrchestration = async (
  agent: Agent,
  project: Project
): Promise<boolean> => {
  if (!project.id) return false;
  
  try {
    console.log(`Starting agent ${agent.name} with orchestration`);
    
    // Check if this is an architect agent
    if (agent.type === 'architect') {
      // Try to use CrewAI for architect agents (the team leaders)
      const crewInitialized = await initializeCrewAI(project);
      
      if (crewInitialized) {
        console.log('CrewAI orchestration initialized successfully');
        
        // Set agent status to working
        await updateAgent(agent.id, { status: 'working' });
        
        // Create initial tasks
        await createInitialCrewTasks(project);
        
        return true;
      } else {
        console.log('CrewAI initialization failed, falling back to regular orchestration');
      }
    }
    
    // Update agent status
    await updateAgent(agent.id, { status: 'working' });
    
    // Acquire token to ensure we don't have too many agents working at once
    if (!acquireToken(agent.id)) {
      console.log(`Token not available for agent ${agent.name}, scheduling for later`);
      
      // Create a message noting that the agent is waiting
      if (project.id) {
        await createMessage({
          project_id: project.id,
          content: `I'm ready to help, but waiting for system resources to be available.`,
          sender: agent.name,
          type: "text"
        });
      }
      
      // Set a timeout to try again later
      setTimeout(() => {
        startAgentWithOrchestration(agent, project)
          .catch(error => console.error(`Error restarting agent ${agent.name}:`, error));
      }, 30000); // Try again in 30 seconds
      
      return false;
    }
    
    try {
      // Send an initial prompt to the agent to analyze the project
      const initialPrompt = `You're now activated for project "${project.name}". As a ${agent.type} specialist, analyze the project description and requirements.

Project description: ${project.description}

Based on this, what are the key focus areas you should work on as the ${agent.type} specialist?`;
      
      const response = await sendAgentPrompt(agent, initialPrompt, project);
      
      // Create a message with the agent's thoughts
      await createMessage({
        project_id: project.id,
        content: response,
        sender: agent.name,
        type: "text"
      });
      
      // Release the token to let other agents work
      releaseToken(agent.id);
      
      return true;
    } catch (error) {
      console.error(`Error starting agent ${agent.name}:`, error);
      releaseToken(agent.id); // Always release token in case of error
      return false;
    }
  } catch (error) {
    console.error(`Error in startAgentWithOrchestration for ${agent.name}:`, error);
    return false;
  }
};

/**
 * Restart an agent with orchestration
 */
export const restartAgentWithOrchestration = async (
  agent: Agent,
  project: Project
): Promise<boolean> => {
  if (!project.id) return false;
  
  try {
    // First stop the agent if it's running
    await stopAgentWithOrchestration(agent);
    
    // Then start it again
    return await startAgentWithOrchestration(agent, project);
  } catch (error) {
    console.error(`Error restarting agent ${agent.name}:`, error);
    return false;
  }
};

/**
 * Stop an agent with orchestration
 */
export const stopAgentWithOrchestration = async (
  agent: Agent
): Promise<boolean> => {
  try {
    console.log(`Stopping agent ${agent.name}`);
    
    // Update agent status
    await updateAgent(agent.id, { status: 'idle' });
    
    // Ensure token is released
    if (getTokenState(agent.id)) {
      releaseToken(agent.id);
    }
    
    return true;
  } catch (error) {
    console.error(`Error stopping agent ${agent.name}:`, error);
    return false;
  }
};
