
import { supabase } from "@/integrations/supabase/client";

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
