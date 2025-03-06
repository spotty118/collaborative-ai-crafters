
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
    
    // Generate immediate response to client
    const response = new Response(
      JSON.stringify({ 
        success: true, 
        message: `CrewAI orchestration ${action} initiated for project ${projectId}`,
        project: projectData?.name || 'Unknown Project'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
    // Process orchestration asynchronously (don't await this)
    processOrchestration(projectId, projectData, agentsData, action).catch(error => {
      console.error('Error in asynchronous orchestration processing:', error);
    });
    
    return response;
    
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

/**
 * Process the orchestration asynchronously
 */
async function processOrchestration(projectId, projectData, agentsData, action) {
  console.log(`Starting asynchronous orchestration processing for project ${projectId}`);
  
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
      
      console.log(`Updated agent ${agent.id} (${agent.name}) to working status`);
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
    
    // Create initial tasks
    await createInitialTasks(projectId, agentsData);
    
    // Begin agent progress simulation
    simulateAgentProgress(projectId, agentsData).catch(error => {
      console.error('Error in agent progress simulation:', error);
    });
    
  } catch (error) {
    console.error('Error in asynchronous orchestration processing:', error);
    
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `Error initializing orchestration: ${error.message}`,
        sender: 'System',
        type: 'text'
      }]);
      
    // Reset project and agent status on error
    await supabase
      .from('projects')
      .update({ status: 'idle', progress: 0 })
      .eq('id', projectId);
      
    for (const agent of agentsData) {
      await supabase
        .from('agent_statuses')
        .update({ status: 'idle' })
        .eq('id', agent.id);
    }
  }
}

/**
 * Create the initial tasks for agents
 */
async function createInitialTasks(projectId, agentsData) {
  const taskTypes = [
    {
      title: 'System Architecture Planning',
      description: 'Define the overall system architecture and component structure',
      assigned_to: agentsData.find(a => a.agent_type === 'architect')?.id,
      status: 'pending'
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
    },
    {
      title: 'Test Plan Development',
      description: 'Create a comprehensive test plan for the application',
      assigned_to: agentsData.find(a => a.agent_type === 'testing')?.id,
      status: 'pending'
    },
    {
      title: 'CI/CD Pipeline Planning',
      description: 'Design the continuous integration and deployment pipeline',
      assigned_to: agentsData.find(a => a.agent_type === 'devops')?.id,
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
      
      console.log(`Created task: ${task.title} for agent: ${task.assigned_to}`);
    }
  }
  
  // Send a message confirming task creation
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: "I've created initial tasks for our team based on project requirements. Each agent now has specific tasks assigned to their specialty area. Let's begin working on these systematically.",
      sender: 'Architect Agent',
      type: 'text'
    }]);
}

/**
 * Simulate agent progress over time
 */
async function simulateAgentProgress(projectId, agentsData) {
  console.log(`Starting agent progress simulation for project ${projectId}`);
  
  try {
    // Add a delay to simulate initial work
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Update architect agent first
    const architectAgent = agentsData.find(a => a.agent_type === 'architect');
    if (architectAgent) {
      // Get architect's tasks
      const { data: architectTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', architectAgent.id)
        .eq('status', 'pending');
        
      if (architectTasks && architectTasks.length > 0) {
        // Update the first task to in_progress
        await supabase
          .from('tasks')
          .update({ status: 'in_progress' })
          .eq('id', architectTasks[0].id);
          
        // Send a message about starting the task
        await supabase
          .from('chat_messages')
          .insert([{
            project_id: projectId,
            content: `I'm starting work on the ${architectTasks[0].title}. I'll first analyze the project requirements and determine the best architecture approach for this project.`,
            sender: 'Architect Agent',
            type: 'text'
          }]);
          
        // Wait a bit to simulate work
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Update architect's task to completed
        await supabase
          .from('tasks')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          })
          .eq('id', architectTasks[0].id);
          
        // Send a message about completing the task
        await supabase
          .from('chat_messages')
          .insert([{
            project_id: projectId,
            content: `I've completed the system architecture planning. Based on the project requirements, I recommend a modular architecture with clear separation of concerns. The frontend will use component-based design, while the backend will implement a RESTful API structure.`,
            sender: 'Architect Agent',
            type: 'text'
          }]);
          
        // Update architect's progress
        await supabase
          .from('agent_statuses')
          .update({ progress: 30 })
          .eq('id', architectAgent.id);
      }
    }
    
    // Start frontend agent work next
    const frontendAgent = agentsData.find(a => a.agent_type === 'frontend');
    if (frontendAgent) {
      // Get frontend tasks
      const { data: frontendTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', frontendAgent.id)
        .eq('status', 'pending');
        
      if (frontendTasks && frontendTasks.length > 0) {
        // Update the first task to in_progress
        await supabase
          .from('tasks')
          .update({ status: 'in_progress' })
          .eq('id', frontendTasks[0].id);
          
        // Send a message about starting the task
        await supabase
          .from('chat_messages')
          .insert([{
            project_id: projectId,
            content: `I'll begin working on the frontend component design based on the architecture that the Architect Agent has proposed.`,
            sender: 'Frontend Agent',
            type: 'text'
          }]);
          
        // Wait a bit to simulate work
        await new Promise(resolve => setTimeout(resolve, 6000));
        
        // Update project progress
        await supabase
          .from('projects')
          .update({ progress: 25 })
          .eq('id', projectId);
      }
    }
    
    // Update backend agent status
    const backendAgent = agentsData.find(a => a.agent_type === 'backend');
    if (backendAgent) {
      await supabase
        .from('agent_statuses')
        .update({ progress: 15 })
        .eq('id', backendAgent.id);
        
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content: `I'm analyzing the database requirements for this project. I'll be working on the API design next.`,
          sender: 'Backend Agent',
          type: 'text'
        }]);
    }
  } catch (error) {
    console.error('Error in agent progress simulation:', error);
    
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `Error in agent simulation: ${error.message}`,
        sender: 'System',
        type: 'text'
      }]);
  }
}
