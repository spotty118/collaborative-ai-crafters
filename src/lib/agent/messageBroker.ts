
import { Agent, Project, Message } from '@/lib/types';
import { createMessage, getAgents } from '@/lib/api';
import { sendAgentPrompt } from '@/lib/openrouter';
import { toast } from 'sonner';

// Token system to prevent communication conflicts
let communicationToken: string | null = null;
let tokenHolderAgent: string | null = null;
let conversationStates: Map<string, ConversationState> = new Map();

interface ConversationState {
  conversationId: string;
  participants: string[];
  lastMessage: string;
  turnCount: number;
  status: 'active' | 'idle' | 'completed';
  priority: number;
  initiatedAt: Date;
}

/**
 * Acquire the communication token for an agent to begin/continue communication
 */
export const acquireToken = (agentId: string): boolean => {
  // If no one has the token or this agent already has it, grant it
  if (!communicationToken || tokenHolderAgent === agentId) {
    communicationToken = `token-${Date.now()}`;
    tokenHolderAgent = agentId;
    console.log(`Agent ${agentId} acquired communication token`);
    return true;
  }
  
  console.log(`Agent ${agentId} failed to acquire token, currently held by ${tokenHolderAgent}`);
  return false;
};

/**
 * Release the communication token so other agents can communicate
 */
export const releaseToken = (agentId: string): boolean => {
  // Only the token holder can release it
  if (tokenHolderAgent === agentId) {
    communicationToken = null;
    tokenHolderAgent = null;
    console.log(`Agent ${agentId} released communication token`);
    return true;
  }
  return false;
};

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
  const conversationState: ConversationState = {
    conversationId,
    participants: [sourceAgent.id, targetAgent.id],
    lastMessage: initialMessage,
    turnCount: 0,
    status: 'active',
    priority,
    initiatedAt: new Date()
  };
  
  // Store the conversation state
  conversationStates.set(conversationId, conversationState);
  
  console.log(`Initiated conversation ${conversationId} between ${sourceAgent.name} and ${targetAgent.name}`);
  
  // Acquire token and start conversation if possible
  if (acquireToken(sourceAgent.id)) {
    continueConversation(conversationId, project)
      .catch(error => {
        console.error(`Error starting conversation ${conversationId}:`, error);
        releaseToken(sourceAgent.id);
      });
  }
  
  return conversationId;
};

/**
 * Continue an existing conversation
 */
export const continueConversation = async (
  conversationId: string,
  project: Project
): Promise<void> => {
  const state = conversationStates.get(conversationId);
  if (!state || state.status !== 'active') {
    console.warn(`Cannot continue conversation ${conversationId}: Invalid state`);
    return;
  }
  
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
    const currentSpeaker = isEvenTurn ? sourceAgent : targetAgent;
    const currentListener = isEvenTurn ? targetAgent : sourceAgent;
    
    // If token isn't held by the current speaker, we can't continue now
    if (tokenHolderAgent !== currentSpeaker.id) {
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
      await endConversation(conversationId, project);
    }
  } catch (error) {
    console.error(`Error in conversation ${conversationId}:`, error);
    
    // Add error handling to avoid breakdown in agent communication
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
    if (tokenHolderAgent) {
      releaseToken(tokenHolderAgent);
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
const endConversation = async (
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
  
  // If token is held by one of the participants, release it
  if (state.participants.includes(tokenHolderAgent || '')) {
    releaseToken(tokenHolderAgent!);
  }
  
  console.log(`Conversation ${conversationId} completed after ${state.turnCount} turns`);
  
  // Free up token for other conversations
  if (tokenHolderAgent === null) {
    // Find the highest priority active conversation and start it
    startHighestPriorityConversation(project);
  }
};

/**
 * Start the highest priority conversation waiting for a token
 */
const startHighestPriorityConversation = async (project: Project): Promise<void> => {
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
  if (acquireToken(currentSpeaker.id)) {
    // Continue the conversation
    continueConversation(conversationId, project)
      .catch(error => {
        console.error(`Error continuing priority conversation ${conversationId}:`, error);
        releaseToken(currentSpeaker.id);
      });
  }
};

/**
 * Create a broadcast message from one agent to all other agents
 */
export const broadcastMessage = async (
  sourceAgent: Agent,
  message: string,
  project: Project,
  priority: number = 2
): Promise<void> => {
  try {
    // Get all agents
    const allAgents = project.agents || await getAgents(project.id);
    
    // Create the broadcast message
    await createMessage({
      project_id: project.id,
      content: `[BROADCAST] ${message}`,
      sender: sourceAgent.name,
      type: "text"
    });
    
    console.log(`${sourceAgent.name} broadcast a message to all agents`);
    
    // Filter out the source agent and get other active agents
    const otherAgents = allAgents.filter(a => 
      a.id !== sourceAgent.id && 
      a.status === 'working'
    );
    
    // If there are other agents, initiate conversations with them
    if (otherAgents.length > 0) {
      // Architect gets higher priority for their broadcasts
      const actualPriority = sourceAgent.type === 'architect' ? priority + 1 : priority;
      
      // Start conversations with each agent with a delay to avoid rate limiting
      otherAgents.forEach((agent, index) => {
        setTimeout(() => {
          initiateConversation(sourceAgent, agent, message, project, actualPriority);
        }, index * 8000); // 8-second spacing between conversation starts
      });
    }
  } catch (error) {
    console.error('Error broadcasting message:', error);
    toast.error('Error broadcasting message');
  }
};

/**
 * Handle conflicts between agents by initiating an architect-led resolution
 */
export const resolveConflict = async (
  agent1: Agent,
  agent2: Agent,
  conflictDescription: string,
  project: Project
): Promise<void> => {
  try {
    // Get the architect agent to resolve conflicts
    const allAgents = project.agents || await getAgents(project.id);
    const architectAgent = allAgents.find(a => a.type === 'architect' && a.status === 'working');
    
    if (!architectAgent) {
      console.warn('No architect agent available to resolve conflict');
      return;
    }
    
    // Log the conflict
    await createMessage({
      project_id: project.id,
      content: `[CONFLICT DETECTED] Conflict between ${agent1.name} and ${agent2.name}: ${conflictDescription}`,
      sender: 'System',
      type: "text"
    });
    
    // Create a resolution request to the architect
    const resolutionPrompt = `
As the project Architect, you need to resolve a conflict between:
- ${agent1.name} (${agent1.type})
- ${agent2.name} (${agent2.type})

The conflict is regarding: ${conflictDescription}

Please analyze both perspectives and provide a resolution that aligns with the project's architectural goals.
`;
    
    const resolution = await sendAgentPrompt(
      architectAgent,
      resolutionPrompt,
      project
    );
    
    // Record the architect's resolution
    await createMessage({
      project_id: project.id,
      content: `[CONFLICT RESOLUTION] ${resolution}`,
      sender: architectAgent.name,
      type: "text"
    });
    
    // Inform both agents of the resolution
    const notificationPrompt = `The Architect has resolved your conflict: ${resolution}`;
    
    // Start new conversations with both agents to communicate the resolution
    initiateConversation(architectAgent, agent1, notificationPrompt, project, 3);
    
    // Slight delay for the second conversation to avoid rate limiting
    setTimeout(() => {
      initiateConversation(architectAgent, agent2, notificationPrompt, project, 3);
    }, 8000);
    
  } catch (error) {
    console.error('Error resolving conflict:', error);
    toast.error('Error in conflict resolution process');
  }
};
