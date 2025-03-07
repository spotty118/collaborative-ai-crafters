
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
 * Simulate an agent making progress by updating its status and progress periodically
 * This is a temporary function until the actual agent system is fully working
 */
export const simulateAgentProgress = async (
  projectId: string,
  agentId: string,
  taskId?: string,
  totalSteps: number = 5
): Promise<void> => {
  let currentStep = 0;
  
  // Get agent data
  const { data: agent } = await supabase
    .from('agent_statuses')
    .select('name, agent_type')
    .eq('id', agentId)
    .single();
    
  if (!agent) {
    console.error('Agent not found');
    return;
  }
  
  // Get task data if provided
  let task;
  if (taskId) {
    const { data } = await supabase
      .from('tasks')
      .select('title, description')
      .eq('id', taskId)
      .single();
      
    task = data;
  }
  
  // Update progress at regular intervals
  const interval = setInterval(async () => {
    currentStep++;
    const progress = Math.min(Math.floor((currentStep / totalSteps) * 100), 100);
    
    // Update agent status
    await supabase
      .from('agent_statuses')
      .update({ progress, status: progress < 100 ? 'working' : 'idle' })
      .eq('id', agentId);
      
    // Add a message to indicate progress
    let message = '';
    
    if (currentStep === 1) {
      message = task
        ? `I'm starting work on task: "${task.title}". First, I'll analyze what needs to be done.`
        : `I'm starting my work on this project. Analyzing requirements...`;
    } else if (currentStep === 2) {
      message = task
        ? `I've analyzed the requirements for "${task.title}". Now implementing the solution.`
        : `Initial analysis complete. Now working on implementation details.`;
    } else if (currentStep === totalSteps - 1) {
      message = task
        ? `Almost done with "${task.title}". Finalizing the implementation.`
        : `Almost finished with my current tasks. Finalizing the work.`;
    } else if (currentStep === totalSteps) {
      message = task
        ? `I've completed the task "${task.title}".`
        : `I've completed my assigned work.`;
        
      // Update task status if provided
      if (taskId) {
        await supabase
          .from('tasks')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', taskId);
      }
      
      // Clear the interval when done
      clearInterval(interval);
    } else {
      message = `Making progress on ${task ? `task "${task.title}"` : 'my assigned work'}. Current progress: ${progress}%`;
    }
    
    // Add a message to the chat
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: message,
        sender: agent.name,
        type: 'text'
      }]);
      
    // If this is the last step, create a code file to demonstrate work
    if (currentStep === totalSteps && agent.agent_type.toLowerCase() === 'frontend') {
      await supabase
        .from('code_files')
        .insert([{
          project_id: projectId,
          name: 'DemoComponent.tsx',
          path: '/src/components/DemoComponent.tsx',
          content: `import React from 'react';

const DemoComponent = () => {
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Demo Component</h2>
      <p className="text-gray-700">
        This is a demo component created by the ${agent.name}.
      </p>
      <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
        Click me
      </button>
    </div>
  );
};

export default DemoComponent;`,
          language: 'tsx',
          created_by: agent.name,
          last_modified_by: agent.name
        }]);
    }
    
  }, 10000); // Update every 10 seconds
  
  // Store the interval ID for cleanup
  return () => clearInterval(interval);
};
