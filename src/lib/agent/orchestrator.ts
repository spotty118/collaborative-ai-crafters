
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import agentMessageBus from "./agentMessageBus";
import { MessageType } from "../types";

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
      
      console.log(`Found task: ${JSON.stringify(taskData)}`);
      
      // If task is not assigned to this agent, assign it
      if (taskData.assigned_to !== agentId) {
        console.log(`Task ${taskId} not assigned to agent ${agentId}, updating assignment`);
        
        // First update the database directly
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ 
            assigned_to: agentId, 
            status: 'in_progress',
            updated_at: new Date().toISOString()
          })
          .eq('id', taskId);
          
        if (updateError) {
          console.error("Error updating task assignment:", updateError);
          toast.error("Failed to assign task to agent");
          return { success: false, message: "Failed to assign task" };
        }
        
        // Then inform the orchestrator about the assignment
        const { error: assignError } = await supabase.functions.invoke('crew-orchestrator', {
          body: { 
            action: 'assign_task',
            projectId,
            agentId,
            taskId
          }
        });

        if (assignError) {
          console.error("Error in task assignment orchestration:", assignError);
          // Continue anyway since DB update succeeded
        }
        
        console.log(`Successfully assigned task ${taskId} to agent ${agentId}`);
      }
    }
    
    console.log(`Invoking crew-orchestrator edge function with: projectId=${projectId}, agentId=${agentId}, taskId=${taskId || 'none'}`);
    
    // Now invoke the edge function to start agent orchestration
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: { 
        action: 'start',
        projectId,
        agentId,
        taskId
      }
    });
    
    console.log(`Crew-orchestrator response: ${JSON.stringify(data)}`);
    
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
    
    // First update the agent status locally to improve UI responsiveness
    const { error: localUpdateError } = await supabase
      .from('agent_statuses') // Changed from 'agents' to 'agent_statuses'
      .update({ status: 'idle' })
      .eq('id', agentId);
      
    if (localUpdateError) {
      console.warn("Local agent status update failed:", localUpdateError);
      // Continue anyway to try the edge function
    }
    
    // Call the edge function to officially stop the agent
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: { 
        action: 'stop',
        projectId,
        agentId
      }
    });
    
    if (error) {
      console.error("Error stopping agent orchestration:", error);
      
      // Even if the edge function fails, we consider the stop successful
      // for better UX since we've already updated the status locally
      toast.success("Agent stopped (local update only)");
      
      return { 
        success: true, 
        message: "Agent stopped locally but edge function failed",
        error: error.message 
      };
    }
    
    if (data?.success) {
      toast.success("Agent stopped successfully");
    } else if (data?.warning) {
      toast.success("Agent stopped with warnings");
      console.warn("Warning while stopping agent:", data.warning);
    }
    
    return data || { success: true };
  } catch (error) {
    console.error("Exception stopping agent orchestration:", error);
    
    // Even with an exception, we want to return success to prevent UI block
    toast.success("Agent stopped (may need refresh)");
    
    return { 
      success: true, 
      message: "Agent stop attempted with errors",
      error: error instanceof Error ? error.message : 'Unknown error' 
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
      'progress' as MessageType,
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
    
    // First, get task details to log what's being assigned
    const { data: taskData, error: taskFetchError } = await supabase
      .from('tasks')
      .select('title, status, assigned_to')
      .eq('id', taskId)
      .single();
      
    if (taskFetchError) {
      console.error("Error fetching task details:", taskFetchError);
      toast.error("Failed to fetch task details");
      return { success: false, message: taskFetchError.message };
    }

    console.log(`Task ${taskId} details:`, {
      title: taskData.title,
      currentStatus: taskData.status,
      currentAssignment: taskData.assigned_to || 'None'
    });
    
    // Update the task in the database
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
    
    console.log(`Successfully updated task assignment in database`);
    
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
