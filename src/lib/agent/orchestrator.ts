
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

/**
 * Start agent orchestration
 * 
 * @param projectId - The project ID
 * @param agentId - The agent ID to start
 * @param taskId - Optional specific task ID to execute
 * @returns Promise with the response
 */
export const startAgentOrchestration = async (
  projectId: string,
  agentId: string,
  taskId?: string
): Promise<any> => {
  try {
    console.log(`Starting agent orchestration: Project ${projectId}, Agent ${agentId}`);
    
    // Call the Supabase Function for crew orchestration
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: {
        projectId,
        agentId,
        taskId,
        action: 'start'
      }
    });
    
    if (error) {
      console.error('Orchestration error:', error);
      throw new Error(`Failed to start agent: ${error.message}`);
    }
    
    console.log('Orchestration response:', data);
    return data;
  } catch (error) {
    console.error('Error in startAgentOrchestration:', error);
    throw error;
  }
};

/**
 * Stop agent orchestration
 * 
 * @param projectId - The project ID
 * @param agentId - The agent ID to stop
 * @returns Promise with the response
 */
export const stopAgentOrchestration = async (
  projectId: string,
  agentId: string
): Promise<any> => {
  try {
    console.log(`Stopping agent orchestration: Project ${projectId}, Agent ${agentId}`);
    
    // Call the Supabase Function for crew orchestration
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: {
        projectId,
        agentId,
        action: 'stop'
      }
    });
    
    if (error) {
      console.error('Orchestration error:', error);
      throw new Error(`Failed to stop agent: ${error.message}`);
    }
    
    console.log('Orchestration response:', data);
    return data;
  } catch (error) {
    console.error('Error in stopAgentOrchestration:', error);
    throw error;
  }
};
