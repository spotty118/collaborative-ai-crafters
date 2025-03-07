import { supabase } from "../_shared/supabase-client.ts";
import { 
  AgentData, 
  TaskData, 
  ProjectData, 
  CodeSnippet, 
  TaskInfo, 
  AgentType, 
  RequestBody 
} from "./types.ts";
// Import from direct ESM URLs instead of npm: specifiers for Deno compatibility
import { 
  Agent, 
  Crew, 
  Task, 
  Tool 
} from "https://esm.sh/crewai@1.0.1";
import { OpenAI } from "https://esm.sh/@langchain/openai@0.4.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get necessary environment variables
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? '';
if (!OPENROUTER_API_KEY) {
  console.error('Missing OPENROUTER_API_KEY environment variable');
}

function extractTasksInfo(content: string): TaskInfo[] {
  const tasks: TaskInfo[] = [];
  const pattern = /TASK:\s*([^\n]+)\s*ASSIGNED TO:\s*([^\n]+)\s*DESCRIPTION:\s*([^\n]+)\s*PRIORITY:\s*([^\n]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match[1] && match[2] && match[3] && match[4]) {
      tasks.push({
        title: match[1].trim(),
        assignedTo: match[2].trim(),
        description: match[3].trim(),
        priority: match[4].trim()
      });
    }
  }

  return tasks;
}

function extractCode(content: string): CodeSnippet[] {
  const snippets: CodeSnippet[] = [];
  const filepathPattern = /```(?:filepath:|\s*)([\w/.-]+)\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = filepathPattern.exec(content)) !== null) {
    if (match[1] && match[2]) {
      snippets.push({
        filePath: match[1].trim(),
        code: match[2].trim()
      });
    }
  }

  return snippets;
}

function isValidPath(path: string): boolean {
  return /^[\w/.-]+$/.test(path);
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const requestBody = JSON.parse(rawBody) as RequestBody;

    const { 
      projectId, 
      agentId = null, 
      action = 'start', 
      agents = [], 
      verbose = false 
    } = requestBody;

    if (!projectId) {
      throw new Error('Missing required field: projectId');
    }

    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) {
      throw new Error(`Failed to fetch project: ${projectError.message}`);
    }

    // Handle agent-specific data
    let agentData: AgentData | null = null;
    if (agentId) {
      const { data, error } = await supabase
        .from('agent_statuses')
        .select('*')
        .eq('id', agentId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch agent: ${error.message}`);
      }

      agentData = data as AgentData;
    }

    switch (action) {
      case 'start':
        await handleStartAction(projectId, projectData, agentId, agentData, verbose);
        break;
      case 'stop':
        await handleStopAction(projectId, projectData, agentId, agentData);
        break;
      case 'team_collaborate':
        await handleTeamCollaboration(projectId, projectData, agents, verbose);
        break;
      case 'initialize':
        await handleInitializeAction(projectId, projectData, requestBody.temperature);
        break;
      case 'update':
        await handleUpdateAction(projectId, projectData, requestBody.updates);
        break;
      case 'complete_task':
        await handleCompleteTaskAction(projectId, requestBody.taskId, requestBody.result);
        break;
      default:
        throw new Error(`Invalid action: ${action}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Operation ${action} completed successfully`,
        project: projectData.name,
        agent: agentData?.name ?? null,
        verbose
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleStartAction(
  projectId: string,
  projectData: ProjectData,
  agentId: string | null,
  agentData: AgentData | null,
  verbose: boolean
): Promise<void> {
  const agentName = agentData?.name ?? 'Unknown Agent';
  await supabase.from('chat_messages').insert([{
    project_id: projectId,
    content: agentId
      ? `Starting ${agentName} for project: ${projectData.name} (verbose=${verbose})`
      : `CrewAI orchestration started for project: ${projectData.name} (verbose=${verbose})`,
    sender: agentId ? agentName : 'System',
    type: 'text'
  }]);
}

async function handleStopAction(
  projectId: string,
  projectData: ProjectData,
  agentId: string | null,
  agentData: AgentData | null
): Promise<void> {
  const agentName = agentData?.name ?? 'Unknown Agent';
  await supabase.from('chat_messages').insert([{
    project_id: projectId,
    content: agentId
      ? `Stopping ${agentName} for project: ${projectData.name}`
      : `CrewAI orchestration stopped for project: ${projectData.name}`,
    sender: agentId ? agentName : 'System',
    type: 'text'
  }]);
}

async function handleTeamCollaboration(
  projectId: string,
  projectData: ProjectData,
  agents: AgentData[],
  verbose: boolean
): Promise<void> {
  await supabase.from('chat_messages').insert([{
    project_id: projectId,
    content: `Team collaboration started for project: ${projectData.name}`,
    sender: 'System',
    type: 'text'
  }]);

  try {
    // Set up OpenAI API client with OpenRouter
    const model = new OpenAI({
      temperature: 0.3,
      openAIApiKey: OPENROUTER_API_KEY,
      modelName: "openai/gpt-4-turbo"
    });

    // Create CrewAI agents
    const crewAgents = await createCrewAgents(agents, model, projectData);
    
    // Create CrewAI tasks
    const crewTasks = await createCrewTasks(projectId, crewAgents, projectData);
    
    // Initialize the crew
    const crew = new Crew({
      agents: crewAgents,
      tasks: crewTasks,
      verbose: verbose,
      process: "sequential"
    });

    // Execute the crew tasks
    const result = await crew.kickoff();
    
    // Log results and update database
    console.log("CrewAI execution completed:", result);
    await processCrewResults(projectId, result);
    
    // Update agent statuses
    for (const agent of agents) {
      try {
        await supabase
          .from('agent_statuses')
          .update({ status: 'completed', progress: 100 })
          .eq('id', agent.id);
      } catch (error) {
        console.error(`Failed to update agent ${agent.name} status:`, error);
      }
    }

  } catch (error) {
    console.error(`Failed to execute CrewAI team collaboration:`, error);
    
    // Update agent statuses to error
    for (const agent of agents) {
      try {
        await supabase
          .from('agent_statuses')
          .update({ status: 'error', progress: 0 })
          .eq('id', agent.id);
      } catch (updateError) {
        console.error(`Failed to update agent ${agent.name} status:`, updateError);
      }
    }
    
    throw error;
  }
}

/**
 * Create CrewAI agents from agent data
 */
async function createCrewAgents(
  agents: AgentData[], 
  model: OpenAI,
  projectData: ProjectData
): Promise<Agent[]> {
  const crewAgents: Agent[] = [];
  
  for (const agent of agents) {
    const agentType = agent.agent_type || agent.type;
    
    let role = "";
    let goal = "";
    
    // Define agent roles and goals based on type
    switch(agentType) {
      case 'architect':
        role = "Software Architect";
        goal = "Design the overall system architecture and guide the development team";
        break;
      case 'frontend':
        role = "Frontend Developer";
        goal = "Implement the user interface and client-side functionality";
        break;
      case 'backend':
        role = "Backend Developer";
        goal = "Implement server-side logic, APIs, and database interactions";
        break;
      case 'testing':
        role = "QA Tester";
        goal = "Ensure the application works correctly and find potential issues";
        break;
      case 'devops':
        role = "DevOps Engineer";
        goal = "Set up deployment pipelines and infrastructure";
        break;
    }
    
    // Create a CrewAI agent
    const crewAgent = new Agent({
      name: agent.name,
      role: role,
      goal: goal,
      backstory: `You are working on project "${projectData.name}". ${projectData.description || ''}`,
      verbose: true,
      llm: model
    });
    
    crewAgents.push(crewAgent);
  }
  
  return crewAgents;
}

/**
 * Create CrewAI tasks for agents
 */
async function createCrewTasks(
  projectId: string,
  crewAgents: Agent[],
  projectData: ProjectData
): Promise<Task[]> {
  const tasks: Task[] = [];
  
  // Fetch project tasks from database if available
  const { data: projectTasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'pending');
    
  if (error) {
    console.error('Error fetching project tasks:', error);
  }
  
  // Map agents by name for easy lookup
  const agentMap = new Map<string, Agent>();
  for (const agent of crewAgents) {
    agentMap.set(agent.name, agent);
  }
  
  // Create CrewAI tasks from project tasks or create default tasks
  if (projectTasks && projectTasks.length > 0) {
    for (const task of projectTasks) {
      // Find the corresponding agent
      const agent = crewAgents.find(a => a.name.toLowerCase().includes(task.assigned_to.toLowerCase()));
      
      if (agent) {
        tasks.push(new Task({
          description: `${task.title}: ${task.description}`,
          agent: agent
        }));
      }
    }
  } else {
    // Create default tasks if no tasks are defined
    for (const agent of crewAgents) {
      if (agent.name.toLowerCase().includes('architect')) {
        tasks.push(new Task({
          description: `Design the overall architecture for ${projectData.name}`,
          agent: agent
        }));
      } else if (agent.name.toLowerCase().includes('frontend')) {
        tasks.push(new Task({
          description: `Design the user interface for ${projectData.name}`,
          agent: agent
        }));
      } else if (agent.name.toLowerCase().includes('backend')) {
        tasks.push(new Task({
          description: `Design the API and database schema for ${projectData.name}`,
          agent: agent
        }));
      }
    }
  }
  
  return tasks;
}

/**
 * Process the results from CrewAI execution
 */
async function processCrewResults(projectId: string, result: any): Promise<void> {
  await supabase.from('chat_messages').insert([{
    project_id: projectId,
    content: JSON.stringify(result),
    sender: 'CrewAI',
    type: 'text'
  }]);
  
  // Extract code snippets if any
  const snippets = extractCode(JSON.stringify(result));
  
  if (snippets.length > 0) {
    // Store snippets in the database
    await supabase.from('code_snippets').insert(
      snippets.map(snippet => ({
        project_id: projectId,
        file_path: snippet.filePath,
        content: snippet.code,
        created_at: new Date().toISOString()
      }))
    );
  }
  
  // Extract tasks if any
  const tasks = extractTasksInfo(JSON.stringify(result));
  
  if (tasks.length > 0) {
    // Store tasks in the database
    await supabase.from('tasks').insert(
      tasks.map(task => ({
        project_id: projectId,
        title: task.title,
        description: task.description,
        status: 'pending',
        priority: task.priority.toLowerCase(),
        assigned_to: task.assignedTo,
        created_at: new Date().toISOString()
      }))
    );
  }
}

async function startAgent(
  projectId: string,
  agent: AgentData,
  verbose: boolean
): Promise<void> {
  await supabase
    .from('agent_statuses')
    .update({ status: 'working', progress: 0 })
    .eq('id', agent.id);

  console.log(`Started agent ${agent.name} (verbose=${verbose})`);
}

/**
 * Handle initialize action for CrewAI
 */
async function handleInitializeAction(
  projectId: string,
  projectData: ProjectData,
  temperature?: number
): Promise<void> {
  console.log(`Initializing CrewAI for project ${projectId} with temperature ${temperature || 0.3}`);
  
  await supabase.from('chat_messages').insert([{
    project_id: projectId,
    content: `Initializing CrewAI orchestration for project: ${projectData.name}`,
    sender: 'System',
    type: 'text'
  }]);
  
  // Set up the initial agent statuses
  const agentTypes: AgentType[] = ['architect', 'frontend', 'backend', 'testing', 'devops'];
  
  for (const type of agentTypes) {
    const { data: existingAgent } = await supabase
      .from('agent_statuses')
      .select('*')
      .eq('project_id', projectId)
      .eq('agent_type', type)
      .maybeSingle();
      
    if (!existingAgent) {
      await supabase.from('agent_statuses').insert([{
        project_id: projectId,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Agent`,
        agent_type: type,
        status: 'idle',
        progress: 0
      }]);
    }
  }
}

/**
 * Handle update action for CrewAI
 */
async function handleUpdateAction(
  projectId: string,
  projectData: ProjectData,
  updates: unknown
): Promise<void> {
  console.log(`Updating CrewAI for project ${projectId}`, updates);
  
  await supabase.from('chat_messages').insert([{
    project_id: projectId,
    content: `Updating CrewAI orchestration for project: ${projectData.name}`,
    sender: 'System',
    type: 'text'
  }]);
  
  // Here you would apply the updates based on the updates parameter
  // This is a placeholder implementation
}

/**
 * Handle task completion action
 */
async function handleCompleteTaskAction(
  projectId: string,
  taskId?: string,
  result?: unknown
): Promise<void> {
  if (!taskId) {
    throw new Error('Missing required field: taskId');
  }
  
  console.log(`Handling task completion for project ${projectId}, task ${taskId}`);
  
  // Update the task status
  await supabase
    .from('tasks')
    .update({ 
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', taskId);
    
  // Add result to chat
  await supabase.from('chat_messages').insert([{
    project_id: projectId,
    content: `Task ${taskId} completed${result ? ': ' + JSON.stringify(result) : ''}`,
    sender: 'System',
    type: 'text'
  }]);
}

// Use the built-in Deno Deploy handler
Deno.serve(async (request: Request) => {
  try {
    return await handleRequest(request);
  } catch (error) {
    console.error('Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
