
import { Agent, Project, Message } from '@/lib/types';
import { createMessage, getAgents } from '@/lib/api';
import { sendAgentPrompt } from '@/lib/openrouter';
import { toast } from 'sonner';

// Token system to prevent communication conflicts
let communicationToken: string | null = null;
let tokenHolderAgent: string | null = null;

// Track recent broadcasts to prevent duplicates
const recentBroadcasts = new Map<string, number>();
const BROADCAST_COOLDOWN_MS = 30000; // 30 seconds cooldown between identical broadcasts

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
 * Create a broadcast message from one agent to all other agents
 */
export const broadcastMessage = async (
  sourceAgent: Agent,
  message: string,
  project: Project,
  cooldownSeconds: number = 30
): Promise<void> => {
  try {
    // Create a unique key for this broadcast to prevent duplicates
    const broadcastKey = `${sourceAgent.id}-${message}`;
    const now = Date.now();
    const cooldownMs = cooldownSeconds * 1000;
    
    // Check if this is a duplicate broadcast within the cooldown period
    const lastBroadcastTime = recentBroadcasts.get(broadcastKey);
    if (lastBroadcastTime && (now - lastBroadcastTime) < cooldownMs) {
      console.log(`Skipping duplicate broadcast from ${sourceAgent.name}: "${message.substring(0, 30)}..."`);
      return;
    }
    
    // Record this broadcast to prevent duplicates
    recentBroadcasts.set(broadcastKey, now);
    
    // Clean up old broadcast records (older than 5 minutes)
    const CLEANUP_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    for (const [key, timestamp] of recentBroadcasts.entries()) {
      if (now - timestamp > CLEANUP_THRESHOLD) {
        recentBroadcasts.delete(key);
      }
    }
    
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
      const actualPriority = sourceAgent.type === 'architect' ? cooldownSeconds + 1 : cooldownSeconds;
      
      // Import and use the initiateConversation function to avoid circular dependencies
      const { initiateConversation } = await import('./agentCommunication');
      
      // Start conversations with each agent with a delay to avoid rate limiting
      for (let i = 0; i < otherAgents.length; i++) {
        const agent = otherAgents[i];
        
        // Create a closure to preserve the agent variable
        setTimeout(() => {
          initiateConversation(sourceAgent, agent, message, project, actualPriority);
        }, i * 8000); // 8-second spacing between conversation starts
      }
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
    
    // Import the initiateConversation function to avoid circular dependencies
    const { initiateConversation } = await import('./agentCommunication');
    
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

// Export tokenHolderAgent for modules that need to check it
export { tokenHolderAgent };
