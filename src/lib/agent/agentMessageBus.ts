
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageType, AgentIdentity } from "@/lib/types";

/**
 * Type definitions for agent messages
 */
export interface AgentMessage {
  id: string;
  project_id: string;
  agent_id: string;
  content: string;
  type: MessageType;
  status: "pending" | "delivered" | "read";
  metadata?: Record<string, any>;
  created_at: string;
  from?: AgentIdentity;
  to?: AgentIdentity;
}

interface Subscriber {
  id: string;
  callback: (message: AgentMessage) => void;
}

interface MessageCache {
  [agentId: string]: {
    lastMessageId?: string;
    messages: AgentMessage[];
    lastFetched: number;
  };
}

/**
 * Agent Message Bus for handling inter-agent communication
 */
class AgentMessageBus {
  private subscribers: Map<string, Subscriber[]> = new Map();
  private pollingInterval: number = 5000;
  private pollingTimers: Map<string, NodeJS.Timeout> = new Map();
  private messageCache: MessageCache = {};
  private initialized: boolean = false;
  private retryCount: Map<string, number> = new Map();
  private MAX_RETRIES = 3;
  private fallbackToHttp: boolean = false;

  /**
   * Initialize the message bus
   */
  constructor() {
    // Initialize on first use instead of constructor
  }

  /**
   * Initialize the message bus
   */
  private initialize() {
    if (this.initialized) return;
    this.initialized = true;
    console.log("Initializing agent message bus");
    
    // Test the connection to the Edge Function
    this.testEdgeFunction().then((result) => {
      this.fallbackToHttp = !result;
      if (this.fallbackToHttp) {
        console.info("Fallback HTTP mode enabled");
      }
    });
  }

  /**
   * Test the Edge Function connectivity
   */
  private async testEdgeFunction(): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
        body: { action: 'ping' }
      });
      
      return !error && data?.success;
    } catch (error) {
      console.error("Edge function test failed:", error);
      return false;
    }
  }

  /**
   * Send a message to an agent
   */
  async send(
    projectId: string, 
    toAgentId: string, 
    content: string, 
    type: MessageType = "text",
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    if (!this.initialized) this.initialize();
    
    try {
      // Create a chat message for the UI to see
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content,
          sender: metadata.sender || "System",
          type
        }]);
      
      // Update agent progress if this is a progress message
      if (type === "progress" && metadata.progress !== undefined) {
        const progress = Number(metadata.progress);
        if (!isNaN(progress)) {
          await supabase
            .from('agent_statuses')
            .update({ progress })
            .eq('id', toAgentId);
            
          console.log(`Updated agent ${toAgentId} progress to ${progress}%`);
        }
      }
      
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      return false;
    }
  }

  /**
   * Alias for send method to match agentCore expectations
   */
  async sendMessage(
    projectId: string, 
    toAgentId: string, 
    content: string, 
    type: MessageType = "text",
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    return this.send(projectId, toAgentId, content, type, metadata);
  }

  /**
   * Subscribe to messages for an agent
   */
  subscribe(agentId: string, callback: (message: AgentMessage) => void): () => void {
    if (!this.initialized) this.initialize();
    
    const subscriberId = Math.random().toString(36).substring(2, 15);
    
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, []);
      this.setupRealtimeListener(agentId);
    }
    
    this.subscribers.get(agentId)!.push({ id: subscriberId, callback });
    
    // Initialize cache for this agent if not exists
    if (!this.messageCache[agentId]) {
      this.messageCache[agentId] = {
        messages: [],
        lastFetched: 0
      };
    }
    
    // Initial fetch of messages
    this.fetchMessages(agentId);
    
    return () => {
      this.unsubscribe(agentId, subscriberId);
    };
  }

  /**
   * Unsubscribe from messages
   */
  private unsubscribe(agentId: string, subscriberId: string): void {
    const agentSubscribers = this.subscribers.get(agentId);
    
    if (!agentSubscribers) return;
    
    const updatedSubscribers = agentSubscribers.filter(sub => sub.id !== subscriberId);
    
    if (updatedSubscribers.length === 0) {
      this.subscribers.delete(agentId);
      
      // Clear polling timer
      const timer = this.pollingTimers.get(agentId);
      if (timer) {
        clearInterval(timer);
        this.pollingTimers.delete(agentId);
      }
    } else {
      this.subscribers.set(agentId, updatedSubscribers);
    }
  }

  /**
   * Get progress for an agent
   */
  getAgentProgress(agentId: string): number {
    const cache = this.messageCache[agentId];
    
    if (!cache || !cache.messages) return 0;
    
    // Find latest progress message
    const progressMessages = cache.messages
      .filter(msg => msg.type === "progress" && msg.metadata?.progress !== undefined)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
    if (progressMessages.length > 0 && progressMessages[0].metadata?.progress !== undefined) {
      return Number(progressMessages[0].metadata.progress);
    }
    
    return 0;
  }

  /**
   * Fetch messages for an agent
   */
  private async fetchMessages(agentId: string): Promise<void> {
    try {
      console.info(`Fetching messages for agent ${agentId}...`);
      
      // In production, we'd fetch from messages table
      // For now, we'll just get the agent status to show progress
      const { data, error } = await supabase
        .from('agent_statuses')
        .select('progress, status')
        .eq('id', agentId)
        .single();
        
      if (error) {
        throw error;
      }
      
      if (data) {
        // Create a synthetic progress message
        const progressMessage: AgentMessage = {
          id: `progress-${Date.now()}`,
          project_id: '',
          agent_id: agentId,
          content: `Agent progress updated to ${data.progress}%`,
          type: 'progress',
          status: 'delivered',
          metadata: { progress: data.progress, status: data.status },
          created_at: new Date().toISOString()
        };
        
        // Update cache and notify subscribers
        this.updateCache(agentId, [progressMessage]);
        this.notifySubscribers(agentId, progressMessage);
      }
      
      // Reset retry count on success
      this.retryCount.set(agentId, 0);
    } catch (error) {
      console.error("Error fetching agent status:", error);
      
      // Increment retry count
      const currentRetries = this.retryCount.get(agentId) || 0;
      this.retryCount.set(agentId, currentRetries + 1);
      
      // If we've exceeded max retries, stop trying to avoid overwhelming the server
      if (currentRetries >= this.MAX_RETRIES) {
        console.warn(`Max retries exceeded for agent ${agentId}, pausing status updates`);
        const timer = this.pollingTimers.get(agentId);
        if (timer) {
          clearInterval(timer);
          this.pollingTimers.delete(agentId);
        }
      }
    }
  }

  /**
   * Set up realtime listener for an agent
   */
  private setupRealtimeListener(agentId: string): void {
    // Already have a polling timer for this agent
    if (this.pollingTimers.has(agentId)) return;
    
    // Set up polling as fallback mechanism
    const timerId = setInterval(() => this.fetchMessages(agentId), this.pollingInterval);
    this.pollingTimers.set(agentId, timerId);
  }

  /**
   * Update the message cache
   */
  private updateCache(agentId: string, messages: AgentMessage[]): void {
    if (!this.messageCache[agentId]) {
      this.messageCache[agentId] = {
        messages: [],
        lastFetched: Date.now()
      };
    }
    
    // Update the cache with new messages
    const cache = this.messageCache[agentId];
    const existingIds = new Set(cache.messages.map(m => m.id));
    
    // Add only new messages to avoid duplicates
    const newMessages = messages.filter(m => !existingIds.has(m.id));
    
    cache.messages = [...cache.messages, ...newMessages];
    cache.lastFetched = Date.now();
    
    // Sort messages by creation time
    cache.messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    // Keep only last 100 messages to avoid memory issues
    if (cache.messages.length > 100) {
      cache.messages = cache.messages.slice(-100);
    }
  }

  /**
   * Notify subscribers of a new message
   */
  private notifySubscribers(agentId: string, message: AgentMessage): void {
    const subscribers = this.subscribers.get(agentId);
    
    if (!subscribers) return;
    
    subscribers.forEach(subscriber => {
      try {
        subscriber.callback(message);
      } catch (error) {
        console.error(`Error notifying subscriber ${subscriber.id}:`, error);
      }
    });
  }
}

// Export a singleton instance
const agentMessageBus = new AgentMessageBus();
export default agentMessageBus;
