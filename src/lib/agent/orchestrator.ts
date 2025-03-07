import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import agentMessageBus from "./agentMessageBus";

// Function signatures needed by useCrewAI hook
export const initializeCrewAI = async (projectId: string): Promise<boolean> => {
  try {
    console.log(`Initializing CrewAI for project ${projectId}`);
    // Call the edge function to initialize the crew
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: { 
        action: 'initialize',
        projectId
      }
    });
    
    if (error) {
      console.error("Error initializing CrewAI:", error);
      return false;
    }
    
    return data?.success || false;
  } catch (error) {
    console.error("Exception initializing CrewAI:", error);
    return false;
  }
};

export const updateCrewAIOrchestration = async (projectId: string, updates: any): Promise<boolean> => {
  try {
    console.log(`Updating CrewAI orchestration for project ${projectId}`, updates);
    
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: { 
        action: 'update',
        projectId,
        updates
      }
    });
    
    if (error) {
      console.error("Error updating CrewAI orchestration:", error);
      return false;
    }
    
    return data?.success || false;
  } catch (error) {
    console.error("Exception updating CrewAI orchestration:", error);
    return false;
  }
};

export const handleCrewTaskCompletion = async (projectId: string, taskId: string): Promise<boolean> => {
  try {
    console.log(`Handling task completion for task ${taskId} in project ${projectId}`);
    
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: { 
        action: 'completeTask',
        projectId,
        taskId
      }
    });
    
    if (error) {
      console.error("Error handling CrewAI task completion:", error);
      return false;
    }
    
    return data?.success || false;
  } catch (error) {
    console.error("Exception handling CrewAI task completion:", error);
    return false;
  }
};
