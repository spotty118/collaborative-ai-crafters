
import { Project } from '@/lib/types';
import { createMessage, getAgents } from '@/lib/api';
import { sendAgentPrompt } from '@/lib/openrouter';
import { acquireToken, releaseToken } from './messageBroker';

// Store conversation states in memory
const conversationStates: Record<string, ConversationState> = {};

export interface ConversationState {
  conversationId: string;
  participants: string[]; // Array of agent IDs
  lastMessage: string;
  turnCount: number;
  status: 'active' | 'completed' | 'error';
  priority: number;
  initiatedAt: Date;
}

/**
 * Set conversation state
 */
export const setConversationState = (
  conversationId: string,
  state: ConversationState
) => {
  // Ensure initiatedAt is a Date object
  if (!(state.initiatedAt instanceof Date)) {
    state.initiatedAt = new Date(state.initiatedAt);
  }
  
  // Validate state before storing it
  if (isValidConversationState(state)) {
    conversationStates[conversationId] = state;
    return true;
  } else {
    console.error(`Invalid conversation state for ${conversationId}:`, state);
    return false;
  }
};

/**
 * Get conversation state
 */
export const getConversationState = (
  conversationId: string
): ConversationState | null => {
  const state = conversationStates[conversationId];
  
  // Ensure we're returning a valid state object
  if (state && isValidConversationState(state)) {
    return state;
  }
  
  return null;
};

/**
 * Get all conversation states (for checking duplicates)
 */
export const getAllConversationStates = (): Record<string, ConversationState> => {
  return conversationStates;
};

/**
 * Validate conversation state to prevent invalid state errors
 */
export const isValidConversationState = (state: ConversationState | null): boolean => {
  if (!state) return false;
  
  try {
    // Check that all required properties exist and have valid values
    const hasValidId = typeof state.conversationId === 'string' && state.conversationId.length > 0;
    const hasValidParticipants = Array.isArray(state.participants) && state.participants.length >= 2;
    const hasValidMessage = typeof state.lastMessage === 'string';
    const hasValidTurnCount = typeof state.turnCount === 'number' && !isNaN(state.turnCount);
    const hasValidStatus = ['active', 'completed', 'error'].includes(state.status);
    const hasValidPriority = typeof state.priority === 'number' && !isNaN(state.priority);
    
    // Make sure initiatedAt is a valid Date
    let hasValidDate = false;
    if (state.initiatedAt) {
      if (state.initiatedAt instanceof Date) {
        hasValidDate = !isNaN(state.initiatedAt.getTime());
      } else if (typeof state.initiatedAt === 'string') {
        // Try to convert string to Date
        const dateObj = new Date(state.initiatedAt);
        hasValidDate = !isNaN(dateObj.getTime());
        // Update the state with the Date object if valid
        if (hasValidDate) {
          state.initiatedAt = dateObj;
        }
      }
    }
    
    return (
      hasValidId &&
      hasValidParticipants &&
      hasValidMessage &&
      hasValidTurnCount &&
      hasValidStatus &&
      hasValidPriority &&
      hasValidDate
    );
  } catch (error) {
    console.error('Error validating conversation state:', error);
    return false;
  }
};

/**
 * Get an agent by ID from the project's agents
 */
const getAgentById = async (agentId: string, project?: Project) => {
  // If project is provided with agents, use that (faster)
  if (project?.agents) {
    return project.agents.find(agent => agent.id === agentId) || null;
  }
  
  // Otherwise fetch all agents and find the one with matching ID
  // This requires that getAgents knows which project to use
  const projectId = project?.id;
  if (!projectId) {
    console.error('Cannot get agent: No project ID available');
    return null;
  }
  
  try {
    const agents = await getAgents(projectId);
    return agents.find(agent => agent.id === agentId) || null;
  } catch (error) {
    console.error(`Error getting agent by ID ${agentId}:`, error);
    return null;
  }
};

/**
 * Continue an ongoing conversation
 */
export const continueConversation = async (
  conversationId: string,
  project: Project
): Promise<void> => {
  // Get conversation state
  const state = getConversationState(conversationId);
  
  // Validate conversation state first
  if (!isValidConversationState(state)) {
    console.error(`Cannot continue conversation ${conversationId}: Invalid state`, state);
    return;
  }
  
  // Since we know state is valid now, we can safely use it without null checks
  const validState = state as ConversationState;
  
  // Get the next agent to respond (alternating between participants)
  const currentAgentIndex = validState.turnCount % validState.participants.length;
  const nextAgentId = validState.participants[currentAgentIndex];
  
  try {
    // Use the local getAgentById function
    const agent = await getAgentById(nextAgentId, project);
    
    if (!agent) {
      console.error(`Agent ${nextAgentId} not found for conversation ${conversationId}`);
      setConversationState(conversationId, {
        ...validState,
        status: 'error'
      });
      releaseToken(nextAgentId);
      return;
    }
    
    console.log(`Getting response from ${agent.name} to continue conversation`);
    
    // Get AI response
    const response = await sendAgentPrompt(agent, validState.lastMessage, project);
    
    // Create message
    await createMessage({
      project_id: project.id,
      content: response,
      sender: agent.name,
      type: "text"
    });
    
    // Update conversation state
    const updatedState = {
      ...validState,
      lastMessage: response,
      turnCount: validState.turnCount + 1
    };
    
    // Check if conversation should end (limit to reasonable number of turns)
    if (updatedState.turnCount >= 10) {
      updatedState.status = 'completed';
      console.log(`Conversation ${conversationId} completed after ${updatedState.turnCount} turns`);
    }
    
    // Save updated state
    setConversationState(conversationId, updatedState);
    
    console.log(`${agent.name} responded in conversation ${conversationId}`);
    
    // Release token for the current agent
    releaseToken(agent.id);
    
    // If conversation should continue, get response from the next agent
    if (updatedState.status === 'active') {
      // Get the next agent in the participants list
      const nextAgentIndex = updatedState.turnCount % updatedState.participants.length;
      const nextNextAgentId = updatedState.participants[nextAgentIndex];
      
      // Try to acquire token for the next agent
      if (acquireToken(nextNextAgentId)) {
        // Wait a short delay to avoid rate limiting and make conversations more natural
        setTimeout(() => {
          continueConversation(conversationId, project)
            .catch(error => {
              console.error(`Error continuing conversation ${conversationId}:`, error);
              releaseToken(nextNextAgentId);
            });
        }, 5000); 
      } else {
        console.log(`Agent ${nextNextAgentId} failed to acquire token, conversation will be resumed later`);
      }
    }
  } catch (error) {
    console.error(`Error in conversation ${conversationId}:`, error);
    
    // Update state to error
    if (state) {
      setConversationState(conversationId, {
        ...state,
        status: 'error'
      });
    }
    
    // Release token for current agent
    releaseToken(nextAgentId);
  }
};
