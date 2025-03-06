
import { Agent, Project } from '@/lib/types';
import { createMessage, getAgents } from '@/lib/api';
import { acquireToken } from './messageBroker';
import { continueConversation } from './conversationManager';

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
  
  // Store the conversation state (this is done in the conversationManager)
  storeConversationState(conversationId, conversationState);
  
  console.log(`Initiated conversation ${conversationId} between ${sourceAgent.name} and ${targetAgent.name}`);
  
  // Acquire token and start conversation if possible
  if (acquireToken(sourceAgent.id)) {
    continueConversation(conversationId, project)
      .catch(error => {
        console.error(`Error starting conversation ${conversationId}:`, error);
        import('./messageBroker').then(({ releaseToken }) => {
          releaseToken(sourceAgent.id);
        });
      });
  }
  
  return conversationId;
};

/**
 * Store conversation state (this is needed to avoid circular dependencies)
 */
const storeConversationState = (conversationId: string, state: any): void => {
  import('./conversationManager').then(({ setConversationState }) => {
    setConversationState(conversationId, state);
  });
};
