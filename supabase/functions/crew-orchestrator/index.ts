
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabase-client.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
    const { projectId, agentId, taskId, action = 'start', agents, projectContext } = JSON.parse(rawBody);
    
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
    
    // Create initialization message based on action
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
    } else if (action === 'team_collaborate') {
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content: `The team is now collaborating on project: ${projectData.name}. Agents will automatically assign and work on tasks.`,
          sender: "Architect Agent",
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
    if (action === 'team_collaborate') {
      processTeamCollaboration(projectId, projectData, agents || [], projectContext).catch(error => {
        console.error('Error in team collaboration processing:', error);
      });
    } else {
      processOrchestration(projectId, projectData, agentId, agentData, tasksData, action).catch(error => {
        console.error('Error in asynchronous orchestration processing:', error);
      });
    }
    
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
 * Process team collaboration
 */
async function processTeamCollaboration(projectId, projectData, agents, projectContext) {
  console.log(`Starting team collaboration for project ${projectId} with ${agents.length} agents`);
  
  if (!agents || agents.length === 0) {
    console.error('No agents provided for team collaboration');
    return;
  }
  
  try {
    // Start with architect planning
    const architect = agents.find(a => a.type === 'architect');
    if (!architect) {
      console.error('No architect agent found for team collaboration');
      return;
    }
    
    // Generate initial plan with the architect
    const architectPlan = await callOpenRouter(
      'architect',
      `You are the lead architect for project "${projectData.name}". ${projectData.description || ''}
      Create a detailed plan for implementing this project, breaking it down into specific tasks for each team member.
      For each task, specify:
      1. Task title
      2. Which agent should work on it (Frontend, Backend, DevOps, or Testing)
      3. A detailed description of what needs to be implemented
      4. Priority (High, Medium, Low)
      
      Format each task as:
      TASK: [Task Title]
      ASSIGNED TO: [Agent Type] Agent
      DESCRIPTION: [Detailed description]
      PRIORITY: [Priority]
      
      Include at least one task for each team member.`,
      { projectId, projectName: projectData.name, projectDescription: projectData.description }
    );
    
    // Add the architect's plan to chat
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: architectPlan,
        sender: architect.name,
        type: 'text'
      }]);
    
    // Extract tasks from the plan
    const tasksInfo = extractTasksInfo(architectPlan);
    
    if (tasksInfo.length > 0) {
      console.log(`Extracted ${tasksInfo.length} tasks from architect's plan`);
      
      // Create the tasks in the database
      for (const taskInfo of tasksInfo) {
        const agentType = taskInfo.assignedTo.replace(' Agent', '').toLowerCase();
        const assignedAgent = agents.find(a => a.type.toLowerCase() === agentType);
        
        if (assignedAgent) {
          await supabase
            .from('tasks')
            .insert([{
              project_id: projectId,
              title: taskInfo.title,
              description: taskInfo.description,
              assigned_to: assignedAgent.id,
              status: 'pending',
              priority: taskInfo.priority.toLowerCase()
            }]);
            
          console.log(`Created task "${taskInfo.title}" for ${assignedAgent.name}`);
        }
      }
      
      // Have each agent acknowledge their tasks
      for (const agent of agents) {
        if (agent.type !== 'architect') {
          // Fetch the agent's tasks
          const { data: agentTasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId)
            .eq('assigned_to', agent.id)
            .eq('status', 'pending');
            
          if (agentTasks && agentTasks.length > 0) {
            // Generate acknowledgment using AI
            const acknowledgment = await callOpenRouter(
              agent.type,
              `You've been assigned ${agentTasks.length} task(s) for project "${projectData.name}":
              ${agentTasks.map((t, i) => `${i+1}. ${t.title}: ${t.description}`).join('\n')}
              
              Acknowledge these tasks and briefly mention how you plan to approach them.`,
              { projectId, projectName: projectData.name, agentTasks }
            );
            
            await supabase
              .from('chat_messages')
              .insert([{
                project_id: projectId,
                content: acknowledgment,
                sender: agent.name,
                type: 'text'
              }]);
              
            console.log(`${agent.name} acknowledged tasks`);
            
            // Start working on the first task after a short delay
            setTimeout(async () => {
              if (agentTasks.length > 0) {
                const firstTask = agentTasks[0];
                console.log(`${agent.name} starting work on task: ${firstTask.title}`);
                
                await processTask(projectId, agent.id, { name: agent.name, agent_type: agent.type }, firstTask);
              }
            }, 5000 + Math.random() * 5000); // Random delay between 5-10 seconds
          }
        }
      }
    } else {
      console.error('No tasks could be extracted from architect plan');
      
      // Create default tasks if no tasks could be extracted
      await createInitialTasks(projectId, agents);
    }
    
    // Set up periodic check for pending tasks
    setTimeout(() => {
      checkAndAssignPendingTasks(projectId, agents);
    }, 30000); // Check after 30 seconds
    
  } catch (error) {
    console.error('Error in team collaboration:', error);
    
    // Add error message to chat
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `Team collaboration encountered an error: ${error.message}`,
        sender: "System",
        type: "error"
      }]);
  }
}

/**
 * Periodically check for pending tasks and assign them to agents
 */
async function checkAndAssignPendingTasks(projectId, agents) {
  try {
    console.log(`Checking for pending tasks in project ${projectId}`);
    
    // Get all pending tasks
    const { data: pendingTasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'pending');
      
    if (error) {
      console.error('Error fetching pending tasks:', error);
      return;
    }
    
    if (pendingTasks && pendingTasks.length > 0) {
      console.log(`Found ${pendingTasks.length} pending tasks`);
      
      // Check which agents are idle
      const { data: agentStatuses } = await supabase
        .from('agent_statuses')
        .select('*')
        .eq('project_id', projectId);
        
      if (agentStatuses) {
        const idleAgents = agentStatuses.filter(a => a.status !== 'working');
        
        if (idleAgents.length > 0) {
          // Assign a task to the first idle agent
          const agent = idleAgents[0];
          const task = pendingTasks.find(t => t.assigned_to === agent.id) || pendingTasks[0];
          
          if (task) {
            console.log(`Assigning task "${task.title}" to ${agent.name}`);
            
            // Update agent status
            await supabase
              .from('agent_statuses')
              .update({ status: 'working', progress: 10 })
              .eq('id', agent.id);
              
            // Process the task
            await processTask(projectId, agent.id, agent, task);
          }
        }
      }
    }
    
    // Schedule next check
    setTimeout(() => {
      checkAndAssignPendingTasks(projectId, agents);
    }, 60000); // Check every minute
    
  } catch (error) {
    console.error('Error checking pending tasks:', error);
    
    // Schedule next check even if there was an error
    setTimeout(() => {
      checkAndAssignPendingTasks(projectId, agents);
    }, 60000);
  }
}

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
 * Call OpenRouter API to generate agent response
 */
async function callOpenRouter(agentType, prompt, projectContext = {}, taskId = null) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is not configured');
  }

  console.log(`Calling OpenRouter API for ${agentType} agent with prompt: ${prompt.substring(0, 100)}...`);

  const systemPrompts = {
    'architect': `You are the Architect Agent in a software development team. You analyze requirements and delegate tasks to specialized agents. 
    Respond in character as a seasoned software architect. Your expertise is in designing scalable, maintainable systems.
    You work with other agents: Frontend Agent, Backend Agent, Testing Agent, and DevOps Agent.`,
    
    'frontend': `You are the Frontend Agent in a software development team.
    Respond in character as an expert frontend developer. Your expertise is in creating intuitive user interfaces and responsive designs.
    You work with other agents, particularly looking to the Architect Agent for direction and collaborating with the Backend Agent for integration.`,
    
    'backend': `You are the Backend Agent in a software development team.
    Respond in character as a skilled backend developer. Your expertise is in creating robust APIs, database design, and server-side logic.
    You work with other agents, implementing the architectural design from the Architect Agent and providing APIs for the Frontend Agent.`,
    
    'testing': `You are the Testing Agent in a software development team.
    Respond in character as a meticulous QA engineer. Your expertise is in ensuring code quality, writing test cases, and finding potential issues.
    You work with all other agents to verify their work meets requirements and is free of defects.`,
    
    'devops': `You are the DevOps Agent in a software development team.
    Respond in character as an experienced DevOps engineer. Your expertise is in deployment pipelines, infrastructure, and system reliability.
    You work with all other agents to ensure the project can be deployed and scaled effectively.`
  };

  let fullSystemPrompt = systemPrompts[agentType] || 'You are an AI assistant helping with software development.';
  
  if (projectContext && Object.keys(projectContext).length > 0) {
    fullSystemPrompt += `\n\nProject context: ${JSON.stringify(projectContext)}`;
  }

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
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      thinking: {
        enabled: true
      }
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('OpenRouter API error:', errorData);
    throw new Error(`OpenRouter API returned status ${response.status}: ${errorData}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
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
    // Create a default task based on agent type with real descriptions
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
    
    // Generate an AI response about the task creation
    const response = await callOpenRouter(
      agentData.agent_type,
      `You've been assigned a new task: ${taskTitle}. Briefly describe how you will approach this task.`,
      { projectId, taskTitle, taskDescription: taskDesc }
    );
    
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: response,
        sender: agentData.name,
        type: 'text'
      }]);
  }
  
  // Update agent status to working
  await supabase
    .from('agent_statuses')
    .update({ status: 'working', progress: 10 })
    .eq('id', agentId);
    
  // Process each task in sequence with real AI responses
  for (const task of tasksData) {
    await processTask(projectId, agentId, agentData, task);
  }
  
  // Final update to agent
  await supabase
    .from('agent_statuses')
    .update({ status: 'completed', progress: 100 })
    .eq('id', agentId);
    
  // Add completion message
  const completionResponse = await callOpenRouter(
    agentData.agent_type,
    `You've completed all your assigned tasks for project ${projectId}. Summarize what you've accomplished.`,
    { projectId }
  );
  
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: completionResponse,
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
    
  // Generate a message about starting the task using AI
  const startResponse = await callOpenRouter(
    agentData.agent_type,
    `Execute the following task: "${task.title}". ${task.description} 
    Provide a detailed implementation with real code examples that could be used in the project.
    Remember to use the filepath format for any code examples: \`\`\`filepath:/path/to/file\`\`\`
    If your task involves creating other tasks for team members, format them as:
    TASK: [Title]
    ASSIGNED TO: [Agent Type] Agent
    DESCRIPTION: [Details]
    PRIORITY: [High/Medium/Low]
    
    Think about how your work integrates with the rest of the team. Consider dependencies and collaborations needed.`,
    { projectId, taskId: task.id, taskTitle: task.title, taskDescription: task.description }
  );
  
  // Extract code snippets and create code files
  const codeSnippets = extractCodeSnippets(startResponse);
  if (codeSnippets.length > 0) {
    for (const snippet of codeSnippets) {
      const fileName = snippet.filePath.split('/').pop();
      
      // Check if file already exists
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
            last_modified_by: agentData.name,
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
            created_by: agentData.name,
            last_modified_by: agentData.name
          }]);
      }
    }
    
    // Add a message about the created files
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `I've created/updated ${codeSnippets.length} code files as part of this task.`,
        sender: agentData.name,
        type: "text"
      }]);
  }
  
  // Extract and create tasks
  const tasksInfo = extractTasksInfo(startResponse);
  if (tasksInfo.length > 0) {
    for (const taskInfo of tasksInfo) {
      // Find the agent for the task
      const agentType = taskInfo.assignedTo.replace(' Agent', '').toLowerCase();
      const { data: agents } = await supabase
        .from('agent_statuses')
        .select('id')
        .eq('project_id', projectId)
        .eq('agent_type', agentType);
        
      const assignedToId = agents && agents.length > 0 ? agents[0].id : agentId;
      
      // Create the task
      await supabase
        .from('tasks')
        .insert([{
          project_id: projectId,
          title: taskInfo.title,
          description: taskInfo.description,
          assigned_to: assignedToId,
          status: 'pending',
          priority: taskInfo.priority.toLowerCase(),
          parent_task_id: task.id
        }]);
    }
    
    // Add a message about the created tasks
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `I've created ${tasksInfo.length} new tasks based on my work.`,
        sender: agentData.name,
        type: "text"
      }]);
  }
  
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: startResponse,
      sender: agentData.name,
      type: "text"
    }]);
    
  // Update agent progress to show we're working on the task
  await supabase
    .from('agent_statuses')
    .update({ progress: 70 })
    .eq('id', agentId);
    
  // Wait some time to simulate work
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Complete the task
  await supabase
    .from('tasks')
    .update({ 
      status: 'completed', 
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    })
    .eq('id', task.id);
    
  // Generate completion message using AI
  const completionResponse = await callOpenRouter(
    agentData.agent_type,
    `You've completed task: "${task.title}". Provide a summary of what you've accomplished and any recommendations for next steps.
    Consider how your work might affect other team members' tasks.`,
    { projectId, taskId: task.id, taskTitle: task.title, taskDescription: task.description }
  );
  
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: completionResponse,
      sender: agentData.name,
      type: "text"
    }]);
    
  // Update agent status to idle
  await supabase
    .from('agent_statuses')
    .update({ status: 'idle', progress: 100 })
    .eq('id', agentId);
    
  // Determine if a follow-up task is needed
  const needsFollowUp = Math.random() > 0.3; // 70% chance of follow-up
  
  if (needsFollowUp) {
    // Generate a follow-up task idea using AI
    const followUpPrompt = `Based on the completed task "${task.title}" (${task.description}), suggest a logical follow-up task that would be appropriate for your role as the ${agentData.agent_type} agent. Format your response as:
    TASK: [Title]
    ASSIGNED TO: [Agent Type] Agent
    DESCRIPTION: [Details]
    PRIORITY: [High/Medium/Low]`;
    
    try {
      const followUpResponse = await callOpenRouter(
        agentData.agent_type,
        followUpPrompt,
        { projectId, taskId: task.id, taskTitle: task.title, taskDescription: task.description }
      );
      
      // Extract task information
      const tasksInfo = extractTasksInfo(followUpResponse);
      
      if (tasksInfo.length > 0) {
        // Find the agent for the task
        const taskInfo = tasksInfo[0]; // Take the first suggested task
        const agentType = taskInfo.assignedTo.replace(' Agent', '').toLowerCase();
        
        const { data: agents } = await supabase
          .from('agent_statuses')
          .select('id')
          .eq('project_id', projectId)
          .eq('agent_type', agentType);
          
        const assignedToId = agents && agents.length > 0 ? agents[0].id : agentId;
        
        // Create the task
        const { data: newTask, error } = await supabase
          .from('tasks')
          .insert([{
            project_id: projectId,
            title: taskInfo.title,
            description: taskInfo.description,
            assigned_to: assignedToId,
            status: 'pending',
            priority: taskInfo.priority.toLowerCase(),
            parent_task_id: task.id
          }])
          .select()
          .single();
          
        if (!error && newTask) {
          // Announce the follow-up task creation
          const announcement = await callOpenRouter(
            agentData.agent_type,
            `You've identified a follow-up task: "${taskInfo.title}". Briefly explain why this task is important and how it relates to the work you just completed.`,
            { projectId, taskId: task.id, followUpTaskTitle: taskInfo.title }
          );
          
          await supabase
            .from('chat_messages')
            .insert([{
              project_id: projectId,
              content: announcement,
              sender: agentData.name,
              type: "text"
            }]);
        }
      }
    } catch (error) {
      console.error('Error creating follow-up task:', error);
    }
  }
  
  // Check for other pending tasks and work on them
  const { data: pendingTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .eq('assigned_to', agentId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);
    
  if (pendingTasks && pendingTasks.length > 0) {
    console.log(`Agent ${agentData.name} has another pending task: ${pendingTasks[0].title}`);
    
    // Update agent status back to working
    await supabase
      .from('agent_statuses')
      .update({ status: 'working', progress: 10 })
      .eq('id', agentId);
      
    // Process the next task after a short delay
    setTimeout(() => {
      processTask(projectId, agentId, agentData, pendingTasks[0]).catch(error => {
        console.error(`Error processing next task: ${error}`);
      });
    }, 5000);
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
  
  // Start with the architect agent for initial planning
  const architectAgent = agents.find(a => a.agent_type === 'architect');
  if (architectAgent) {
    // Update architect to working status
    await supabase
      .from('agent_statuses')
      .update({ status: 'working', progress: 20 })
      .eq('id', architectAgent.id);
      
    // Generate project kickoff message using AI
    const kickoffResponse = await callOpenRouter(
      'architect',
      `You're the architect for a new project named "${projectData.name}". ${projectData.description || ''} 
      Introduce yourself to the team and outline your initial thoughts on the architecture.
      Then, create a list of initial tasks that need to be assigned to different agents.
      Format task assignments as:
      1. [Task Title] - [Brief Description] - Assigned to: [Agent Type]`,
      { projectId, projectName: projectData.name, projectDescription: projectData.description }
    );
    
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: kickoffResponse,
        sender: architectAgent.name,
        type: 'text'
      }]);
      
    // Parse the architect's tasks and create them
    try {
      // Extract task assignments using regex
      const taskRegex = /\d+\.\s+(.+?)\s+-\s+(.+?)\s+-\s+Assigned to:\s+(\w+)/g;
      let match;
      const taskAssignments = [];
      
      while ((match = taskRegex.exec(kickoffResponse)) !== null) {
        taskAssignments.push({
          title: match[1].trim(),
          description: match[2].trim(),
          assignedTo: match[3].toLowerCase()
        });
      }
      
      // If no tasks were successfully parsed, create default tasks
      if (taskAssignments.length === 0) {
        await createInitialTasks(projectId, agents);
      } else {
        // Create the parsed tasks
        for (const taskAssignment of taskAssignments) {
          // Find the agent with matching type
          const agent = agents.find(a => 
            a.agent_type.toLowerCase() === taskAssignment.assignedTo ||
            a.agent_type.toLowerCase().includes(taskAssignment.assignedTo)
          );
          
          if (agent) {
            await supabase
              .from('tasks')
              .insert([{
                project_id: projectId,
                title: taskAssignment.title,
                description: taskAssignment.description,
                assigned_to: agent.id,
                status: 'pending',
                priority: 'high'
              }]);
              
            console.log(`Created task: ${taskAssignment.title} for agent: ${agent.id}`);
          }
        }
      }
    } catch (error) {
      console.error('Error creating tasks from architect response:', error);
      await createInitialTasks(projectId, agents);
    }
    
    // Update project progress
    await supabase
      .from('projects')
      .update({ progress: 30 })
      .eq('id', projectId);
      
    // Have each agent acknowledge their tasks
    for (const agent of agents) {
      if (agent.id !== architectAgent.id) {
        // Fetch tasks for this agent
        const { data: agentTasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('project_id', projectId)
          .eq('assigned_to', agent.id)
          .eq('status', 'pending');
          
        if (agentTasks && agentTasks.length > 0) {
          // Generate acknowledgment using AI
          const acknowledgment = await callOpenRouter(
            agent.agent_type,
            `You've been assigned ${agentTasks.length} task(s) for project "${projectData.name}":
            ${agentTasks.map((t, i) => `${i+1}. ${t.title}: ${t.description}`).join('\n')}
            
            Acknowledge these tasks and briefly mention how you plan to approach them.`,
            { projectId, projectName: projectData.name, agentTasks }
          );
          
          await supabase
            .from('chat_messages')
            .insert([{
              project_id: projectId,
              content: acknowledgment,
              sender: agent.name,
              type: 'text'
            }]);
        }
      }
    }
  }
  
  // Update project progress
  await supabase
    .from('projects')
    .update({ progress: 50 })
    .eq('id', projectId);
}

/**
 * Create initial tasks for agents if the architect doesn't specify them
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

// Utility functions for default task creation
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

// Function to extract code snippets from content
function extractCodeSnippets(content) {
  const snippets = [];
  const regex = /```filepath:(.*?)\n([\s\S]*?)```/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    snippets.push({
      filePath: match[1].trim(),
      code: match[2].trim()
    });
  }
  
  return snippets;
}

// Function to extract task information from content
function extractTasksInfo(content) {
  const tasks = [];
  const regex = /TASK: (.*?)\nASSIGNED TO: (.*?)\nDESCRIPTION: (.*?)\nPRIORITY: (.*?)(?:\n|$)/gs;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    tasks.push({
      title: match[1].trim(),
      assignedTo: match[2].trim(),
      description: match[3].trim(),
      priority: match[4].trim().toLowerCase()
    });
  }
  
  return tasks;
}

// Function to determine the language of a file based on its extension
function determineLanguage(filePath) {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'js':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'jsx':
      return 'jsx';
    case 'tsx':
      return 'tsx';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'py':
      return 'python';
    case 'rb':
      return 'ruby';
    case 'go':
      return 'go';
    case 'java':
      return 'java';
    case 'php':
      return 'php';
    case 'c':
      return 'c';
    case 'cpp':
      return 'cpp';
    case 'cs':
      return 'csharp';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'sh':
      return 'bash';
    case 'sql':
      return 'sql';
    default:
      return 'plaintext';
  }
}
