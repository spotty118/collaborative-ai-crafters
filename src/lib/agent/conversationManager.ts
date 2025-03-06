
import { Agent, Project } from '@/lib/types';
import { createMessage, getAgents } from '@/lib/api';
import { sendAgentPrompt } from '@/lib/openrouter';
import { acquireToken, releaseToken } from './messageBroker';

// Conversation state type
export interface ConversationState {
  conversationId: string;
  participants: string[];
  lastMessage: string;
  turnCount: number;
  status: 'active' | 'idle' | 'completed';
  priority: number;
  initiatedAt: Date;
}

// Map to store conversation states
const conversationStates: Map<string, ConversationState> = new Map();

/**
 * Get a conversation state
 */
export const getConversationState = (conversationId: string): ConversationState | undefined => {
  return conversationStates.get(conversationId);
};

/**
 * Set a conversation state
 */
export const setConversationState = (conversationId: string, state: ConversationState): void => {
  conversationStates.set(conversationId, state);
  console.log(`Conversation state set for ${conversationId}, status: ${state.status}`);
};

/**
 * Continue an existing conversation
 */
export const continueConversation = async (
  conversationId: string,
  project: Project
): Promise<void> => {
  const state = conversationStates.get(conversationId);
  if (!state) {
    console.warn(`Cannot continue conversation ${conversationId}: State not found`);
    return;
  }
  
  if (state.status !== 'active') {
    console.warn(`Cannot continue conversation ${conversationId}: Status is ${state.status}`);
    return;
  }
  
  // Declare currentSpeaker outside try/catch for proper scope
  let currentSpeaker: Agent | undefined;
  let currentListenerId: string | undefined;
  
  try {
    // Get the current conversation participants
    const allAgents = project.agents || await getAgents(project.id);
    const [sourceId, targetId] = state.participants;
    const sourceAgent = allAgents.find(a => a.id === sourceId);
    const targetAgent = allAgents.find(a => a.id === targetId);
    
    if (!sourceAgent || !targetAgent) {
      console.error(`Cannot find agents for conversation ${conversationId}`);
      return;
    }
    
    // Determine whose turn it is (alternating turns)
    const isEvenTurn = state.turnCount % 2 === 0;
    currentSpeaker = isEvenTurn ? sourceAgent : targetAgent;
    const currentListener = isEvenTurn ? targetAgent : sourceAgent;
    currentListenerId = currentListener.id;
    
    // If token isn't held by the current speaker, we can't continue now
    if (acquireToken(currentSpeaker.id) === false) {
      console.log(`Waiting for token to continue conversation ${conversationId}`);
      return;
    }
    
    // Create the appropriate message context based on turn count and agents
    let messagePrompt = "";
    
    if (state.turnCount === 0) {
      // First message from source to target
      console.log(`Starting conversation between ${sourceAgent.name} and ${targetAgent.name}`);
      
      // Create a message in the chat from the source
      await createMessage({
        project_id: project.id,
        content: state.lastMessage,
        sender: sourceAgent.name,
        type: "text"
      });
      
      // Context for target agent to respond
      if (targetAgent.type === 'architect') {
        messagePrompt = `As the lead Architect, ${sourceAgent.name} has reached out to you saying: "${state.lastMessage}". Provide architectural guidance and coordinate the next steps.`;
      } else if (sourceAgent.type === 'architect') {
        messagePrompt = `The lead Architect has directed you: "${state.lastMessage}". As the ${targetAgent.type} specialist, respond with how you'll implement this direction within your area of expertise.`;
      } else {
        messagePrompt = `Your colleague ${sourceAgent.name} (${sourceAgent.type} specialist) says: "${state.lastMessage}". As the ${targetAgent.type} specialist, respond with your thoughts and how this relates to your work.`;
      }
    } else {
      // Continuing conversation - add context from conversation history
      messagePrompt = `Continue your conversation with ${currentListener.name}. They just said: "${state.lastMessage}". 
Remember you are the ${currentSpeaker.type} specialist working on project "${project.name}".
Reply in a way that moves the project forward. If appropriate, suggest specific next steps or technical decisions.`;
    }
    
    // Get response from current speaker
    let response;
    try {
      console.log(`Getting response from ${currentSpeaker.name} to continue conversation`);
      response = await sendAgentPrompt(
        currentSpeaker,
        messagePrompt,
        project
      );
    } catch (error) {
      console.warn(`Error getting response from ${currentSpeaker.name}:`, error);
      // Fallback response to avoid breaking the flow
      response = `I'm processing your request and will get back to you shortly. [Communication throttled]`;
    }
    
    // Create a message from current speaker to listener
    await createMessage({
      project_id: project.id,
      content: response,
      sender: currentSpeaker.name,
      type: "text"
    });
    
    console.log(`${currentSpeaker.name} responded in conversation ${conversationId}`);
    
    // Update conversation state
    conversationStates.set(conversationId, {
      ...state,
      lastMessage: response,
      turnCount: state.turnCount + 1
    });
    
    // Determine if we should continue this conversation
    const shouldContinue = determineConversationContinuation(state.turnCount, currentSpeaker.type, response);
    
    if (shouldContinue && state.turnCount < 10) { // Limiting to 10 turns max
      // Release the token and pass to the next speaker
      releaseToken(currentSpeaker.id);
      
      if (acquireToken(currentListener.id)) {
        // Small delay to avoid rate limiting
        setTimeout(() => {
          continueConversation(conversationId, project)
            .catch(error => {
              console.error(`Error continuing conversation ${conversationId}:`, error);
              releaseToken(currentListener.id);
            });
        }, 5000);
      }
    } else {
      // End the conversation gracefully
      endConversation(conversationId, project);
    }
  } catch (error) {
    console.error(`Error in conversation ${conversationId}:`, error);
    
    // Handle the error case
    try {
      await createMessage({
        project_id: project.id,
        content: `Communication paused due to system constraints. Will resume shortly. [Error: ${error instanceof Error ? error.message : 'Unknown error'}]`,
        sender: 'System',
        type: "text"
      });
    } catch (innerError) {
      console.error('Failed to send error message:', innerError);
    }
    
    // Release the token so other conversations can happen
    if (currentSpeaker) {
      releaseToken(currentSpeaker.id);
    }
  }
};

/**
 * Determine if a conversation should continue based on content analysis
 */
const determineConversationContinuation = (
  turnCount: number,
  agentType: string,
  lastMessage: string
): boolean => {
  // Higher probability to continue early in the conversation
  if (turnCount < 3) {
    return Math.random() < 0.9; // 90% chance
  }
  
  // Medium probability in the middle of conversation
  if (turnCount < 6) {
    return Math.random() < 0.7; // 70% chance
  }
  
  // Check for question marks indicating questions that need responses
  if (lastMessage.includes('?')) {
    return Math.random() < 0.8; // Higher chance when questions are asked
  }
  
  // Architect agent tends to lead longer conversations
  if (agentType === 'architect') {
    return Math.random() < 0.6; // 60% chance
  }
  
  // Lower probability later in conversation
  return Math.random() < 0.4; // 40% chance to continue after 6+ turns
};

/**
 * End a conversation gracefully
 */
export const endConversation = async (
  conversationId: string,
  project: Project
): Promise<void> => {
  const state = conversationStates.get(conversationId);
  if (!state) return;
  
  // Update state to completed
  conversationStates.set(conversationId, {
    ...state,
    status: 'completed'
  });
  
  // Get the token holder from the message broker module
  const { tokenHolderAgent, releaseToken } = await import('./messageBroker');
  
  // If token is held by one of the participants, release it
  if (state.participants.includes(tokenHolderAgent || '')) {
    releaseToken(tokenHolderAgent!);
  }
  
  console.log(`Conversation ${conversationId} completed after ${state.turnCount} turns`);
  
  // Start the highest priority conversation if token is available
  if (!tokenHolderAgent) {
    startHighestPriorityConversation(project);
  }
};

/**
 * Start the highest priority conversation waiting for a token
 */
export const startHighestPriorityConversation = async (project: Project): Promise<void> => {
  // Find all active conversations
  const activeConversations = Array.from(conversationStates.entries())
    .filter(([_, state]) => state.status === 'active')
    .sort((a, b) => b[1].priority - a[1].priority); // Sort by priority descending
  
  if (activeConversations.length === 0) return;
  
  // Take the highest priority conversation
  const [conversationId, state] = activeConversations[0];
  
  // Get the agents
  const allAgents = project.agents || await getAgents(project.id);
  const [sourceId, targetId] = state.participants;
  const sourceAgent = allAgents.find(a => a.id === sourceId);
  const targetAgent = allAgents.find(a => a.id === targetId);
  
  if (!sourceAgent || !targetAgent) return;
  
  // Determine whose turn it is
  const isEvenTurn = state.turnCount % 2 === 0;
  const currentSpeaker = isEvenTurn ? sourceAgent : targetAgent;
  
  // Acquire token for current speaker
  const { acquireToken } = await import('./messageBroker');
  if (acquireToken(currentSpeaker.id)) {
    // Continue the conversation
    continueConversation(conversationId, project)
      .catch(error => {
        console.error(`Error continuing priority conversation ${conversationId}:`, error);
        import('./messageBroker').then(({ releaseToken }) => {
          releaseToken(currentSpeaker.id);
        });
      });
  }
};
