
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

/**
 * Initialize CrewAI orchestration
 * 
 * @param projectId - The project ID
 * @returns Promise with the initialization response
 */
export const initializeCrewAI = async (projectId: string): Promise<any> => {
  try {
    console.log(`Initializing CrewAI orchestration for project ${projectId}`);
    
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: {
        projectId,
        action: 'initialize'
      }
    });
    
    if (error) {
      console.error('Initialization error:', error);
      throw new Error(`Failed to initialize CrewAI: ${error.message}`);
    }
    
    console.log('Initialization response:', data);
    return data;
  } catch (error) {
    console.error('Error in initializeCrewAI:', error);
    throw error;
  }
};

/**
 * Update CrewAI orchestration
 * 
 * @param projectId - The project ID
 * @param updates - The updates to apply
 * @returns Promise with the update response
 */
export const updateCrewAIOrchestration = async (
  projectId: string, 
  updates: any
): Promise<any> => {
  try {
    console.log(`Updating CrewAI orchestration for project ${projectId}`, updates);
    
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: {
        projectId,
        updates,
        action: 'update'
      }
    });
    
    if (error) {
      console.error('Update error:', error);
      throw new Error(`Failed to update CrewAI: ${error.message}`);
    }
    
    console.log('Update response:', data);
    return data;
  } catch (error) {
    console.error('Error in updateCrewAIOrchestration:', error);
    throw error;
  }
};

/**
 * Handle CrewAI task completion
 * 
 * @param projectId - The project ID
 * @param taskId - The task ID that was completed
 * @param result - The task result
 * @returns Promise with the completion response
 */
export const handleCrewTaskCompletion = async (
  projectId: string,
  taskId: string,
  result: any
): Promise<any> => {
  try {
    console.log(`Handling task completion for project ${projectId}, task ${taskId}`);
    
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: {
        projectId,
        taskId,
        result,
        action: 'complete_task'
      }
    });
    
    if (error) {
      console.error('Task completion error:', error);
      throw new Error(`Failed to handle task completion: ${error.message}`);
    }
    
    console.log('Task completion response:', data);
    return data;
  } catch (error) {
    console.error('Error in handleCrewTaskCompletion:', error);
    throw error;
  }
};
