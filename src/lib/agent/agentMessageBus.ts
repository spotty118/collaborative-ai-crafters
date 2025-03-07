
/**
 * Agent Message Bus
 * 
 * Handles real-time communication between different agents.
 * Implements a publish-subscribe pattern for agent messages.
 */

import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from 'uuid';

export interface AgentMessage {
  id: string;
  from: {
    id: string;
    name: string;
    type: string;
  };
  to: {
    id: string;
    name?: string;
    type?: string;
  };
  content: string;
  type: 'request' | 'response' | 'update' | 'notification' | 'task' | 'progress';
  timestamp: number;
  projectId: string;
  metadata?: Record<string, any>;
}

type MessageCallback = (message: AgentMessage) => void | Promise<void>;

class AgentMessageBus {
  private subscribers: Map<string, Set<MessageCallback>>;
  private channels: Map<string, any>; // Store Supabase channel subscriptions
  private messageCache: Map<string, AgentMessage[]>;
  private maxCacheSize: number;
  private agentProgressMap: Map<string, number>; // Track individual agent progress
  private retryDelays: number[]; // Exponential backoff delays in ms
  private fetchTimeouts: Map<string, ReturnType<typeof setTimeout>>;
  
  constructor() {
    this.subscribers = new Map();
    this.channels = new Map();
    this.messageCache = new Map();
    this.maxCacheSize = 100; // Store last 100 messages per agent
    this.agentProgressMap = new Map(); // Initialize progress tracking
    this.retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff
    this.fetchTimeouts = new Map();
  }
  
  /**
   * Send a message from one agent to another
   */
  async sendMessage(message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<string> {
    const messageId = uuidv4();
    const timestamp = Date.now();
    
    const fullMessage: AgentMessage = {
      ...message,
      id: messageId,
      timestamp
    };
    
    // Update progress if this is a progress message
    if (message.type === 'progress' && message.metadata?.progress !== undefined) {
      this.updateAgentProgress(message.from.id, message.metadata.progress);
    }
    
    try {
      // Store message in the database with proper error handling
      const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
        body: {
          action: 'send_message',
          projectId: message.projectId,
          messageData: {
            id: messageId,
            fromAgentId: message.from.id,
            toAgentId: message.to.id,
            content: message.content,
            type: message.type,
            metadata: message.metadata
          }
        }
      });
      
      if (error) {
        console.error('Error sending agent message:', error);
        // Cache the message anyway so we don't lose it
        this.cacheMessage(fullMessage.to.id, fullMessage);
        this.notifySubscribers(fullMessage.to.id, fullMessage);
        
        // Return messageId even if there was an error with the server
        return messageId;
      }
      
      // Cache the message
      this.cacheMessage(fullMessage.to.id, fullMessage);
      
      // Notify subscribers
      this.notifySubscribers(fullMessage.to.id, fullMessage);
      
      return messageId;
    } catch (error) {
      console.error('Error in sendMessage:', error);
      
      // Cache the message even if there was an error
      this.cacheMessage(fullMessage.to.id, fullMessage);
      this.notifySubscribers(fullMessage.to.id, fullMessage);
      
      return messageId;
    }
  }
  
  /**
   * Send a progress update for an agent
   */
  async updateProgress(
    fromAgent: { id: string, name: string, type: string },
    progress: number,
    projectId: string
  ): Promise<string> {
    // Update local progress tracking
    this.updateAgentProgress(fromAgent.id, progress);
    
    // Persist to database
    try {
      await supabase
        .from('agent_statuses')
        .update({ progress })
        .eq('id', fromAgent.id);
    } catch (error) {
      console.error('Error updating agent progress in database:', error);
    }
    
    // Create and send progress update message
    return this.sendMessage({
      from: fromAgent,
      to: { id: 'system' }, // Send to system
      content: `Agent progress updated to ${progress}%`,
      type: 'progress',
      projectId,
      metadata: { progress }
    });
  }
  
  /**
   * Get current progress for an agent
   */
  getAgentProgress(agentId: string): number {
    return this.agentProgressMap.get(agentId) || 0;
  }
  
  /**
   * Update agent progress locally
   */
  private updateAgentProgress(agentId: string, progress: number): void {
    this.agentProgressMap.set(agentId, progress);
  }
  
  /**
   * Subscribe to messages for a specific agent
   */
  subscribe(agentId: string, callback: MessageCallback): () => void {
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, new Set());
      this.setupRealtimeListener(agentId);
    }
    
    this.subscribers.get(agentId)?.add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(agentId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(agentId);
          this.removeRealtimeListener(agentId);
        }
      }
    };
  }
  
  /**
   * Setup realtime listener for agent messages with better error handling and retry logic
   */
  private setupRealtimeListener(agentId: string): void {
    let retryCount = 0;
    const fetchWithRetry = async () => {
      try {
        console.log(`Fetching messages for agent ${agentId}...`);
        const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
          body: {
            action: 'get_messages',
            agentId
          }
        });
        
        if (error) {
          throw error;
        }
        
        // Reset retry count on success
        retryCount = 0;
        
        if (data?.messages && Array.isArray(data.messages)) {
          data.messages
            .filter(msg => msg.status === 'pending' || msg.status === 'delivered')
            .forEach(msg => {
              const message: AgentMessage = {
                id: msg.id,
                from: {
                  id: msg.fromAgentId,
                  name: 'Unknown',
                  type: 'unknown'
                },
                to: {
                  id: msg.toAgentId
                },
                content: msg.content,
                type: msg.type as any,
                timestamp: new Date(msg.created_at || Date.now()).getTime(),
                projectId: msg.projectId,
                metadata: msg.metadata
              };
              
              this.notifySubscribers(agentId, message);
            });
        }
      } catch (error) {
        console.error('Error fetching agent messages:', error);
        
        // Implement exponential backoff for retries
        if (retryCount < this.retryDelays.length) {
          const delay = this.retryDelays[retryCount];
          console.log(`Retrying in ${delay}ms (attempt ${retryCount + 1}/${this.retryDelays.length})`);
          retryCount++;
        }
      }
    };

    // Initial fetch
    fetchWithRetry();
    
    // Set up polling with the possibility to cancel
    const intervalId = setInterval(fetchWithRetry, 5000);
    this.channels.set(agentId, intervalId);
  }
  
  /**
   * Remove realtime listener
   */
  private removeRealtimeListener(agentId: string): void {
    const channel = this.channels.get(agentId);
    if (channel) {
      clearInterval(channel);
      this.channels.delete(agentId);
      
      // Clear any pending fetch timeouts
      const timeout = this.fetchTimeouts.get(agentId);
      if (timeout) {
        clearTimeout(timeout);
        this.fetchTimeouts.delete(agentId);
      }
    }
  }
  
  /**
   * Cache a message for later retrieval
   */
  private cacheMessage(agentId: string, message: AgentMessage): void {
    if (!this.messageCache.has(agentId)) {
      this.messageCache.set(agentId, []);
    }
    
    const cache = this.messageCache.get(agentId)!;
    cache.push(message);
    
    // Trim cache if it exceeds max size
    if (cache.length > this.maxCacheSize) {
      cache.shift();
    }
  }
  
  /**
   * Notify subscribers of a new message
   */
  private notifySubscribers(agentId: string, message: AgentMessage): void {
    const callbacks = this.subscribers.get(agentId);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Error in message subscriber callback:', error);
        }
      });
    }
    
    // If this is a progress message, also notify any system subscribers
    if (message.type === 'progress') {
      const systemCallbacks = this.subscribers.get('system');
      if (systemCallbacks) {
        systemCallbacks.forEach(callback => {
          try {
            callback(message);
          } catch (error) {
            console.error('Error in system subscriber callback:', error);
          }
        });
      }
    }
  }
  
  /**
   * Get cached messages for an agent
   */
  getCachedMessages(agentId: string): AgentMessage[] {
    return this.messageCache.get(agentId) || [];
  }
  
  /**
   * Broadcast a message to all agents of a specific type
   */
  async broadcastToType(
    fromAgent: { id: string, name: string, type: string },
    targetType: string,
    content: string,
    projectId: string,
    metadata?: Record<string, any>
  ): Promise<number> {
    try {
      // Fetch all agents of the target type
      const { data: agents, error } = await supabase
        .from('agent_statuses')
        .select('id, name, agent_type')
        .eq('project_id', projectId)
        .eq('agent_type', targetType);
        
      if (error) {
        console.error('Error fetching agents for broadcast:', error);
        throw error;
      }
      
      if (!agents || agents.length === 0) {
        return 0;
      }
      
      // Send message to each agent
      const sendPromises = agents.map(agent => 
        this.sendMessage({
          from: fromAgent,
          to: {
            id: agent.id,
            name: agent.name,
            type: agent.agent_type
          },
          content,
          type: 'notification',
          projectId,
          metadata
        })
      );
      
      await Promise.all(sendPromises);
      
      return agents.length;
    } catch (error) {
      console.error('Error in broadcastToType:', error);
      throw error;
    }
  }
}

// Export singleton instance
const agentMessageBus = new AgentMessageBus();
export default agentMessageBus;
