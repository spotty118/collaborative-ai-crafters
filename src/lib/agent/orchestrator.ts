
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

// Functions needed by Project.tsx and useAgentSystem.ts
export const startAgentOrchestration = async (projectId: string, agentId: string, taskId?: string): Promise<any> => {
  try {
    console.log(`Starting agent orchestration for agent ${agentId} in project ${projectId}`);
    
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: { 
        action: 'start',
        projectId,
        agentId,
        taskId
      }
    });
    
    if (error) {
      console.error("Error starting agent orchestration:", error);
      return { success: false, message: error.message };
    }
    
    return data || { success: true };
  } catch (error) {
    console.error("Exception starting agent orchestration:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

export const stopAgentOrchestration = async (projectId: string, agentId: string): Promise<any> => {
  try {
    console.log(`Stopping agent orchestration for agent ${agentId} in project ${projectId}`);
    
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: { 
        action: 'stop',
        projectId,
        agentId
      }
    });
    
    if (error) {
      console.error("Error stopping agent orchestration:", error);
      return { success: false, message: error.message };
    }
    
    return data || { success: true };
  } catch (error) {
    console.error("Exception stopping agent orchestration:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

export const updateAgentProgress = async (
  projectId: string, 
  agentId: string, 
  progress: number, 
  status: string = 'working'
): Promise<any> => {
  try {
    console.log(`Updating agent ${agentId} progress to ${progress}%`);
    
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: { 
        action: 'update_progress',
        projectId,
        agentId,
        progress,
        status
      }
    });
    
    if (error) {
      console.error("Error updating agent progress:", error);
      return { success: false, message: error.message };
    }
    
    // Also update via message bus for real-time updates
    await agentMessageBus.send(
      projectId,
      agentId,
      `Progress updated to ${progress}%`,
      'progress',
      { progress, status }
    );
    
    return data || { success: true };
  } catch (error) {
    console.error("Exception updating agent progress:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

export const completeTask = async (projectId: string, agentId: string, taskId: string): Promise<any> => {
  try {
    console.log(`Completing task ${taskId} by agent ${agentId}`);
    
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: { 
        action: 'complete_task',
        projectId,
        agentId,
        taskId
      }
    });
    
    if (error) {
      console.error("Error completing task:", error);
      return { success: false, message: error.message };
    }
    
    return data || { success: true };
  } catch (error) {
    console.error("Exception completing task:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};
