
// Import necessary modules

// Track tokens for each agent
const tokens: Record<string, boolean> = {};

// Track last message sent time for each agent to implement rate limiting
const lastMessageTime: Record<string, number> = {};
const MIN_MESSAGE_INTERVAL = 2000; // 2 seconds between messages

// Track message broadcasting to prevent duplicates
const recentBroadcasts: Record<string, number> = {};

/**
 * Acquire a token for an agent to communicate
 */
export const acquireToken = (agentId: string): boolean => {
  // Check if the agent is rate limited
  const now = Date.now();
  const lastTime = lastMessageTime[agentId] || 0;
  const timeSinceLastMessage = now - lastTime;
  
  if (timeSinceLastMessage < MIN_MESSAGE_INTERVAL) {
    console.log(`Agent ${agentId} is rate limited. Time since last message: ${timeSinceLastMessage}ms`);
    return false;
  }
  
  // If the agent doesn't have a token, give it one
  if (!tokens[agentId]) {
    tokens[agentId] = true;
    lastMessageTime[agentId] = now;
    console.log(`Agent ${agentId} acquired communication token`);
    return true;
  }
  
  console.log(`Agent ${agentId} already has a token, cannot acquire another`);
  return false;
};

/**
 * Release the token for an agent
 */
export const releaseToken = (agentId: string): void => {
  if (tokens[agentId]) {
    delete tokens[agentId];
    console.log(`Agent ${agentId} released communication token`);
  } else {
    console.log(`Agent ${agentId} does not have a token to release`);
  }
};

/**
 * Check if an agent has a token
 */
export const getTokenState = (agentId: string): boolean => {
  return !!tokens[agentId];
};

/**
 * Broadcast a message from an agent to the project
 * Uses a cooldown mechanism to prevent duplicate broadcasts
 */
export const broadcastMessage = async (
  agent: any,
  message: string,
  project: any,
  cooldownSeconds: number = 30
): Promise<void> => {
  if (!project.id || !agent.id) return;
  
  try {
    // Generate a key for this agent/message combo
    const broadcastKey = `${agent.id}-broadcast`;
    const now = Date.now();
    
    // Check if we've recently sent a broadcast from this agent
    const lastBroadcast = recentBroadcasts[broadcastKey] || 0;
    const cooldownMs = cooldownSeconds * 1000;
    
    if (now - lastBroadcast < cooldownMs) {
      console.log(`Broadcast from ${agent.name} is on cooldown. Skipping.`);
      return;
    }
    
    // Record this broadcast to prevent duplicates
    recentBroadcasts[broadcastKey] = now;
    
    // Import dynamically to avoid circular dependencies
    const { createMessage } = await import('@/lib/api');
    
    // Create the message
    await createMessage({
      project_id: project.id,
      content: message,
      sender: agent.name,
      type: "text"
    });
    
    console.log(`Agent ${agent.name} broadcast message: ${message.substring(0, 50)}...`);
  } catch (error) {
    console.error('Error broadcasting message:', error);
  }
};
