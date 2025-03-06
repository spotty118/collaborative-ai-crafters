// Import necessary modules

// Track tokens for each agent
const tokens: Record<string, boolean> = {};

// Track last message sent time for each agent to implement rate limiting
const lastMessageTime: Record<string, number> = {};
const MIN_MESSAGE_INTERVAL = 2000; // 2 seconds between messages

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
