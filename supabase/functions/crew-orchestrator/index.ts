
// Import necessary dependencies
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabase-client.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

// Define proper CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Get necessary environment variables
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

// Define types for agent collaboration
interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  projectId: string;
  content: string;
  type: 'task' | 'response' | 'update' | 'notification';
  status: 'pending' | 'delivered' | 'processed';
  metadata?: Record<string, any>;
  created_at?: string;
}

interface AgentState {
  id: string;
  name: string;
  type: string;
  projectId: string;
  status: 'idle' | 'thinking' | 'working' | 'waiting';
  currentTask?: string;
  progress: number;
  lastActivity: number;
  contextMemory: Array<{role: string, content: string}>;
}

const agentStates = new Map<string, AgentState>();
const messageQueue = new Map<string, AgentMessage[]>();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, // No content for preflight
      headers: corsHeaders 
    });
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
    const { 
      projectId, 
      agentId, 
      taskId, 
      action = 'start', 
      agents, 
      projectContext,
      messageData,
      autostart = false, 
      verbose = true 
    } = JSON.parse(rawBody);
    
    if (!projectId && action !== 'get_messages') {
      return new Response(
        JSON.stringify({ error: 'Missing projectId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing ${action} request for project ${projectId}, agent ${agentId || 'all'}, verbose=${verbose}`);
    
    // Handle different action types
    let responseData = {};
    
    switch (action) {
      case 'start':
        responseData = await handleStartAction(projectId, agentId, taskId, verbose);
        break;
        
      case 'stop':
        responseData = await handleStopAction(projectId, agentId);
        break;
        
      case 'team_collaborate':
        responseData = await handleTeamCollaboration(projectId, agents, projectContext, autostart, verbose);
        break;
        
      case 'send_message':
        if (!messageData) {
          throw new Error('Missing messageData for send_message action');
        }
        responseData = await handleSendMessage(projectId, messageData);
        break;
        
      case 'update_progress':
        if (!agentId || messageData?.progress === undefined) {
          throw new Error('Missing agentId or progress for update_progress action');
        }
        responseData = await handleUpdateProgress(projectId, agentId, messageData.progress);
        break;
        
      case 'get_messages':
        responseData = await handleGetMessages(projectId, agentId);
        break;
        
      case 'process_task':
        if (!taskId) {
          throw new Error('Missing taskId for process_task action');
        }
        responseData = await handleProcessTask(projectId, agentId, taskId, verbose);
        break;
        
      case 'get_agent_state':
        responseData = await handleGetAgentState(projectId, agentId);
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    // Return success response with proper CORS headers
    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error in CrewAI Orchestrator function:', error);
    
    // Return error response with proper CORS headers
    return new Response(
      JSON.stringify({ 
        error: `Failed to process request: ${error.message}`,
        details: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * Handle start action to initialize agent(s)
 */
async function handleStartAction(projectId: string, agentId?: string, taskId?: string, verbose = false) {
  console.log(`Starting agent(s) for project ${projectId}`);
  
  if (agentId) {
    // Single agent mode
    let agentState = agentStates.get(agentId);
    
    if (!agentState) {
      // Fetch agent from database
      const { data: agentData, error } = await supabase
        .from('agent_statuses')
        .select('*')
        .eq('id', agentId)
        .single();
        
      if (error) {
        throw new Error(`Failed to fetch agent: ${error.message}`);
      }
      
      // Initialize agent state
      agentState = {
        id: agentId,
        name: agentData.name,
        type: agentData.agent_type,
        projectId,
        status: 'idle',
        progress: 0,
        lastActivity: Date.now(),
        contextMemory: [
          {
            role: 'system',
            content: `You are ${agentData.name}, a ${agentData.agent_type} agent working on a project with other specialized AI agents. You have specific expertise in your domain and can collaborate with others.`
          }
        ]
      };
      
      agentStates.set(agentId, agentState);
      
      // Initialize message queue for this agent
      if (!messageQueue.has(agentId)) {
        messageQueue.set(agentId, []);
      }
    }
    
    // Update agent status to working
    agentState.status = 'working';
    agentState.progress = 10;
    agentState.lastActivity = Date.now();
    
    // Update in database
    await supabase
      .from('agent_statuses')
      .update({ status: 'working', progress: 10 })
      .eq('id', agentId);
      
    // If task specified, start working on it
    if (taskId) {
      return await handleProcessTask(projectId, agentId, taskId, verbose);
    }
    
    // Add notification to chat
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `I'm now active and ready to work on tasks for this project.`,
        sender: agentState.name,
        type: 'text'
      }]);
      
    return {
      success: true,
      message: `Agent ${agentState.name} started`,
      agentId,
      projectId,
      status: agentState.status
    };
    
  } else {
    // Project-wide start, fetch all agents
    const { data: agents, error } = await supabase
      .from('agent_statuses')
      .select('*')
      .eq('project_id', projectId);
      
    if (error) {
      throw new Error(`Failed to fetch agents: ${error.message}`);
    }
    
    // Start each agent
    for (const agent of agents) {
      const agentState: AgentState = {
        id: agent.id,
        name: agent.name,
        type: agent.agent_type,
        projectId,
        status: 'idle',
        progress: 0,
        lastActivity: Date.now(),
        contextMemory: [
          {
            role: 'system',
            content: `You are ${agent.name}, a ${agent.agent_type} agent working on a project with other specialized AI agents. You have specific expertise in your domain and can collaborate with others.`
          }
        ]
      };
      
      agentStates.set(agent.id, agentState);
      
      // Initialize message queue
      if (!messageQueue.has(agent.id)) {
        messageQueue.set(agent.id, []);
      }
    }
    
    // Add notification to chat
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `All agents have been initialized and are ready to collaborate.`,
        sender: 'System',
        type: 'text'
      }]);
      
    return {
      success: true,
      message: `All agents (${agents.length}) in project ${projectId} started`,
      projectId,
      agentCount: agents.length
    };
  }
}

/**
 * Handle stop action
 */
async function handleStopAction(projectId: string, agentId?: string) {
  if (agentId) {
    // Stop single agent
    const agentState = agentStates.get(agentId);
    
    if (agentState) {
      agentState.status = 'idle';
      agentState.progress = 0;
      agentState.currentTask = undefined;
      
      // Update in database
      await supabase
        .from('agent_statuses')
        .update({ status: 'idle', progress: 0 })
        .eq('id', agentId);
        
      // Update any tasks
      await supabase
        .from('tasks')
        .update({ status: 'pending' })
        .eq('assigned_to', agentId)
        .eq('status', 'in_progress');
    }
    
    return {
      success: true,
      message: `Agent ${agentId} stopped`,
      agentId,
      projectId
    };
    
  } else {
    // Stop all agents in project
    for (const [id, state] of agentStates.entries()) {
      if (state.projectId === projectId) {
        state.status = 'idle';
        state.progress = 0;
        state.currentTask = undefined;
      }
    }
    
    // Update all agents in database
    await supabase
      .from('agent_statuses')
      .update({ status: 'idle', progress: 0 })
      .eq('project_id', projectId);
      
    // Update all in-progress tasks
    await supabase
      .from('tasks')
      .update({ status: 'pending' })
      .eq('project_id', projectId)
      .eq('status', 'in_progress');
      
    return {
      success: true,
      message: `All agents in project ${projectId} stopped`,
      projectId
    };
  }
}

/**
 * Handle team collaboration with real agent interaction
 */
async function handleTeamCollaboration(
  projectId: string, 
  agents: Array<{ id: string, type: string, name: string }>,
  projectContext: any,
  autostart = false,
  verbose = false
) {
  console.log(`Initiating team collaboration for project ${projectId} with ${agents.length} agents`);
  
  // Make sure we have the project data
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
    
  if (projectError) {
    throw new Error(`Failed to fetch project: ${projectError.message}`);
  }
  
  // Initialize all agents
  for (const agent of agents) {
    const agentState: AgentState = {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      projectId,
      status: 'idle',
      progress: 0,
      lastActivity: Date.now(),
      contextMemory: [
        {
          role: 'system',
          content: `You are ${agent.name}, a ${agent.type} agent working on project "${projectData.name}". 
Project description: ${projectData.description || 'No description provided'}
Your role is to collaborate with other specialized AI agents and provide expertise in your domain of ${agent.type}.`
        }
      ]
    };
    
    agentStates.set(agent.id, agentState);
    
    // Initialize message queue
    if (!messageQueue.has(agent.id)) {
      messageQueue.set(agent.id, []);
    }
    
    // Update in database
    await supabase
      .from('agent_statuses')
      .update({ status: 'idle', progress: 0 })
      .eq('id', agent.id);
  }
  
  // Find the architect agent to lead the team
  const architect = agents.find(a => a.type.toLowerCase() === 'architect');
  
  if (!architect) {
    throw new Error('No architect agent found to lead the team');
  }
  
  // Set architect to thinking status
  const architectState = agentStates.get(architect.id);
  if (architectState) {
    architectState.status = 'thinking';
    architectState.progress = 10;
    architectState.lastActivity = Date.now();
    
    // Update in database
    await supabase
      .from('agent_statuses')
      .update({ status: 'thinking', progress: 10 })
      .eq('id', architect.id);
  }
  
  // Add collaboration start message
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: `Team collaboration has been initiated. I'll analyze the project requirements and coordinate our work.`,
      sender: architect.name,
      type: 'text'
    }]);
    
  // Generate initial plan with the architect
  const planResponse = await callOpenRouter(
    'architect',
    `You are the lead architect for project "${projectData.name}". 
Project description: ${projectData.description || 'No description available'}

Your team consists of these specialized agents:
${agents.filter(a => a.id !== architect.id).map(a => `- ${a.name} (${a.type})`).join('\n')}

Create a detailed project plan that includes:
1. A breakdown of the main components and features needed
2. Specific tasks for each team member based on their specialization
3. Dependencies between tasks
4. Any technical decisions or architecture choices

Format your response as a comprehensive project plan. Be detailed, specific, and production-ready.`,
    { projectId, projectName: projectData.name },
    verbose
  );
  
  // Extract tasks from the plan
  const tasks = extractTasksFromPlan(planResponse);
  
  // Create tasks in the database and assign to agents
  if (tasks.length > 0) {
    console.log(`Creating ${tasks.length} tasks from architect's plan`);
    
    for (const task of tasks) {
      // Find the appropriate agent for this task
      const targetAgent = agents.find(a => 
        task.assignedTo.toLowerCase().includes(a.type.toLowerCase()) ||
        a.name.toLowerCase().includes(task.assignedTo.toLowerCase())
      );
      
      if (targetAgent) {
        // Create the task
        const { data: newTask, error } = await supabase
          .from('tasks')
          .insert([{
            project_id: projectId,
            title: task.title,
            description: task.description,
            assigned_to: targetAgent.id,
            status: 'pending',
            priority: task.priority || 'medium'
          }])
          .select()
          .single();
          
        if (error) {
          console.error(`Error creating task: ${error.message}`);
          continue;
        }
        
        // Send a message to the agent about their task
        if (newTask) {
          const message: AgentMessage = {
            id: crypto.randomUUID(),
            fromAgentId: architect.id,
            toAgentId: targetAgent.id,
            projectId,
            content: `I've assigned you the following task: "${newTask.title}"\n\nDescription: ${newTask.description}\n\nThis is part of our project plan. Please start working on this as soon as you're ready and keep me updated on your progress.`,
            type: 'task',
            status: 'pending',
            metadata: {
              taskId: newTask.id
            }
          };
          
          // Add to message queue
          const agentQueue = messageQueue.get(targetAgent.id) || [];
          agentQueue.push(message);
          messageQueue.set(targetAgent.id, agentQueue);
        }
      }
    }
    
    // Send the complete plan to chat
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `I've analyzed our project requirements and created a detailed plan. I've assigned ${tasks.length} specific tasks to team members based on their expertise. Each agent will now work on their assigned tasks and collaborate as needed.`,
        sender: architect.name,
        type: 'text'
      }]);
    
    // Start other agents if autostart is enabled
    if (autostart) {
      for (const agent of agents) {
        if (agent.id !== architect.id) {
          // Update agent status
          const agentState = agentStates.get(agent.id);
          if (agentState) {
            agentState.status = 'working';
            agentState.progress = 10;
            agentState.lastActivity = Date.now();
            
            // Update in database
            await supabase
              .from('agent_statuses')
              .update({ status: 'working', progress: 10 })
              .eq('id', agent.id);
              
            // Process the agent's messages
            processAgentMessages(agent.id, projectId).catch(err => {
              console.error(`Error processing messages for ${agent.name}:`, err);
            });
          }
        }
      }
    }
  } else {
    // Send message if no tasks could be extracted
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `I've analyzed the project requirements but couldn't determine specific tasks yet. I'll need to gather more information from the team.`,
        sender: architect.name,
        type: 'text'
      }]);
  }
  
  // Update architect status to working
  if (architectState) {
    architectState.status = 'working';
    architectState.progress = 50;
    
    // Update in database
    await supabase
      .from('agent_statuses')
      .update({ status: 'working', progress: 50 })
      .eq('id', architect.id);
  }
  
  return {
    success: true,
    message: `Team collaboration initiated for project ${projectId}`,
    projectId,
    taskCount: tasks.length,
    agents: agents.length
  };
}

/**
 * Handle sending a message between agents
 */
async function handleSendMessage(projectId: string, messageData: Partial<AgentMessage>) {
  if (!messageData.fromAgentId || !messageData.toAgentId || !messageData.content) {
    throw new Error('Missing required message data fields');
  }
  
  const message: AgentMessage = {
    id: messageData.id || crypto.randomUUID(),
    fromAgentId: messageData.fromAgentId,
    toAgentId: messageData.toAgentId,
    projectId,
    content: messageData.content,
    type: messageData.type || 'notification',
    status: 'pending',
    metadata: messageData.metadata || {},
    created_at: new Date().toISOString()
  };
  
  // Special handling for progress messages
  if (messageData.type === 'progress' && messageData.metadata?.progress !== undefined) {
    try {
      // Update agent progress in database
      await supabase
        .from('agent_statuses')
        .update({ progress: messageData.metadata.progress })
        .eq('id', messageData.fromAgentId);
    } catch (error) {
      console.error('Error updating agent progress:', error);
    }
  }
  
  // Add to recipient's message queue
  const agentQueue = messageQueue.get(message.toAgentId) || [];
  agentQueue.push(message);
  messageQueue.set(message.toAgentId, agentQueue);
  
  // Process messages immediately
  try {
    await processAgentMessages(message.toAgentId, projectId);
  } catch (error) {
    console.error(`Error processing messages for agent ${message.toAgentId}:`, error);
  }
  
  return {
    success: true,
    message: `Message sent from ${message.fromAgentId} to ${message.toAgentId}`,
    messageId: message.id
  };
}

/**
 * Handle updating agent progress
 */
async function handleUpdateProgress(projectId: string, agentId: string, progress: number): Promise<any> {
  if (progress < 0 || progress > 100) {
    throw new Error('Progress value must be between 0 and 100');
  }
  
  try {
    // Update agent progress in database
    const { error } = await supabase
      .from('agent_statuses')
      .update({ progress })
      .eq('id', agentId)
      .eq('project_id', projectId);
      
    if (error) {
      throw new Error(`Failed to update agent progress: ${error.message}`);
    }
    
    return {
      success: true,
      agentId,
      progress,
      message: `Progress updated for agent ${agentId}`
    };
  } catch (error) {
    console.error('Error in handleUpdateProgress:', error);
    throw error;
  }
}

/**
 * Handle retrieving messages for an agent
 */
async function handleGetMessages(projectId: string, agentId: string) {
  if (!agentId) {
    throw new Error('Agent ID is required');
  }
  
  const messages = messageQueue.get(agentId) || [];
  
  return {
    success: true,
    agentId,
    messages: messages.filter(m => m.projectId === projectId || !projectId)
  };
}

/**
 * Handle processing a specific task
 */
async function handleProcessTask(projectId: string, agentId: string, taskId: string, verbose = false) {
  if (!agentId || !taskId) {
    throw new Error('Agent ID and Task ID are required');
  }
  
  // Get agent state
  const agentState = agentStates.get(agentId);
  if (!agentState) {
    throw new Error(`Agent ${agentId} not found in state`);
  }
  
  // Get task details
  const { data: task, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();
    
  if (error || !task) {
    throw new Error(`Failed to fetch task: ${error?.message || 'Task not found'}`);
  }
  
  // Update agent progress independently for each step of task processing
  // This ensures each agent has their own progress journey
  const updateProgress = async (progress: number) => {
    agentState.progress = progress;
    await supabase
      .from('agent_statuses')
      .update({ progress })
      .eq('id', agentId);
  };
  
  // Start with lower progress
  await updateProgress(20);
  
  // Update agent status
  agentState.status = 'working';
  agentState.progress = 20;
  agentState.currentTask = taskId;
  agentState.lastActivity = Date.now();
  
  // Update task status
  await supabase
    .from('tasks')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', taskId);
    
  // Update agent status in database
  await supabase
    .from('agent_statuses')
    .update({ status: 'working', progress: 20 })
    .eq('id', agentId);
    
  // Generate agent's approach message
  const approachResponse = await callOpenRouter(
    agentState.type,
    `You are working on the following task: "${task.title}"
    
Description: ${task.description}

1. Analyze what needs to be done to complete this task.
2. Describe your approach and the steps you'll take.
3. Mention any information or resources you might need from other agents.

Respond as if you're messaging your team about how you plan to tackle this task.`,
    { projectId, taskId },
    verbose
  );
  
  // Add approach message to chat
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: approachResponse,
      sender: agentState.name,
      type: 'text'
    }]);
    
  // Update progress
  await updateProgress(40);
  
  // Generate task implementation
  const implementationResponse = await callOpenRouter(
    agentState.type,
    `You're now implementing the task: "${task.title}"
    
Description: ${task.description}

Provide a detailed, production-ready implementation for this task. Include:

1. Any code you need to write - use code blocks with the filepath in this format:
\`\`\`filepath:/path/to/file.ext
// Code content here
\`\`\`

2. Technical details and explanations of your implementation.

3. Any configuration or setup required.

Be thorough, specific, and make sure your implementation is complete and functional.`,
    { projectId, taskId },
    verbose
  );
  
  // Extract code from the implementation
  const codeSnippets = extractCodeSnippets(implementationResponse);
  
  // Create/update code files
  if (codeSnippets.length > 0) {
    for (const snippet of codeSnippets) {
      const fileName = snippet.filePath.split('/').pop() || 'unknown.txt';
      
      // Check if file exists
      const { data: existingFiles } = await supabase
        .from('code_files')
        .select('id')
        .eq('path', snippet.filePath)
        .eq('project_id', projectId);
        
      if (existingFiles && existingFiles.length > 0) {
        // Update existing file
        await supabase
          .from('code_files')
          .update({
            content: snippet.code,
            last_modified_by: agentState.name,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingFiles[0].id);
      } else {
        // Create new file
        await supabase
          .from('code_files')
          .insert([{
            project_id: projectId,
            name: fileName,
            path: snippet.filePath,
            content: snippet.code,
            language: determineLanguage(snippet.filePath),
            created_by: agentState.name,
            last_modified_by: agentState.name
          }]);
      }
    }
  }
  
  // Add implementation message to chat
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: implementationResponse,
      sender: agentState.name,
      type: 'text'
    }]);
    
  // Generate completion message
  const completionResponse = await callOpenRouter(
    agentState.type,
    `You've completed the task: "${task.title}"
    
Provide a brief summary of what you implemented, any challenges you encountered, and what the results are. Keep it concise but informative.`,
    { projectId, taskId },
    verbose
  );
  
  // Add completion message to chat
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: completionResponse,
      sender: agentState.name,
      type: 'text'
    }]);
    
  // Update task status
  await supabase
    .from('tasks')
    .update({ 
      status: 'completed', 
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    })
    .eq('id', taskId);
    
  // Update agent status
  agentState.status = 'idle';
  agentState.progress = 100;
  agentState.currentTask = undefined;
  agentState.lastActivity = Date.now();
  
  await supabase
    .from('agent_statuses')
    .update({ status: 'idle', progress: 100 })
    .eq('id', agentId);
    
  // Check for other pending tasks
  const { data: pendingTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .eq('assigned_to', agentId)
    .eq('status', 'pending')
    .limit(1);
    
  if (pendingTasks && pendingTasks.length > 0) {
    // Start next task
    return handleProcessTask(projectId, agentId, pendingTasks[0].id, verbose);
  }
  
  return {
    success: true,
    message: `Task ${taskId} completed by agent ${agentId}`,
    agentId,
    taskId,
    filesCreated: codeSnippets.length
  };
}

/**
 * Handle getting agent state
 */
async function handleGetAgentState(projectId: string, agentId: string) {
  if (!agentId) {
    throw new Error('Agent ID is required');
  }
  
  const agentState = agentStates.get(agentId);
  
  if (!agentState) {
    // Try to fetch from database
    const { data: agentData, error } = await supabase
      .from('agent_statuses')
      .select('*')
      .eq('id', agentId)
      .single();
      
    if (error || !agentData) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    return {
      success: true,
      agentId,
      state: {
        id: agentData.id,
        name: agentData.name,
        type: agentData.agent_type,
        status: agentData.status,
        progress: agentData.progress
      }
    };
  }
  
  return {
    success: true,
    agentId,
    state: {
      id: agentState.id,
      name: agentState.name,
      type: agentState.type,
      status: agentState.status,
      progress: agentState.progress,
      currentTask: agentState.currentTask,
      lastActivity: agentState.lastActivity
    }
  };
}

/**
 * Process messages for an agent
 */
async function processAgentMessages(agentId: string, projectId: string): Promise<void> {
  const agentState = agentStates.get(agentId);
  if (!agentState) {
    throw new Error(`Agent ${agentId} not found in state`);
  }
  
  const messages = messageQueue.get(agentId) || [];
  const pendingMessages = messages.filter(m => m.status === 'pending' && m.projectId === projectId);
  
  if (pendingMessages.length === 0) {
    return; // No messages to process
  }
  
  // Take the first pending message
  const message = pendingMessages[0];
  
  // Update message status
  message.status = 'delivered';
  
  // Get sender info
  const senderState = agentStates.get(message.fromAgentId);
  const senderName = senderState?.name || 'Unknown Agent';
  
  // Update agent status
  agentState.status = 'thinking';
  agentState.lastActivity = Date.now();
  
  // Update in database
  await supabase
    .from('agent_statuses')
    .update({ status: 'thinking' })
    .eq('id', agentId);
    
  // Add message to context memory
  agentState.contextMemory.push({
    role: 'user',
    content: `Message from ${senderName}:\n\n${message.content}`
  });
  
  // Generate response
  const isTaskMessage = message.type === 'task';
  let responsePrompt = `You received a message from ${senderName}:\n\n${message.content}\n\n`;
  
  if (isTaskMessage) {
    responsePrompt += `This message is assigning you a task. Respond thoughtfully with:
1. Your understanding of the task
2. Any initial questions you have
3. How you plan to approach this work
4. Any dependencies or information you need
    
Keep your response professional, specific, and focused on the task.`;
  } else {
    responsePrompt += `Respond thoughtfully to this message. Consider:
1. What information they're providing or requesting
2. How this relates to your role as a ${agentState.type} agent
3. What would be most helpful to move the project forward
    
Keep your response concise, professional, and constructive.`;
  }
  
  try {
    // Generate agent response
    const response = await callOpenRouter(agentState.type, responsePrompt, { projectId });
    
    // Add to context memory
    agentState.contextMemory.push({
      role: 'assistant',
      content: response
    });
    
    // Send response message
    const responseMessage: AgentMessage = {
      id: crypto.randomUUID(),
      fromAgentId: agentId,
      toAgentId: message.fromAgentId,
      projectId,
      content: response,
      type: 'response',
      status: 'pending',
      metadata: {
        inResponseTo: message.id,
        ...(message.metadata || {})
      }
    };
    
    // Add to sender's queue
    const senderQueue = messageQueue.get(message.fromAgentId) || [];
    senderQueue.push(responseMessage);
    messageQueue.set(message.fromAgentId, senderQueue);
    
    // Add to chat for visibility
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `@${senderName} ${response}`,
        sender: agentState.name,
        type: 'text'
      }]);
      
    // Mark original message as processed
    message.status = 'processed';
    
    // Update agent status
    agentState.status = 'working';
    agentState.lastActivity = Date.now();
    
    // Update in database
    await supabase
      .from('agent_statuses')
      .update({ status: 'working' })
      .eq('id', agentId);
      
    // If this was a task message, check if there's a task ID in metadata
    if (isTaskMessage && message.metadata?.taskId) {
      // Start working on the task
      handleProcessTask(projectId, agentId, message.metadata.taskId, false).catch(err => {
        console.error(`Error processing task ${message.metadata.taskId}:`, err);
      });
    }
    
  } catch (error) {
    console.error(`Error processing message for agent ${agentState.name}:`, error);
    
    // Reset agent status
    agentState.status = 'idle';
    
    // Update in database
    await supabase
      .from('agent_statuses')
      .update({ status: 'idle' })
      .eq('id', agentId);
  }
}

/**
 * Extract tasks from architect's plan
 */
function extractTasksFromPlan(plan: string): Array<{
  title: string;
  assignedTo: string;
  description: string;
  priority: string;
}> {
  const tasks = [];
  
  // Try different patterns for task extraction
  const taskPattern1 = /Task\s*(?:[\d#]+)?[:.\-]\s*([^\n]+)[\n\s]*Agent\s*[:.\-]\s*([^\n]+)[\n\s]*Description\s*[:.\-]\s*([^\n]+)(?:[\n\s]*Priority\s*[:.\-]\s*([^\n]+))?/gi;
  const taskPattern2 = /Task\s*(?:for)?\s*([^:]+?):\s*([^\n]+?)[\n\s]*Description\s*[:.\-]\s*([^\n]+)?(?:[\n\s]*Priority\s*[:.\-]\s*([^\n]+))?/gi;
  const taskPattern3 = /\-\s*\*\*([^:]+?):*\*\*\s*([^\n]+?)(?:[\n\s]*([^\n]+))?(?:[\n\s]*Priority\s*[:.\-]\s*([^\n]+))?/gi;
  
  let match;
  
  // Try first pattern
  while ((match = taskPattern1.exec(plan)) !== null) {
    tasks.push({
      title: match[1].trim(),
      assignedTo: match[2].trim(),
      description: match[3].trim(),
      priority: (match[4] || 'medium').trim().toLowerCase()
    });
  }
  
  // If no tasks found, try second pattern
  if (tasks.length === 0) {
    while ((match = taskPattern2.exec(plan)) !== null) {
      tasks.push({
        title: match[2].trim(),
        assignedTo: match[1].trim(),
        description: (match[3] || match[2]).trim(),
        priority: (match[4] || 'medium').trim().toLowerCase()
      });
    }
  }
  
  // If still no tasks found, try third pattern
  if (tasks.length === 0) {
    while ((match = taskPattern3.exec(plan)) !== null) {
      tasks.push({
        title: match[2].trim(),
        assignedTo: match[1].trim(),
        description: (match[3] || match[2]).trim(),
        priority: (match[4] || 'medium').trim().toLowerCase()
      });
    }
  }
  
  // Normalize priorities
  for (const task of tasks) {
    const priority = task.priority.toLowerCase();
    if (priority.includes('high')) {
      task.priority = 'high';
    } else if (priority.includes('low')) {
      task.priority = 'low';
    } else {
      task.priority = 'medium';
    }
  }
  
  return tasks;
}

/**
 * Extract code snippets from responses
 */
function extractCodeSnippets(content: string): Array<{
  filePath: string;
  code: string;
}> {
  const codeSnippets = [];
  
  // Match code blocks with filepath format: ```filepath:/path/to/file
  const filepathPattern = /```(?:filepath:|\s*)([\w\/\.-]+)\s*\n([\s\S]*?)\n```/g;
  let match;
  
  while ((match = filepathPattern.exec(content)) !== null) {
    const filePath = match[1].trim();
    const code = match[2].trim();
    
    if (filePath && code) {
      codeSnippets.push({ filePath, code });
    }
  }
  
  // If no filepath-specific code blocks found, look for language-specific blocks
  if (codeSnippets.length === 0) {
    const languagePattern = /```(?:([\w\+]+)\n)?([\s\S]*?)\n```/g;
    
    while ((match = languagePattern.exec(content)) !== null) {
      const language = match[1] ? match[1].trim().toLowerCase() : '';
      const code = match[2].trim();
      
      if (code) {
        // Use default filenames based on language
        let filePath = '';
        
        if (language === 'javascript' || language === 'js') {
          filePath = 'script.js';
        } else if (language === 'typescript' || language === 'ts') {
          filePath = 'script.ts';
        } else if (language === 'html') {
          filePath = 'index.html';
        } else if (language === 'css') {
          filePath = 'styles.css';
        } else if (language === 'python' || language === 'py') {
          filePath = 'script.py';
        } else if (language === 'json') {
          filePath = 'data.json';
        } else if (language === 'jsx' || language === 'tsx') {
          filePath = `component.${language}`;
        } else {
          // Skip non-code blocks like markdown
          if (['markdown', 'md', ''].includes(language)) continue;
          filePath = `file.${language || 'txt'}`;
        }
        
        codeSnippets.push({ filePath, code });
      }
    }
  }
  
  return codeSnippets;
}

/**
 * Determine language from file path
 */
function determineLanguage(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'js': return 'javascript';
    case 'ts': return 'typescript';
    case 'jsx': return 'jsx';
    case 'tsx': return 'tsx';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'py': return 'python';
    case 'json': return 'json';
    case 'md': return 'markdown';
    default: return extension;
  }
}

/**
 * Call OpenRouter API for agent responses
 */
async function callOpenRouter(
  agentType: string, 
  prompt: string, 
  context: any = {}, 
  verbose = false
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is not configured');
  }
  
  console.log(`Calling OpenRouter API for ${agentType} agent with prompt: ${prompt.substring(0, 100)}...`);
  
  const systemPrompts: Record<string, string> = {
    'architect': `You are a professional software architect. You design systems, plan technical implementations, and coordinate development efforts. Your responses are detailed, technical, and production-ready.`,
    
    'frontend': `You are an expert frontend developer specializing in React, TypeScript, and modern web development patterns. You write clean, maintainable code with proper error handling and performance considerations.`,
    
    'backend': `You are a backend developer with expertise in API design, database optimization, and server architecture. Your code is secure, scalable, and follows best practices.`,
    
    'devops': `You are a DevOps engineer focused on CI/CD pipelines, infrastructure as code, and deployment automation. You understand cloud services, container orchestration, and operational excellence.`,
    
    'testing': `You are a QA engineer specializing in test automation, quality assurance processes, and bug identification. You write thorough test cases and ensure software reliability.`
  };
  
  const systemPrompt = systemPrompts[agentType.toLowerCase()] || 
    `You are an AI agent specializing in ${agentType}. Provide technical, detailed, and production-ready responses.`;
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://lovable.dev', 
      'X-Title': 'Agentic Development Platform',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-thinking-exp:free',
      messages: [
        { 
          role: 'system', 
          content: `${systemPrompt}\n\nContext: ${JSON.stringify(context)}\n\nAlways provide production-ready, complete implementations. Never include placeholder code or TODOs.` 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }
  
  const data = await response.json();
  const content = data.choices[0].message.content;
  
  if (verbose) {
    console.log('OpenRouter API full response:', JSON.stringify(data, null, 2));
  }
  
  return content;
}
