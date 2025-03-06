
import { Agent, Project } from '@/lib/types';
import { createMessage, getAgents } from '@/lib/api';
import { acquireToken } from './messageBroker';
import { setConversationState } from './conversationManager';

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
  
  // Create conversation state
  const conversationState = {
    conversationId,
    participants: [sourceAgent.id, targetAgent.id],
    lastMessage: initialMessage,
    turnCount: 0,
    status: 'active' as const,
    priority,
    initiatedAt: new Date()
  };
  
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
