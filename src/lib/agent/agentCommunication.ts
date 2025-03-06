
import { Agent, Project } from '@/lib/types';
import { createMessage, getAgents } from '@/lib/api';
import { acquireToken } from './messageBroker';
import { setConversationState, getConversationState, ConversationState, getAllConversationStates, isValidConversationState } from './conversationManager';

/**
 * Initiate a new conversation between agents
 */
export const initiateConversation = (
  sourceAgent: Agent,
  targetAgent: Agent,
  initialMessage: string,
  project: Project,
  priority: number = 1
): string => {
  // Generate a unique conversation ID
  const conversationId = `conv-${sourceAgent.id}-${targetAgent.id}-${Date.now()}`;
  
  // Check if a similar conversation already exists (preventing duplicates)
  const existingId = checkForExistingConversation(sourceAgent.id, targetAgent.id);
  if (existingId) {
    console.log(`Similar conversation ${existingId} already exists, using that instead`);
    
    // Update the existing conversation with the new message to keep it active
    const existingState = getConversationState(existingId);
    if (existingState && isValidConversationState(existingState)) {
      // Update the last message and reset turn count
      existingState.lastMessage = initialMessage;
      existingState.turnCount = 0;
      existingState.status = 'active';
      setConversationState(existingId, existingState);
      
      console.log(`Updated existing conversation ${existingId} between ${sourceAgent.name} and ${targetAgent.name}`);
      return existingId;
    }
  }
  
  // Create conversation state with proper Date object
  const conversationState: ConversationState = {
    conversationId,
    participants: [sourceAgent.id, targetAgent.id],
    lastMessage: initialMessage,
    turnCount: 0,
    status: 'active' as const,
    priority,
    initiatedAt: new Date()
  };
  
  // Validate the state before storing
  if (!isValidConversationState(conversationState)) {
    console.error('Failed to create valid conversation state:', conversationState);
    return '';
  }
  
  // Store the conversation state directly using the imported function
  setConversationState(conversationId, conversationState);
  
  console.log(`Initiated conversation ${conversationId} between ${sourceAgent.name} and ${targetAgent.name}`);
  
  // Acquire token and start conversation if possible
  if (acquireToken(sourceAgent.id)) {
    // Import needed to avoid circular dependencies
    import('./conversationManager').then(({ continueConversation }) => {
      continueConversation(conversationId, project)
        .catch(error => {
          console.error(`Error starting conversation ${conversationId}:`, error);
          import('./messageBroker').then(({ releaseToken }) => {
            releaseToken(sourceAgent.id);
          });
        });
    });
  }
  
  return conversationId;
};

/**
 * Check if there's an existing conversation between these agents
 * to prevent duplicate conversations
 */
function checkForExistingConversation(sourceAgentId: string, targetAgentId: string): string | null {
  try {
    // Use the imported getAllConversationStates instead of require
    const conversations = getAllConversationStates();
    
    // Look for a recent active conversation between the same agents
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000); // Reduced from 3 minutes to 1 minute
    
    for (const [id, state] of Object.entries(conversations)) {
      // Ensure proper type casting for the state object
      const typedState = state as ConversationState;
      
      // Skip invalid conversation states
      if (!isValidConversationState(typedState)) {
        console.warn(`Skipping invalid conversation state for ID ${id}`);
        continue;
      }
      
      const participants = typedState.participants || [];
      
      // Make sure initiatedAt is a proper Date object
      let initiatedDate: Date;
      if (typedState.initiatedAt instanceof Date) {
        initiatedDate = typedState.initiatedAt;
      } else if (typeof typedState.initiatedAt === 'string') {
        initiatedDate = new Date(typedState.initiatedAt);
      } else {
        // Skip invalid records
        continue;
      }
      
      const isRecent = initiatedDate > oneMinuteAgo;
      
      // Check if both agents are participants in either order
      if (
        isRecent && 
        typedState.status === 'active' &&
        participants.includes(sourceAgentId) && 
        participants.includes(targetAgentId)
      ) {
        return id;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error checking for existing conversations:', error);
    return null;
  }
};
