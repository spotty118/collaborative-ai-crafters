
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
    const { projectId, agentId, taskId, action = 'start' } = JSON.parse(rawBody);
    
    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'Missing projectId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing ${action} request for project ${projectId}, agent ${agentId || 'all'}`);
    
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
    
    // Fetch agent if agentId is provided
    let agentData = null;
    if (agentId) {
      const { data, error } = await supabase
        .from('agent_statuses')
        .select('*')
        .eq('id', agentId)
        .single();
        
      if (error) {
        console.error('Error fetching agent:', error);
        return new Response(
          JSON.stringify({ error: `Failed to fetch agent: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      agentData = data;
    }
    
    // Fetch tasks for the agent if specified
    let tasksData = [];
    if (agentId) {
      const query = supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .eq('assigned_to', agentId);
        
      if (taskId) {
        query.eq('id', taskId);
      } else {
        query.in('status', ['pending', 'in_progress']);
      }
      
      const { data, error } = await query;
        
      if (error) {
        console.error('Error fetching tasks:', error);
        return new Response(
          JSON.stringify({ error: `Failed to fetch tasks: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      tasksData = data || [];
    }
    
    // Create initialization message
    if (action === 'start') {
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content: agentId 
            ? `Starting ${agentData?.name || 'Agent'} for project: ${projectData.name}`
            : `CrewAI orchestration started for project: ${projectData.name}`,
          sender: agentId ? agentData?.name : 'System',
          type: 'text'
        }]);
    } else if (action === 'stop') {
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content: agentId 
            ? `Stopping ${agentData?.name || 'Agent'} for project: ${projectData.name}`
            : `CrewAI orchestration stopped for project: ${projectData.name}`,
          sender: agentId ? agentData?.name : 'System',
          type: 'text'
        }]);
    }
    
    // Generate immediate response to client
    const response = new Response(
      JSON.stringify({ 
        success: true, 
        message: `CrewAI orchestration ${action} initiated for ${agentId ? 'agent' : 'project'} ${agentId || projectId}`,
        project: projectData?.name || 'Unknown Project',
        agent: agentData?.name || null,
        tasks: tasksData?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
    // Process orchestration asynchronously (don't await this)
    processOrchestration(projectId, projectData, agentId, agentData, tasksData, action).catch(error => {
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
async function processOrchestration(projectId, projectData, agentId, agentData, tasksData, action) {
  console.log(`Starting asynchronous orchestration processing for project ${projectId}`);
  
  try {
    if (action === 'start') {
      if (agentId) {
        // Single agent workflow
        await processAgentWorkflow(projectId, agentId, agentData, tasksData);
      } else {
        // Full project workflow
        await processProjectWorkflow(projectId, projectData);
      }
    } else if (action === 'stop') {
      if (agentId) {
        // Stop single agent
        await stopAgent(projectId, agentId);
      } else {
        // Stop all agents in the project
        await stopProject(projectId);
      }
    }
  } catch (error) {
    console.error('Error in asynchronous orchestration processing:', error);
    
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `Error in orchestration: ${error.message}`,
        sender: 'System',
        type: 'text'
      }]);
      
    // Reset agent status on error if agentId provided
    if (agentId) {
      await supabase
        .from('agent_statuses')
        .update({ status: 'idle', progress: 0 })
        .eq('id', agentId);
    }
  }
}

/**
 * Stop all agents in a project
 */
async function stopProject(projectId) {
  // Update project status
  await supabase
    .from('projects')
    .update({ status: 'idle' })
    .eq('id', projectId);
    
  // Update all agents in the project to idle status
  await supabase
    .from('agent_statuses')
    .update({ status: 'idle' })
    .eq('project_id', projectId);
    
  console.log(`Stopped all agents for project ${projectId}`);
}

/**
 * Stop a specific agent
 */
async function stopAgent(projectId, agentId) {
  // Update the agent to idle status
  await supabase
    .from('agent_statuses')
    .update({ status: 'idle' })
    .eq('id', agentId);
    
  // Update any in-progress tasks for this agent to pending
  await supabase
    .from('tasks')
    .update({ status: 'pending' })
    .eq('assigned_to', agentId)
    .eq('status', 'in_progress');
    
  console.log(`Stopped agent ${agentId} for project ${projectId}`);
}

/**
 * Process workflow for a single agent
 */
async function processAgentWorkflow(projectId, agentId, agentData, tasksData) {
  console.log(`Processing workflow for agent ${agentId} with ${tasksData.length} tasks`);
  
  // If no tasks, create a default task for the agent
  if (tasksData.length === 0) {
    // Create a default task based on agent type
    const taskTitle = getDefaultTaskTitle(agentData.agent_type);
    const taskDesc = getDefaultTaskDescription(agentData.agent_type);
    
    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert([{
        project_id: projectId,
        title: taskTitle,
        description: taskDesc,
        assigned_to: agentId,
        status: 'pending',
        priority: 'high'
      }])
      .select()
      .single();
      
    if (error) {
      console.error('Error creating default task:', error);
      throw new Error(`Failed to create default task: ${error.message}`);
    }
    
    tasksData = [newTask];
    
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `I've created a new task: ${taskTitle}`,
        sender: agentData.name,
        type: 'text'
      }]);
  }
  
  // Update agent status to working
  await supabase
    .from('agent_statuses')
    .update({ status: 'working', progress: 10 })
    .eq('id', agentId);
    
  // Process each task in sequence
  for (const task of tasksData) {
    await processTask(projectId, agentId, agentData, task);
  }
  
  // Final update to agent
  await supabase
    .from('agent_statuses')
    .update({ status: 'completed', progress: 100 })
    .eq('id', agentId);
    
  // Add completion message
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: `I've completed all assigned tasks for this project.`,
      sender: agentData.name,
      type: 'text'
    }]);
}

/**
 * Process a specific task
 */
async function processTask(projectId, agentId, agentData, task) {
  console.log(`Processing task ${task.id}: ${task.title}`);
  
  // Update task status to in_progress
  await supabase
    .from('tasks')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', task.id);
    
  // Send a message about starting the task
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: `I'm working on task: ${task.title}. ${task.description}`,
      sender: agentData.name,
      type: 'text'
    }]);
    
  // Update agent progress to show we're working on the task
  await supabase
    .from('agent_statuses')
    .update({ progress: 30 })
    .eq('id', agentId);
    
  // Simulate work with a delay
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Mid-progress update
  await supabase
    .from('agent_statuses')
    .update({ progress: 60 })
    .eq('id', agentId);
    
  // Add a progress message
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: getProgressMessage(agentData.agent_type, task.title),
      sender: agentData.name,
      type: 'text'
    }]);
    
  // Simulate more work with a delay
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Complete the task
  await supabase
    .from('tasks')
    .update({ 
      status: 'completed', 
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    })
    .eq('id', task.id);
    
  // Send a message about completing the task
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: getCompletionMessage(agentData.agent_type, task.title),
      sender: agentData.name,
      type: 'text'
    }]);
    
  // Create a follow-up task if appropriate (for a real workflow)
  const followUpTask = getFollowUpTask(projectId, task, agentData.agent_type);
  if (followUpTask) {
    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert([followUpTask])
      .select()
      .single();
      
    if (!error && newTask) {
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content: `I've created a follow-up task: ${followUpTask.title}`,
          sender: agentData.name,
          type: 'text'
        }]);
    }
  }
}

/**
 * Process workflow for an entire project (multiple agents)
 */
async function processProjectWorkflow(projectId, projectData) {
  // Update project status
  await supabase
    .from('projects')
    .update({ status: 'in_progress', progress: 10 })
    .eq('id', projectId);
    
  // Fetch all agents for the project
  const { data: agents, error } = await supabase
    .from('agent_statuses')
    .select('*')
    .eq('project_id', projectId);
    
  if (error) {
    console.error('Error fetching agents:', error);
    throw new Error(`Failed to fetch agents: ${error.message}`);
  }
  
  // Start with the architect agent
  const architectAgent = agents.find(a => a.agent_type === 'architect');
  if (architectAgent) {
    // Update architect to working status
    await supabase
      .from('agent_statuses')
      .update({ status: 'working', progress: 20 })
      .eq('id', architectAgent.id);
      
    // Fetch or create tasks for the architect agent
    const { data: architectTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('assigned_to', architectAgent.id);
      
    if (tasksError) {
      console.error('Error fetching architect tasks:', tasksError);
      throw new Error(`Failed to fetch architect tasks: ${tasksError.message}`);
    }
    
    let tasks = architectTasks || [];
    
    // If no tasks, create default ones
    if (tasks.length === 0) {
      await createInitialTasks(projectId, agents);
      
      // Fetch tasks again
      const { data: newTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .eq('assigned_to', architectAgent.id);
        
      tasks = newTasks || [];
    }
    
    // Process architect tasks
    for (const task of tasks) {
      await processTask(projectId, architectAgent.id, architectAgent, task);
    }
  }
  
  // Update project progress
  await supabase
    .from('projects')
    .update({ progress: 50 })
    .eq('id', projectId);
}

/**
 * Create initial tasks for agents
 */
async function createInitialTasks(projectId, agentsData) {
  const taskTypes = [
    {
      title: 'System Architecture Planning',
      description: 'Define the overall system architecture and component structure',
      agent_type: 'architect',
      status: 'pending'
    },
    {
      title: 'Frontend Component Design',
      description: 'Create UI component hierarchy and design system',
      agent_type: 'frontend',
      status: 'pending'
    },
    {
      title: 'Backend API Planning',
      description: 'Plan API endpoints and database schema',
      agent_type: 'backend',
      status: 'pending'
    },
    {
      title: 'Test Plan Development',
      description: 'Create a comprehensive test plan for the application',
      agent_type: 'testing',
      status: 'pending'
    },
    {
      title: 'CI/CD Pipeline Planning',
      description: 'Design the continuous integration and deployment pipeline',
      agent_type: 'devops',
      status: 'pending'
    }
  ];
  
  for (const taskType of taskTypes) {
    const agent = agentsData.find(a => a.agent_type === taskType.agent_type);
    if (agent) {
      await supabase
        .from('tasks')
        .insert([{
          project_id: projectId,
          title: taskType.title,
          description: taskType.description,
          assigned_to: agent.id,
          status: taskType.status,
          priority: 'high'
        }]);
      
      console.log(`Created task: ${taskType.title} for agent: ${agent.id}`);
    }
  }
  
  // Send a message confirming task creation
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: "I've created initial tasks for our team based on project requirements. Each agent now has specific tasks assigned to their specialty area.",
      sender: 'Architect Agent',
      type: 'text'
    }]);
}

// Utility functions

function getDefaultTaskTitle(agentType) {
  switch (agentType) {
    case 'architect':
      return 'System Architecture Design';
    case 'frontend':
      return 'UI Component Implementation';
    case 'backend':
      return 'API Implementation';
    case 'testing':
      return 'Test Suite Creation';
    case 'devops':
      return 'CI/CD Pipeline Setup';
    default:
      return 'Project Task';
  }
}

function getDefaultTaskDescription(agentType) {
  switch (agentType) {
    case 'architect':
      return 'Design the overall system architecture including component structure and interactions.';
    case 'frontend':
      return 'Implement key UI components based on the design system.';
    case 'backend':
      return 'Develop core API endpoints and database models.';
    case 'testing':
      return 'Create a comprehensive testing strategy and implement test cases.';
    case 'devops':
      return 'Configure deployment pipelines and infrastructure setup.';
    default:
      return 'Complete assigned task for the project.';
  }
}

function getProgressMessage(agentType, taskTitle) {
  switch (agentType) {
    case 'architect':
      return `I'm making good progress on the architecture design. I've defined the core components and their interactions.`;
    case 'frontend':
      return `The UI implementation is progressing well. I've completed the basic component structure and working on the interactivity.`;
    case 'backend':
      return `I've defined the data models and started implementing the core API endpoints.`;
    case 'testing':
      return `The test plan is taking shape. I've outlined the key test scenarios and started writing test cases.`;
    case 'devops':
      return `I'm configuring the deployment pipeline and setting up the required infrastructure.`;
    default:
      return `Making good progress on ${taskTitle}. Continuing with the implementation.`;
  }
}

function getCompletionMessage(agentType, taskTitle) {
  switch (agentType) {
    case 'architect':
      return `I've completed the architecture design. The system will use a microservices approach with clear separations of concerns between frontend and backend components.`;
    case 'frontend':
      return `I've completed the UI implementation. The components are responsive and follow the design system guidelines.`;
    case 'backend':
      return `The API implementation is complete. All endpoints are working as expected and properly documented.`;
    case 'testing':
      return `The test suite is ready. It includes unit tests, integration tests, and end-to-end tests to ensure code quality.`;
    case 'devops':
      return `The CI/CD pipeline is set up and ready for use. It includes automated testing, building, and deployment steps.`;
    default:
      return `I've completed the task: ${taskTitle}. All requirements have been met and the deliverables are ready.`;
  }
}

function getFollowUpTask(projectId, completedTask, agentType) {
  // Only create follow-up tasks for certain agent types or completed tasks
  if (agentType === 'architect' && completedTask.title.includes('Architecture')) {
    return {
      project_id: projectId,
      title: 'Component Interaction Design',
      description: 'Design how components will interact and communicate with each other in the system',
      assigned_to: completedTask.assigned_to,
      status: 'pending',
      priority: 'high'
    };
  }
  
  if (agentType === 'frontend' && completedTask.title.includes('Component Design')) {
    return {
      project_id: projectId,
      title: 'Frontend Component Implementation',
      description: 'Implement the designed UI components using the project frontend framework',
      assigned_to: completedTask.assigned_to,
      status: 'pending',
      priority: 'high'
    };
  }
  
  // For other cases, don't create follow-up tasks
  return null;
}
