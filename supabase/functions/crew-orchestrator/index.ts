import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from '@supabase/supabase-js';

// Get environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || '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';

// Log environment variables for debugging
console.log('==== CREW ORCHESTRATOR ENVIRONMENT ====');
console.log('SUPABASE_URL:', SUPABASE_URL ? 'Set (starts with: ' + SUPABASE_URL.substring(0, 10) + '...)' : 'Not set');
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'Set (length: ' + SUPABASE_ANON_KEY.length + ')' : 'Not set');
console.log('OPENROUTER_API_KEY:', OPENROUTER_API_KEY ? 'Set (starts with: ' + OPENROUTER_API_KEY.substring(0, 8) + '...)' : 'Not set');

// Create Supabase client
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Response headers for CORS
const responseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// Function to handle HTTP requests
serve(async (req) => {
  console.log(`[${new Date().toISOString()}] Crew orchestrator received request`);
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: responseHeaders 
    });
  }
  
  // Simple ping endpoint for health checks
  if (req.method === 'POST') {
    try {
      const requestData = await req.json();
      
      // Log request data for debugging
      console.log('Request body:', JSON.stringify(requestData));
      
      if (requestData.action === 'ping') {
        return new Response(
          JSON.stringify({ success: true, message: 'Crew orchestrator is online' }),
          { headers: responseHeaders }
        );
      }
      
      return await handleCrewAction(requestData);
    } catch (error) {
      // Log and return the error
      console.error('Crew orchestrator error:', error);
      console.error('Error stack:', error.stack);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }),
        { status: 500, headers: responseHeaders }
      );
    }
  }
  
  return new Response(
    JSON.stringify({ 
      success: false, 
      message: 'Method not allowed' 
    }),
    { status: 405, headers: responseHeaders }
  );
});

// Handle different actions
async function handleCrewAction(requestData: any): Promise<Response> {
  console.log('Handling crew action:', requestData.action);
  
  if (!supabase) {
    console.error('Supabase client is not initialized.');
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Supabase client is not initialized. Check environment variables.' 
      }),
      { status: 500, headers: responseHeaders }
    );
  }
  
  const { action, projectId, agentId, taskId, updates } = requestData;

  // Handle initialize action - when a new project is created
  if (action === 'initialize') {
    console.log(`Initializing project ${projectId}`);
    
    try {
      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
        
      if (projectError) {
        console.error('Error fetching project:', projectError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Failed to fetch project: ${projectError.message}` 
          }),
          { status: 500, headers: responseHeaders }
        );
      }
      
      console.log(`Project data: ${JSON.stringify(projectData)}`);

      // Fetch agents associated with the project
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('*')
        .eq('project_id', projectId);
        
      if (agentsError) {
        console.error('Error fetching agents:', agentsError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Failed to fetch agents: ${agentsError.message}` 
          }),
          { status: 500, headers: responseHeaders }
        );
      }
      
      console.log(`Agents data: ${JSON.stringify(agentsData)}`);

      // Create a crew configuration based on project and agent details
      // Placeholder for crew creation logic
      console.log('Creating crew configuration...');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Project initialized successfully' 
        }),
        { headers: responseHeaders }
      );
    } catch (error) {
      console.error('Error initializing project:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { status: 500, headers: responseHeaders }
      );
    }
  }

  // Handle update action - when project details are updated
  if (action === 'update') {
    console.log(`Updating project ${projectId} with updates: ${JSON.stringify(updates)}`);
    
    try {
      // Update project details in Supabase
      const { error: updateError } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);
        
      if (updateError) {
        console.error('Error updating project:', updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Failed to update project: ${updateError.message}` 
          }),
          { status: 500, headers: responseHeaders }
        );
      }
      
      console.log('Project updated successfully');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Project updated successfully' 
        }),
        { headers: responseHeaders }
      );
    } catch (error) {
      console.error('Error updating project:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { status: 500, headers: responseHeaders }
      );
    }
  }

  // Handle completeTask action - when an agent completes a task
  if (action === 'completeTask') {
    console.log(`Completing task ${taskId} for project ${projectId}`);
    
    try {
      // Update task status in Supabase
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', taskId);
        
      if (updateError) {
        console.error('Error updating task:', updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Failed to update task: ${updateError.message}` 
          }),
          { status: 500, headers: responseHeaders }
        );
      }
      
      console.log('Task updated successfully');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Task completed successfully' 
        }),
        { headers: responseHeaders }
      );
    } catch (error) {
      console.error('Error completing task:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { status: 500, headers: responseHeaders }
      );
    }
  }

  // Handle start action - when user activates an agent
  if (action === 'start') {
    console.log(`Starting agent orchestration for ${agentId}`);
    
    try {
      // Validate that projectId and agentId are provided
      if (!projectId || !agentId) {
        console.error('Project ID and Agent ID must be provided.');
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Project ID and Agent ID must be provided' 
          }),
          { status: 400, headers: responseHeaders }
        );
      }
      
      // Get agent data
      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();
        
      if (agentError) {
        console.error('Error fetching agent:', agentError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Failed to fetch agent: ${agentError.message}` 
          }),
          { status: 500, headers: responseHeaders }
        );
      }
      
      console.log(`Agent data: ${JSON.stringify(agentData)}`);
      
      // Get project data
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
        
      if (projectError) {
        console.error('Error fetching project:', projectError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Failed to fetch project: ${projectError.message}` 
          }),
          { status: 500, headers: responseHeaders }
        );
      }
      
      console.log(`Project data: ${JSON.stringify(projectData)}`);
      
      // If a specific task was provided, get that task's details
      let taskData = null;
      if (taskId) {
        const { data: task, error: taskError } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .single();
          
        if (taskError) {
          console.error('Error fetching task:', taskError);
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: `Failed to fetch task: ${taskError.message}` 
            }),
            { status: 500, headers: responseHeaders }
          );
        }
        
        taskData = task;
        console.log(`Task data: ${JSON.stringify(taskData)}`);
      }

      // Update agent status to show it's now working
      const { error: updateError } = await supabase
        .from('agents')
        .update({ status: 'working' })
        .eq('id', agentId);
        
      if (updateError) {
        console.error('Error updating agent status:', updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Failed to update agent status: ${updateError.message}` 
          }),
          { status: 500, headers: responseHeaders }
        );
      }
      
      console.log('Agent status updated to working');

      // Add initial message from the agent to the chat
      const initialMessage = `I'm starting work on project ${projectData.name}.`;
      
      const { error: messageError } = await supabase
        .from('messages')
        .insert([{
          project_id: projectId,
          agent_id: agentId,
          content: initialMessage,
          sender: agentData.name,
          type: 'text'
        }]);
        
      if (messageError) {
        console.error('Error adding initial message:', messageError);
        // Non-critical error, continue anyway
      }
      
      console.log('Initial message added to chat');

      // Call OpenRouter directly to process the task
      if (taskId && OPENROUTER_API_KEY) {
        console.log(`Sending task to OpenRouter for processing: ${taskData?.title}`);
        
        try {
          // Prepare task prompt
          const prompt = `You are ${agentData.name}, an AI agent specialized in ${agentData.agent_type} work for a software development project.
          
          Project Context: ${projectData.name} - ${projectData.description}.
          
          Your current task: ${taskData?.title || 'No specific task'} - ${taskData?.description || 'No specific description'}.
          
          Instructions: ${projectData.requirements}.
          
          Please provide a detailed plan to accomplish this task, including specific steps and code implementations where necessary.`;
          
          console.log(`Sending prompt to OpenRouter (excerpt): ${prompt.substring(0, 100)}...`);
          
          // Send request to OpenRouter via our edge function
          const openRouterURL = SUPABASE_URL 
            ? `${SUPABASE_URL}/functions/v1/openrouter` 
            : 'https://igzuqirgmwgxfpbtpsdc.supabase.co/functions/v1/openrouter';
            
          console.log(`Calling OpenRouter edge function at URL: ${openRouterURL}`);
          
          const openRouterResponse = await fetch(openRouterURL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY || OPENROUTER_API_KEY}`,
              'apikey': SUPABASE_ANON_KEY || OPENROUTER_API_KEY,
            },
            body: JSON.stringify({
              prompt,
              agentType: agentData.agent_type,
              model: "anthropic/claude-3.7-sonnet:thinking",
              projectContext: {
                name: projectData.name,
                description: projectData.description,
                requirements: projectData.requirements,
                techStack: projectData.tech_stack,
                sourceType: projectData.source_type,
                sourceUrl: projectData.source_url,
                taskTitle: taskData?.title,
              }
            }),
          });

          console.log(`OpenRouter response status: ${openRouterResponse.status}`);
          
          const responseText = await openRouterResponse.text();
          console.log(`Raw response from OpenRouter (first 200 chars): ${responseText.substring(0, 200)}...`);

          if (!openRouterResponse.ok) {
            console.error('Error from OpenRouter:', responseText);
            throw new Error(`OpenRouter responded with status ${openRouterResponse.status}: ${responseText}`);
          }

          try {
            const responseData = JSON.parse(responseText);
            console.log('OpenRouter response parsed successfully');
            console.log('OpenRouter response received:', JSON.stringify(responseData).substring(0, 200) + '...');
            
            // Now we have the AI response, update the progress
            const { error: progressError } = await supabase
              .from('agents')
              .update({ progress: 50 })
              .eq('id', agentId);
              
            if (progressError) {
              console.error('Error updating agent progress:', progressError);
              // Non-critical error, continue anyway
            }
            
            console.log('Agent progress updated to 50%');

            // Add AI response to chat
            const { error: aiMessageError } = await supabase
              .from('messages')
              .insert([{
                project_id: projectId,
                agent_id: agentId,
                content: responseData.choices[0].message.content,
                sender: agentData.name,
                type: 'text'
              }]);
              
            if (aiMessageError) {
              console.error('Error adding AI message:', aiMessageError);
              // Non-critical error, continue anyway
            }
            
            console.log('AI message added to chat');

            return new Response(
              JSON.stringify({ 
                success: true, 
                message: 'Agent started and task processed successfully',
                data: responseData
              }),
              { headers: responseHeaders }
            );
          } catch (parseError) {
            console.error('Error parsing OpenRouter response:', parseError);
            throw new Error(`Failed to parse OpenRouter response: ${parseError.message}`);
          }

        } catch (openRouterError) {
          console.error('Error calling OpenRouter:', openRouterError);
          console.error('Error stack:', openRouterError.stack);
          
          // Add error message to chat
          const { error: errorMessageError } = await supabase
            .from('messages')
            .insert([{
              project_id: projectId,
              agent_id: agentId,
              content: `Error processing task: ${openRouterError.message}`,
              sender: agentData.name,
              type: 'error'
            }]);
            
          if (errorMessageError) {
            console.error('Error adding error message:', errorMessageError);
            // Non-critical error, continue anyway
          }
          
          console.log('Error message added to chat');

          return new Response(
            JSON.stringify({ 
              success: false, 
              message: `Error processing task: ${openRouterError.message}` 
            }),
            { status: 500, headers: responseHeaders }
          );
        }
      } else {
        // Log if we're not sending to OpenRouter
        if (!taskId) {
          console.log("No taskId provided, skipping OpenRouter call");
        }
        if (!OPENROUTER_API_KEY) {
          console.error("OPENROUTER_API_KEY not available, skipping OpenRouter call");
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Agent started successfully' 
        }),
        { headers: responseHeaders }
      );
    } catch (error) {
      console.error('Error starting agent orchestration:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { status: 500, headers: responseHeaders }
      );
    }
  }
  
  // Handle stop action - when user deactivates an agent
  if (action === 'stop') {
    console.log(`Stopping agent orchestration for ${agentId}`);
    
    try {
      // Validate that projectId and agentId are provided
      if (!projectId || !agentId) {
        console.error('Project ID and Agent ID must be provided.');
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Project ID and Agent ID must be provided' 
          }),
          { status: 400, headers: responseHeaders }
        );
      }
      
      // Update agent status to show it's now idle
      const { error: updateError } = await supabase
        .from('agents')
        .update({ status: 'idle' })
        .eq('id', agentId);
        
      if (updateError) {
        console.error('Error updating agent status:', updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Failed to update agent status: ${updateError.message}` 
          }),
          { status: 500, headers: responseHeaders }
        );
      }
      
      console.log('Agent status updated to idle');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Agent stopped successfully' 
        }),
        { headers: responseHeaders }
      );
    } catch (error) {
      console.error('Error stopping agent orchestration:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { status: 500, headers: responseHeaders }
      );
    }
  }
  
  // Handle update_progress action - when an agent updates its progress
  if (action === 'update_progress') {
    console.log(`Updating agent ${agentId} progress to ${requestData.progress}%`);
    
    try {
      // Validate that projectId, agentId, and progress are provided
      if (!projectId || !agentId || requestData.progress === undefined) {
        console.error('Project ID, Agent ID, and progress must be provided.');
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Project ID, Agent ID, and progress must be provided' 
          }),
          { status: 400, headers: responseHeaders }
        );
      }
      
      // Update agent progress in Supabase
      const { error: updateError } = await supabase
        .from('agents')
        .update({ progress: requestData.progress })
        .eq('id', agentId);
        
      if (updateError) {
        console.error('Error updating agent progress:', updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Failed to update agent progress: ${updateError.message}` 
          }),
          { status: 500, headers: responseHeaders }
        );
      }
      
      console.log(`Agent progress updated to ${requestData.progress}%`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Agent progress updated successfully' 
        }),
        { headers: responseHeaders }
      );
    } catch (error) {
      console.error('Error updating agent progress:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { status: 500, headers: responseHeaders }
      );
    }
  }
  
  // Handle complete_task action - when an agent completes a specific task
  if (action === 'complete_task') {
    console.log(`Completing task ${taskId} by agent ${agentId}`);
    
    try {
      // Validate that projectId, agentId, and taskId are provided
      if (!projectId || !agentId || !taskId) {
        console.error('Project ID, Agent ID, and Task ID must be provided.');
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Project ID, Agent ID, and Task ID must be provided' 
          }),
          { status: 400, headers: responseHeaders }
        );
      }
      
      // Update task status to completed in Supabase
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', taskId);
        
      if (updateError) {
        console.error('Error updating task status:', updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Failed to update task status: ${updateError.message}` 
          }),
          { status: 500, headers: responseHeaders }
        );
      }
      
      console.log('Task status updated to completed');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Task completed successfully' 
        }),
        { headers: responseHeaders }
      );
    } catch (error) {
      console.error('Error completing task:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { status: 500, headers: responseHeaders }
      );
    }
  }
  
  // Handle assign_task action - when a task is manually assigned to an agent
  if (action === 'assign_task') {
    console.log(`Manually assigning task ${taskId} to agent ${agentId} in project ${projectId}`);
    
    try {
      // Validate that projectId, agentId, and taskId are provided
      if (!projectId || !agentId || !taskId) {
        console.error('Project ID, Agent ID, and Task ID must be provided.');
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Project ID, Agent ID, and Task ID must be provided' 
          }),
          { status: 400, headers: responseHeaders }
        );
      }
      
      // Update the task in the database
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ assigned_to: agentId })
        .eq('id', taskId);
        
      if (updateError) {
        console.error('Error updating task assignment:', updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Failed to assign task to agent: ${updateError.message}` 
          }),
          { status: 500, headers: responseHeaders }
        );
      }
      
      console.log('Task assigned to agent successfully');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Task assigned to agent successfully' 
        }),
        { headers: responseHeaders }
      );
    } catch (error) {
      console.error('Error assigning task:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { status: 500, headers: responseHeaders }
      );
    }
  }
  
  return new Response(
    JSON.stringify({ 
      success: false, 
      message: 'Invalid action specified' 
    }),
    { status: 400, headers: responseHeaders }
  );
}
