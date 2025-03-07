
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
    console.log(`Starting agent orchestration for agent ${agentId} in project ${projectId}${taskId ? ` with task ${taskId}` : ''}`);
    
    // Verify if the task exists and is assigned to the agent if taskId is provided
    if (taskId) {
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();
        
      if (taskError) {
        console.error("Error fetching task:", taskError);
        toast.error("Failed to start agent: Task not found");
        return { success: false, message: "Task not found" };
      }
      
      // If task is not assigned to this agent, assign it
      if (taskData.assigned_to !== agentId) {
        console.log(`Task ${taskId} not assigned to agent ${agentId}, updating assignment`);
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ assigned_to: agentId, status: 'in_progress' })
          .eq('id', taskId);
          
        if (updateError) {
          console.error("Error updating task assignment:", updateError);
          toast.error("Failed to assign task to agent");
          return { success: false, message: "Failed to assign task" };
        }
        
        console.log(`Successfully assigned task ${taskId} to agent ${agentId}`);
      }
    }
    
    // Now invoke the edge function to start agent orchestration
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
      toast.error(`Failed to start agent: ${error.message}`);
      return { success: false, message: error.message };
    }
    
    if (data?.success) {
      toast.success("Agent started successfully");
    }
    
    return data || { success: true };
  } catch (error) {
    console.error("Exception starting agent orchestration:", error);
    toast.error(`Failed to start agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      toast.error(`Failed to stop agent: ${error.message}`);
      return { success: false, message: error.message };
    }
    
    if (data?.success) {
      toast.success("Agent stopped successfully");
    }
    
    return data || { success: true };
  } catch (error) {
    console.error("Exception stopping agent orchestration:", error);
    toast.error(`Failed to stop agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      toast.error(`Failed to complete task: ${error.message}`);
      return { success: false, message: error.message };
    }
    
    if (data?.success) {
      toast.success("Task completed successfully");
    }
    
    return data || { success: true };
  } catch (error) {
    console.error("Exception completing task:", error);
    toast.error(`Failed to complete task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

// Adding a new function to explicitly assign a task to an agent
export const assignTask = async (projectId: string, taskId: string, agentId: string): Promise<any> => {
  try {
    console.log(`Manually assigning task ${taskId} to agent ${agentId} in project ${projectId}`);
    
    // First, update the task in the database
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ 
        assigned_to: agentId,
        status: 'pending', // Set to pending so it can be picked up
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);
      
    if (updateError) {
      console.error("Error updating task assignment:", updateError);
      toast.error("Failed to assign task to agent");
      return { success: false, message: updateError.message };
    }
    
    // Now invoke the edge function to handle the assignment
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: { 
        action: 'assign_task',
        projectId,
        agentId,
        taskId
      }
    });
    
    if (error) {
      console.error("Error in task assignment orchestration:", error);
      toast.error(`Assignment registered but orchestration failed: ${error.message}`);
      return { 
        success: true, // Still return true since the DB update succeeded
        orchestration: false,
        message: error.message 
      };
    }
    
    toast.success(`Task assigned to agent successfully`);
    return data || { success: true };
  } catch (error) {
    console.error("Exception assigning task:", error);
    toast.error(`Failed to assign task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};
