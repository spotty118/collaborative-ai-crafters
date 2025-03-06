import { Agent, Project } from '@/lib/types';
import { createMessage, updateAgent } from '@/lib/api';
import { sendAgentPrompt } from '@/lib/openrouter';
import { acquireToken, releaseToken, getTokenState } from './messageBroker';
import { initializeCrewAI, createInitialCrewTasks } from './crewAI';
import { toast } from 'sonner';

const agentStartAttempts = new Map<string, { count: number, lastAttempt: number }>();
const MAX_START_ATTEMPTS = 3;
const ATTEMPT_RESET_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Start an agent with orchestration
 */
export const startAgentWithOrchestration = async (
  agent: Agent,
  project: Project
): Promise<boolean> => {
  if (!project.id) return false;
  
  try {
    // Check if agent is already working
    if (agent.status === 'working') {
      console.log(`Agent ${agent.name} is already working, skipping start`);
      return true;
    }
    
    // Prevent rapid cycling of start attempts
    const agentId = agent.id;
    const now = Date.now();
    const attempts = agentStartAttempts.get(agentId) || { count: 0, lastAttempt: 0 };
    
    // Reset attempts if it's been a while
    if (now - attempts.lastAttempt > ATTEMPT_RESET_TIME) {
      attempts.count = 0;
    }
    
    // Increment attempt count
    attempts.count += 1;
    attempts.lastAttempt = now;
    agentStartAttempts.set(agentId, attempts);
    
    // Prevent too many rapid attempts
    if (attempts.count > MAX_START_ATTEMPTS) {
      console.log(`Too many start attempts for agent ${agent.name}, limiting frequency`);
      toast.error(`Agent ${agent.name} cannot be started again so soon. Please try again later.`);
      return false;
    }
    
    console.log(`Starting agent ${agent.name} with orchestration (attempt ${attempts.count})`);
    
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
      
      // Set a timeout to try again later with exponential backoff
      const backoffTime = Math.min(30000 * Math.pow(1.5, attempts.count - 1), 120000);
      setTimeout(() => {
        startAgentWithOrchestration(agent, project)
          .catch(error => console.error(`Error restarting agent ${agent.name}:`, error));
      }, backoffTime);
      
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
    
    // Reset attempt counter for this agent to allow restart
    agentStartAttempts.delete(agent.id);
    
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
