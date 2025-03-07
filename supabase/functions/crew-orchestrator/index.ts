
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.33.1';

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Create a Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders 
    });
  }

  // Add CORS headers to all responses
  const responseHeaders = { 
    ...corsHeaders, 
    'Content-Type': 'application/json' 
  };

  try {
    // Parse the request body
    const reqBody = await req.json();
    const { action, projectId, agentId, taskId, verbose } = reqBody;

    // Log the request for debugging
    console.log(`Crew orchestrator received request: ${JSON.stringify(reqBody)}`);

    // Handle ping action for connectivity tests
    if (action === 'ping') {
      return new Response(
        JSON.stringify({ success: true, message: 'Crew orchestrator is online' }),
        { headers: responseHeaders }
      );
    }

    // Handle different actions
    if (action === 'start') {
      // Update agent status to working
      const { error: agentError } = await supabase
        .from('agent_statuses')
        .update({ 
          status: 'working',
          progress: 10,
          updated_at: new Date().toISOString() 
        })
        .eq('id', agentId);

      if (agentError) {
        throw new Error(`Failed to update agent status: ${agentError.message}`);
      }

      // If taskId is provided, update task status
      if (taskId) {
        const { error: taskError } = await supabase
          .from('tasks')
          .update({ 
            status: 'in_progress',
            assigned_to: agentId, // Ensure task is assigned to this agent
            updated_at: new Date().toISOString() 
          })
          .eq('id', taskId);

        if (taskError) {
          throw new Error(`Failed to update task status: ${taskError.message}`);
        }
      }

      // Get agent name for notification
      const { data: agentData, error: agentFetchError } = await supabase
        .from('agent_statuses')
        .select('name')
        .eq('id', agentId)
        .single();

      if (agentFetchError) {
        throw new Error(`Failed to fetch agent details: ${agentFetchError.message}`);
      }

      // Create chat message
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content: taskId 
            ? `I'm now working on the assigned task.` 
            : `I'm now active and ready to work on tasks for this project.`,
          sender: agentData?.name || 'Agent',
          type: 'text'
        }]);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Agent orchestration started successfully`,
          data: { agentId, status: 'working', taskId }
        }),
        { headers: responseHeaders }
      );
    } 
    else if (action === 'stop') {
      // Update agent status to idle
      const { error: agentError } = await supabase
        .from('agent_statuses')
        .update({ 
          status: 'idle',
          progress: 0,
          updated_at: new Date().toISOString() 
        })
        .eq('id', agentId);

      if (agentError) {
        throw new Error(`Failed to update agent status: ${agentError.message}`);
      }

      // Update any in-progress tasks assigned to this agent
      const { error: tasksError } = await supabase
        .from('tasks')
        .update({ 
          status: 'pending',
          updated_at: new Date().toISOString() 
        })
        .eq('assigned_to', agentId)
        .eq('status', 'in_progress');

      if (tasksError) {
        throw new Error(`Failed to update tasks: ${tasksError.message}`);
      }

      // Get agent name for notification
      const { data: agentData, error: agentFetchError } = await supabase
        .from('agent_statuses')
        .select('name')
        .eq('id', agentId)
        .single();

      if (agentFetchError) {
        throw new Error(`Failed to fetch agent details: ${agentFetchError.message}`);
      }

      // Create chat message
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content: `I've paused my work. You can resume it anytime.`,
          sender: agentData?.name || 'Agent',
          type: 'text'
        }]);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Agent orchestration stopped successfully`,
          data: { agentId, status: 'idle' }
        }),
        { headers: responseHeaders }
      );
    }
    else if (action === 'update_progress') {
      const { progress, status = 'working' } = reqBody;
      
      // Update agent status with progress
      const { error: agentError } = await supabase
        .from('agent_statuses')
        .update({ 
          status,
          progress,
          updated_at: new Date().toISOString() 
        })
        .eq('id', agentId);

      if (agentError) {
        throw new Error(`Failed to update agent progress: ${agentError.message}`);
      }

      // Get agent name for notification
      const { data: agentData, error: agentFetchError } = await supabase
        .from('agent_statuses')
        .select('name')
        .eq('id', agentId)
        .single();

      if (agentFetchError) {
        throw new Error(`Failed to fetch agent details: ${agentFetchError.message}`);
      }

      // Only send chat messages for significant progress
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

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Agent progress updated successfully`,
          data: { agentId, progress, status }
        }),
        { headers: responseHeaders }
      );
    }
    else if (action === 'complete_task') {
      // Update task status to completed
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        })
        .eq('id', taskId);

      if (taskError) {
        throw new Error(`Failed to complete task: ${taskError.message}`);
      }

      // Get agent name for notification
      const { data: agentData, error: agentFetchError } = await supabase
        .from('agent_statuses')
        .select('name')
        .eq('id', agentId)
        .single();

      if (agentFetchError) {
        throw new Error(`Failed to fetch agent details: ${agentFetchError.message}`);
      }

      // Get task details
      const { data: taskData, error: taskFetchError } = await supabase
        .from('tasks')
        .select('title')
        .eq('id', taskId)
        .single();

      if (taskFetchError) {
        throw new Error(`Failed to fetch task details: ${taskFetchError.message}`);
      }

      // Create chat message
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content: `I have completed the task: "${taskData?.title || 'Unknown task'}"`,
          sender: agentData?.name || 'Agent',
          type: 'text'
        }]);

      // Update agent status to idle
      await supabase
        .from('agent_statuses')
        .update({ 
          status: 'idle',
          progress: 100,
          updated_at: new Date().toISOString() 
        })
        .eq('id', agentId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Task completed successfully`,
          data: { agentId, taskId, status: 'completed' }
        }),
        { headers: responseHeaders }
      );
    }
    else if (action === 'assign_task') {
      // Handle task assignment
      // 1. Update the task to be assigned to the agent
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ 
          assigned_to: agentId,
          status: 'pending', // Set to pending initially
          updated_at: new Date().toISOString() 
        })
        .eq('id', taskId);

      if (taskError) {
        throw new Error(`Failed to assign task: ${taskError.message}`);
      }

      // 2. Get agent and task details for the notification
      const { data: agentData, error: agentFetchError } = await supabase
        .from('agent_statuses')
        .select('name')
        .eq('id', agentId)
        .single();

      if (agentFetchError) {
        throw new Error(`Failed to fetch agent details: ${agentFetchError.message}`);
      }

      const { data: taskData, error: taskFetchError } = await supabase
        .from('tasks')
        .select('title')
        .eq('id', taskId)
        .single();

      if (taskFetchError) {
        throw new Error(`Failed to fetch task details: ${taskFetchError.message}`);
      }

      // 3. Create a chat message about the assignment
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content: `I've been assigned to work on: "${taskData?.title || 'Unknown task'}"`,
          sender: agentData?.name || 'Agent',
          type: 'text'
        }]);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Task assigned successfully`,
          data: { agentId, taskId, taskTitle: taskData?.title }
        }),
        { headers: responseHeaders }
      );
    }
    else if (action === 'get_messages') {
      // For this version, we'll just return an empty array
      // In a future version, we would implement an actual message system
      return new Response(
        JSON.stringify({ 
          success: true, 
          messages: [] 
        }),
        { headers: responseHeaders }
      );
    }
    else {
      // Unknown action
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Unknown action: ${action}` 
        }),
        { status: 400, headers: responseHeaders }
      );
    }
  } catch (error) {
    // Log and return the error
    console.error('Crew orchestrator error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: responseHeaders }
    );
  }
});
