import { supabase } from "@/integrations/supabase/client";
import agentMessageBus from "./agentMessageBus";
import { toast } from "sonner";

/**
 * Start agent orchestration for a project
 */
export const startAgentOrchestration = async (
  projectId: string,
  agentId: string,
  taskId?: string
): Promise<{ success: boolean; message: string }> => {
  console.log(`Starting agent orchestration: Project ${projectId}, Agent ${agentId}${taskId ? `, Task ${taskId}` : ''}`);
  
  try {
    // First try using the Edge Function
    try {
      const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
        body: {
          action: 'start',
          projectId,
          agentId,
          taskId,
          verbose: true
        }
      });
      
      if (!error) {
        console.log('Orchestration started successfully via Edge Function:', data);
        return { 
          success: true, 
          message: `Agent orchestration started successfully` 
        };
      }
      
      console.error('Edge Function error, falling back to direct API:', error);
    } catch (error) {
      console.error('Edge Function exception, falling back to direct API:', error);
    }
    
    // Fallback to direct database update
    const { error: updateError } = await supabase
      .from('agent_statuses')
      .update({ 
        status: 'working', 
        progress: 10,
        updated_at: new Date().toISOString()
      })
      .eq('id', agentId);
      
    if (updateError) {
      throw updateError;
    }
    
    // If taskId is specified, update task status
    if (taskId) {
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ 
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);
        
      if (taskError) {
        console.error('Error updating task status:', taskError);
      }
    }
    
    // Get agent details for notification
    const { data: agentData } = await supabase
      .from('agent_statuses')
      .select('name')
      .eq('id', agentId)
      .single();
      
    // Create a chat message
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `I'm now active and ready to work on tasks for this project.`,
        sender: agentData?.name || 'Agent',
        type: 'text'
      }]);
    
    // Notify through message bus system
    await agentMessageBus.send(
      projectId,
      agentId,
      `Agent ${agentData?.name || 'Unknown'} status updated to working`,
      'progress',
      { 
        progress: 10, 
        status: 'working',
        sender: 'System'
      }
    );
      
    return { 
      success: true, 
      message: `Agent orchestration started successfully via direct API` 
    };
    
  } catch (error) {
    console.error('Orchestration error:', error);
    toast.error(`Failed to start agent orchestration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      success: false,
      message: `Failed to start agent: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Stop agent orchestration for a project
 */
export const stopAgentOrchestration = async (
  projectId: string,
  agentId: string
): Promise<{ success: boolean; message: string }> => {
  console.log(`Stopping agent orchestration: Project ${projectId}, Agent ${agentId}`);
  
  try {
    // First try using the Edge Function
    try {
      const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
        body: {
          action: 'stop',
          projectId,
          agentId
        }
      });
      
      if (!error) {
        console.log('Orchestration stopped successfully via Edge Function:', data);
        return { 
          success: true, 
          message: `Agent orchestration stopped successfully` 
        };
      }
      
      console.error('Edge Function error, falling back to direct API:', error);
    } catch (error) {
      console.error('Edge Function exception, falling back to direct API:', error);
    }
    
    // Fallback to direct database update
    const { error: updateError } = await supabase
      .from('agent_statuses')
      .update({ 
        status: 'idle', 
        progress: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', agentId);
      
    if (updateError) {
      throw updateError;
    }
    
    // Update any in-progress tasks assigned to this agent
    const { error: taskError } = await supabase
      .from('tasks')
      .update({ 
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('assigned_to', agentId)
      .eq('status', 'in_progress');
      
    if (taskError) {
      console.error('Error updating task statuses:', taskError);
    }
    
    // Get agent details for notification
    const { data: agentData } = await supabase
      .from('agent_statuses')
      .select('name')
      .eq('id', agentId)
      .single();
      
    // Create a chat message
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `I've paused my work. You can resume it anytime.`,
        sender: agentData?.name || 'Agent',
        type: 'text'
      }]);
    
    // Notify through message bus system
    await agentMessageBus.send(
      projectId,
      agentId,
      `Agent ${agentData?.name || 'Unknown'} status updated to idle`,
      'progress',
      { 
        progress: 0, 
        status: 'idle',
        sender: 'System'
      }
    );
      
    return { 
      success: true, 
      message: `Agent orchestration stopped successfully via direct API` 
    };
    
  } catch (error) {
    console.error('Error in stopAgentOrchestration:', error);
    
    throw new Error(`Failed to stop agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Update agent progress
 */
export const updateAgentProgress = async (
  projectId: string,
  agentId: string,
  progress: number,
  status: string = 'working'
): Promise<{ success: boolean; message: string }> => {
  console.log(`Updating agent progress: Project ${projectId}, Agent ${agentId}, Progress ${progress}%, Status ${status}`);
  
  try {
    // Update agent status in the database
    const { error: updateError } = await supabase
      .from('agent_statuses')
      .update({ 
        status, 
        progress,
        updated_at: new Date().toISOString()
      })
      .eq('id', agentId);
      
    if (updateError) {
      throw updateError;
    }
    
    // Get agent details for notification
    const { data: agentData } = await supabase
      .from('agent_statuses')
      .select('name')
      .eq('id', agentId)
      .single();
    
    // Only create chat message for significant progress updates
    if (progress % 20 === 0 || progress === 100) {
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content: progress === 100 
            ? `I've completed my assigned task.` 
            : `Making progress on my assigned task. Current progress: ${progress}%`,
          sender: agentData?.name || 'Agent',
          type: 'text'
        }]);
    }
    
    // Notify through message bus system
    await agentMessageBus.send(
      projectId,
      agentId,
      `Agent ${agentData?.name || 'Unknown'} progress update: ${progress}%`,
      'progress',
      { 
        progress, 
        status,
        sender: 'System'
      }
    );
    
    return {
      success: true,
      message: `Agent progress updated successfully`
    };
    
  } catch (error) {
    console.error('Error updating agent progress:', error);
    
    return {
      success: false,
      message: `Failed to update agent progress: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Complete a task
 */
export const completeTask = async (
  projectId: string,
  agentId: string,
  taskId: string
): Promise<{ success: boolean; message: string }> => {
  console.log(`Completing task: Project ${projectId}, Agent ${agentId}, Task ${taskId}`);
  
  try {
    // Update task status
    const { error: taskError } = await supabase
      .from('tasks')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);
      
    if (taskError) {
      throw taskError;
    }
    
    // Get agent details
    const { data: agentData } = await supabase
      .from('agent_statuses')
      .select('name')
      .eq('id', agentId)
      .single();
    
    // Get task details
    const { data: taskData } = await supabase
      .from('tasks')
      .select('title')
      .eq('id', taskId)
      .single();
    
    // Create a chat message
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `I have completed the task: "${taskData?.title || 'Unknown task'}"`,
        sender: agentData?.name || 'Agent',
        type: 'text'
      }]);
    
    // Update agent status to idle if it was working
    await supabase
      .from('agent_statuses')
      .update({ 
        status: 'idle', 
        progress: 100,
        updated_at: new Date().toISOString()
      })
      .eq('id', agentId)
      .eq('status', 'working');
    
    // Notify through message bus system
    await agentMessageBus.send(
      projectId,
      agentId,
      `Task completion: ${taskData?.title || 'Unknown task'}`,
      'progress',
      { 
        progress: 100, 
        status: 'idle',
        taskId,
        sender: 'System'
      }
    );
    
    return {
      success: true,
      message: `Task completed successfully`
    };
    
  } catch (error) {
    console.error('Error completing task:', error);
    
    return {
      success: false,
      message: `Failed to complete task: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Initialize CrewAI orchestration for a project
 */
export const initializeCrewAI = async (
  projectId: string
): Promise<boolean> => {
  console.log(`Initializing CrewAI orchestration for project ${projectId}`);
  
  try {
    // This is a placeholder implementation that just returns success
    // In a real implementation, you would initialize CrewAI here
    
    // For now, we'll just create a chat message to indicate initialization
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `CrewAI orchestration initialized for project`,
        sender: 'System',
        type: 'text'
      }]);
      
    return true;
    
  } catch (error) {
    console.error('Error initializing CrewAI:', error);
    return false;
  }
};

/**
 * Update CrewAI orchestration for a project
 */
export const updateCrewAIOrchestration = async (
  projectId: string,
  updates: any
): Promise<boolean> => {
  console.log(`Updating CrewAI orchestration for project ${projectId}`, updates);
  
  try {
    // This is a placeholder implementation that just returns success
    // In a real implementation, you would update CrewAI orchestration here
    
    // For now, we'll just create a chat message to indicate update
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `CrewAI orchestration updated for project`,
        sender: 'System',
        type: 'text'
      }]);
      
    return true;
    
  } catch (error) {
    console.error('Error updating CrewAI orchestration:', error);
    return false;
  }
};

/**
 * Handle CrewAI task completion
 */
export const handleCrewTaskCompletion = async (
  projectId: string,
  taskId: string,
  result: any
): Promise<boolean> => {
  console.log(`Handling CrewAI task completion for project ${projectId}, task ${taskId}`, result);
  
  try {
    // Get agent information
    const agentId = result.agentId;
    
    if (!agentId) {
      throw new Error('No agent ID provided in result');
    }
    
    // Complete the task using the existing completeTask function
    const completionResult = await completeTask(projectId, agentId, taskId);
    
    return completionResult.success;
    
  } catch (error) {
    console.error('Error handling CrewAI task completion:', error);
    return false;
  }
};
