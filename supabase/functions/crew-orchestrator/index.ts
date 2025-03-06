
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabase-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get necessary environment variables
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Add request logging
  console.log('CrewAI Orchestrator function received request:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });
  
  try {
    // Log the raw request body for debugging
    const rawBody = await req.text();
    console.log('Request body:', rawBody);
    
    // Parse body again after reading text
    const { projectId, action = 'start' } = JSON.parse(rawBody);
    
    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'Missing projectId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing ${action} request for project ${projectId}`);
    
    // Fetch project to send as context
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
      
    if (projectError) {
      console.error('Error fetching project:', projectError);
      return new Response(
        JSON.stringify({ error: `Failed to fetch project: ${projectError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch agents
    const { data: agentsData, error: agentsError } = await supabase
      .from('agent_statuses')
      .select('*')
      .eq('project_id', projectId);
      
    if (agentsError) {
      console.error('Error fetching agents:', agentsError);
      return new Response(
        JSON.stringify({ error: `Failed to fetch agents: ${agentsError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create initialization message
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `CrewAI orchestration ${action === 'start' ? 'started' : 'updated'} for project: ${projectData.name}`,
        sender: 'System',
        type: 'text'
      }]);
    
    // Process this asynchronously to not block the response
    setTimeout(async () => {
      try {
        // Update project status
        await supabase
          .from('projects')
          .update({ status: 'in_progress', progress: 10 })
          .eq('id', projectId);
          
        // Update agents to 'working' status
        for (const agent of agentsData) {
          await supabase
            .from('agent_statuses')
            .update({ status: 'working' })
            .eq('id', agent.id);
        }
        
        // Send a message that orchestration is initializing
        await supabase
          .from('chat_messages')
          .insert([{
            project_id: projectId,
            content: "Initializing AI agent team with CrewAI framework. Agents will work through tasks in sequence and communicate their progress.",
            sender: 'Architect Agent',
            type: 'text'
          }]);
        
        console.log('CrewAI orchestration initialized successfully');
        
        // In a full implementation, the actual CrewAI execution would happen here
        // For now, we'll simulate the process with messages and status updates
        
        // Create initial tasks
        const taskTypes = [
          {
            title: 'System Architecture Planning',
            description: 'Define the overall system architecture and component structure',
            assigned_to: agentsData.find(a => a.agent_type === 'architect')?.id,
            status: 'in_progress'
          },
          {
            title: 'Frontend Component Design',
            description: 'Create UI component hierarchy and design system',
            assigned_to: agentsData.find(a => a.agent_type === 'frontend')?.id,
            status: 'pending'
          },
          {
            title: 'Backend API Planning',
            description: 'Plan API endpoints and database schema',
            assigned_to: agentsData.find(a => a.agent_type === 'backend')?.id,
            status: 'pending'
          }
        ];
        
        for (const task of taskTypes) {
          if (task.assigned_to) {
            await supabase
              .from('tasks')
              .insert([{
                project_id: projectId,
                title: task.title,
                description: task.description,
                assigned_to: task.assigned_to,
                status: task.status,
                priority: 'high'
              }]);
          }
        }
        
      } catch (asyncError) {
        console.error('Error in asynchronous CrewAI processing:', asyncError);
        
        await supabase
          .from('chat_messages')
          .insert([{
            project_id: projectId,
            content: `Error initializing orchestration: ${asyncError.message}`,
            sender: 'System',
            type: 'text'
          }]);
      }
    }, 100);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `CrewAI orchestration ${action} initiated for project ${projectId}`,
        project: projectData.name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in CrewAI Orchestrator function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: `Failed to process request: ${error.message}` 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
