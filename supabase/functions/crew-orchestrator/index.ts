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

// OpenRouter API key from environment
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

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
      // Get agent details
      const { data: agentData, error: agentFetchError } = await supabase
        .from('agent_statuses')
        .select('*')
        .eq('id', agentId)
        .single();

      if (agentFetchError) {
        throw new Error(`Failed to fetch agent details: ${agentFetchError.message}`);
      }

      // Get project details
      const { data: projectData, error: projectFetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectFetchError) {
        throw new Error(`Failed to fetch project details: ${projectFetchError.message}`);
      }

      // Get task details if taskId is provided
      let taskData = null;
      if (taskId) {
        const { data, error: taskError } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .single();

        if (taskError) {
          throw new Error(`Failed to fetch task details: ${taskError.message}`);
        }
        
        taskData = data;
        
        // Update task status
        const { error: updateTaskError } = await supabase
          .from('tasks')
          .update({ 
            status: 'in_progress',
            assigned_to: agentId, // Ensure task is assigned to this agent
            updated_at: new Date().toISOString() 
          })
          .eq('id', taskId);

        if (updateTaskError) {
          throw new Error(`Failed to update task status: ${updateTaskError.message}`);
        }
      }

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

      // Create chat message
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content: taskId 
            ? `I'm now working on the assigned task: "${taskData?.title || 'Unknown task'}"` 
            : `I'm now active and ready to work on tasks for this project.`,
          sender: agentData?.name || 'Agent',
          type: 'text'
        }]);

      // Call OpenRouter directly to process the task
      if (taskId && OPENROUTER_API_KEY) {
        console.log(`Sending task to OpenRouter for processing: ${taskData?.title}`);
        
        try {
          // Prepare prompt for the agent based on task
          const prompt = `
You are the ${agentData.name}, a ${agentData.agent_type} agent working on the project: ${projectData.name}.

TASK DETAILS:
Title: ${taskData.title}
Description: ${taskData.description || 'No detailed description provided'}
Priority: ${taskData.priority || 'medium'}

PROJECT CONTEXT:
${projectData.description || 'No detailed description provided'}
${projectData.requirements ? `Requirements: ${projectData.requirements}` : ''}
${projectData.tech_stack ? `Technology Stack: ${projectData.tech_stack.join(', ')}` : ''}

YOUR OBJECTIVE:
Please analyze this task and create a detailed implementation for it. Focus on your role as a ${agentData.agent_type} agent.

If your implementation requires creating code, please format it as follows:
\`\`\`filepath:/path/to/file.ext
// code goes here
\`\`\`

If you identify additional tasks that need to be done, list them in this format:
TASK: [Task name]
ASSIGNED TO: [Agent type, e.g. Frontend]
DESCRIPTION: [Detailed description]
PRIORITY: [high/medium/low]
`;

          console.log(`Sending prompt to OpenRouter (excerpt): ${prompt.substring(0, 100)}...`);
          
          // Send request to OpenRouter via our edge function
          const openRouterResponse = await fetch(`${supabaseUrl}/functions/v1/openrouter`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`
            },
            body: JSON.stringify({
              prompt,
              agentType: agentData.agent_type,
              model: "google/gemini-2.0-flash-thinking-exp:free",
              projectContext: {
                name: projectData.name,
                description: projectData.description,
                sourceUrl: projectData.sourceUrl,
                sourceType: projectData.sourceType,
                id: projectData.id,
                created_at: projectData.created_at
              }
            }),
          });

          if (!openRouterResponse.ok) {
            const errorResponse = await openRouterResponse.text();
            console.error('Error from OpenRouter:', errorResponse);
            throw new Error(`OpenRouter responded with status ${openRouterResponse.status}: ${errorResponse}`);
          }

          const responseData = await openRouterResponse.json();
          console.log('OpenRouter response received:', JSON.stringify(responseData).substring(0, 200) + '...');
          
          // Now we have the AI response, update the progress
          await supabase
            .from('agent_statuses')
            .update({ 
              progress: 30, // Increase progress after getting AI response
              updated_at: new Date().toISOString() 
            })
            .eq('id', agentId);
            
          console.log('Agent progress updated to 30% after receiving OpenRouter response');

          // Add the AI's response as a message
          const aiContent = responseData.choices[0].message.content;
          await supabase
            .from('chat_messages')
            .insert([{
              project_id: projectId,
              content: `Task analysis complete. I'll now implement: "${taskData.title}"`,
              sender: agentData.name,
              type: 'text'
            }]);
            
          // Add the detailed response as a separate message
          await supabase
            .from('chat_messages')
            .insert([{
              project_id: projectId,
              content: aiContent,
              sender: agentData.name,
              type: 'text'
            }]);
            
          console.log('Added AI response as chat messages');

        } catch (openRouterError) {
          console.error('Error calling OpenRouter:', openRouterError);
          
          // Add error message to chat
          await supabase
            .from('chat_messages')
            .insert([{
              project_id: projectId,
              content: `I encountered an error while working on the task: ${openRouterError.message}`,
              sender: agentData.name,
              type: 'error'
            }]);
            
          // Continue execution despite OpenRouter error
          console.log('Added error message and continuing execution');
        }
      }

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
