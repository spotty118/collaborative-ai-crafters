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

  for (const agent of agents) {
    // Make sure we have both agent_type and type properties
    const agentType = agent.agent_type || agent.type;
    if (agentType === 'architect') continue;
    
    try {
      await startAgent(projectId, agent, verbose);
    } catch (error) {
      console.error(`Failed to start agent ${agent.name}:`, error);
    }
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
