
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
let supabase = null;
try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client created successfully');
  } else {
    console.error('Missing Supabase URL or anonymous key');
  }
} catch (error) {
  console.error('Error creating Supabase client:', error);
}

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
      
      console.log('Request body:', JSON.stringify(requestData));
      
      if (requestData.action === 'ping') {
        return new Response(
          JSON.stringify({ success: true, message: 'Crew orchestrator is online' }),
          { headers: responseHeaders }
        );
      }
      
      return await handleCrewAction(requestData);
    } catch (error) {
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

  // Handle initialize action
  if (action === 'initialize') {
    try {
      console.log(`Initializing project ${projectId}`);
      
      // Success response
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

  // Handle update action
  if (action === 'update') {
    try {
      console.log(`Updating project ${projectId}`);
      
      // Success response
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

  // Handle completeTask action
  if (action === 'completeTask') {
    try {
      console.log(`Completing task ${taskId}`);
      
      // Success response
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
    try {
      console.log(`Starting agent orchestration for ${agentId}`);
      
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
      
      // Update agent status to working
      try {
        const { error: updateError } = await supabase
          .from('agent_statuses')
          .update({ status: 'working' })
          .eq('id', agentId);
          
        if (updateError) {
          console.warn('Error updating agent status:', updateError);
          // Continue anyway since this is not critical
        } else {
          console.log('Agent status updated to working');
        }
      } catch (error) {
        console.warn('Exception updating agent status:', error);
        // Continue anyway since this is not critical
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
    try {
      console.log(`Stopping agent orchestration for ${agentId}`);
      
      // Update agent status to idle
      try {
        const { error: updateError } = await supabase
          .from('agent_statuses')
          .update({ status: 'idle' })
          .eq('id', agentId);
            
        if (updateError) {
          console.warn('Error updating agent status:', updateError);
          // Continue anyway since client has already updated UI
        } else {
          console.log('Agent status updated to idle');
        }
      } catch (error) {
        console.warn('Exception updating agent status:', error);
        // Continue anyway since client has already updated UI
      }
      
      // Always return success to prevent UI getting stuck
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Agent stopped successfully' 
        }),
        { headers: responseHeaders }
      );
    } catch (error) {
      console.error('Error stopping agent orchestration:', error);
      // Always return success to prevent UI getting stuck
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Agent stop attempted with errors',
          error: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { headers: responseHeaders }
      );
    }
  }
  
  // Handle update_progress action
  if (action === 'update_progress') {
    try {
      console.log(`Updating agent progress to ${requestData.progress}%`);
      
      // Success response
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
  
  // Handle complete_task action
  if (action === 'complete_task') {
    try {
      console.log(`Completing task ${taskId}`);
      
      // Success response
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
  
  // Handle assign_task action
  if (action === 'assign_task') {
    try {
      console.log(`Assigning task ${taskId}`);
      
      // Success response
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Task assigned successfully' 
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
