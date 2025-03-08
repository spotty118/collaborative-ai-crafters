
import { supabase } from "@/integrations/supabase/client";
import {
  Project, ProjectDB, Agent, AgentDB, Task, TaskDB,
  AgentType, TaskPriority, TaskStatus, AgentStatus
} from "@/lib/types";
import { Json } from "@/integrations/supabase/types";

export const getProjectById = async (projectId: string): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  
  if (error) {
    console.error('Error fetching project:', error);
    throw error;
  }
  
  // Transform the database record to the Project type
  return {
    id: data.id,
    name: data.name,
    description: data.description || '',
    status: data.status,
    progress: data.progress || 0,
    tech_stack: data.tech_stack || [],
    sourceType: data.source_type,
    sourceUrl: data.source_url,
    requirements: data.requirements,
    created_at: data.created_at,
    updated_at: data.updated_at,
    metadata: data.metadata,
    mode: data.source_type ? 'existing' : 'new',
    techStack: {
      frontend: data.tech_stack?.[0] || '',
      backend: data.tech_stack?.[1] || '',
      database: data.tech_stack?.[2] || '',
      deployment: data.tech_stack?.[3] || ''
    }
  };
};

export const updateProjectMetadata = async (projectId: string, metadata: any): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .update({ metadata })
    .eq('id', projectId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating project metadata:', error);
    throw error;
  }
  
  // Transform the database record to the Project type
  return {
    id: data.id,
    name: data.name,
    description: data.description || '',
    status: data.status,
    progress: data.progress || 0,
    tech_stack: data.tech_stack || [],
    sourceType: data.source_type,
    sourceUrl: data.source_url,
    requirements: data.requirements,
    created_at: data.created_at,
    updated_at: data.updated_at,
    metadata: data.metadata,
    mode: data.source_type ? 'existing' : 'new',
    techStack: {
      frontend: data.tech_stack?.[0] || '',
      backend: data.tech_stack?.[1] || '',
      database: data.tech_stack?.[2] || '',
      deployment: data.tech_stack?.[3] || ''
    }
  };
};

export const createAgentWithMetadata = async (
  projectId: string,
  agentType: AgentType,
  name: string,
  description: string,
  metadata: any
): Promise<Agent> => {
  const agentData: AgentDB = {
    project_id: projectId,
    agent_type: agentType,
    name,
    description,
    status: 'idle' as AgentStatus,
    progress: 0,
    metadata
  };
  
  const { data, error } = await supabase
    .from('agent_statuses')
    .insert([agentData])
    .select()
    .single();
  
  if (error) {
    console.error('Error creating agent:', error);
    throw error;
  }
  
  // Transform the database record to the Agent type
  return {
    id: data.id,
    type: data.agent_type as AgentType,
    name: data.name,
    description: data.description || '',
    status: data.status as AgentStatus,
    progress: data.progress || 0,
    project_id: data.project_id,
    metadata: data.metadata,
    avatar: getAgentAvatar(data.agent_type as AgentType)
  };
};

export const getAgentsByProjectId = async (projectId: string): Promise<Agent[]> => {
  const { data, error } = await supabase
    .from('agent_statuses')
    .select('*')
    .eq('project_id', projectId);
  
  if (error) {
    console.error('Error fetching agents:', error);
    throw error;
  }
  
  // Transform the database records to Agent types
  return (data || []).map(agent => ({
    id: agent.id,
    type: agent.agent_type as AgentType, // Add type property
    name: agent.name,
    description: agent.description || '',
    status: agent.status as AgentStatus,
    progress: agent.progress || 0,
    project_id: agent.project_id,
    metadata: agent.metadata,
    avatar: getAgentAvatar(agent.agent_type as AgentType)
  }));
};

export const updateAgentMetadata = async (agentId: string, metadata: any): Promise<Agent> => {
  const { data, error } = await supabase
    .from('agent_statuses')
    .update({ metadata })
    .eq('id', agentId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating agent metadata:', error);
    throw error;
  }
  
  // Transform the database record to the Agent type
  return {
    id: data.id,
    type: data.agent_type as AgentType,
    name: data.name,
    description: data.description || '',
    status: data.status as AgentStatus,
    progress: data.progress || 0,
    project_id: data.project_id,
    metadata: data.metadata,
    avatar: getAgentAvatar(data.agent_type as AgentType)
  };
};

export const createTaskWithMetadata = async (
  projectId: string,
  title: string,
  description: string,
  priority: TaskPriority,
  assignedTo: string,
  metadata: any
): Promise<Task> => {
  const taskData: TaskDB = {
    project_id: projectId,
    title,
    description,
    priority,
    assigned_to: assignedTo,
    status: 'pending' as TaskStatus,
    metadata
  };
  
  const { data, error } = await supabase
    .from('tasks')
    .insert([taskData])
    .select()
    .single();
  
  if (error) {
    console.error('Error creating task:', error);
    throw error;
  }
  
  // Transform the database record to the Task type
  return {
    id: data.id,
    title: data.title,
    description: data.description || '',
    status: data.status as TaskStatus,
    assigned_to: data.assigned_to,
    priority: data.priority as TaskPriority,
    project_id: data.project_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
    completed_at: data.completed_at,
    dependencies: data.dependencies || [],
    metadata: data.metadata
  };
};

export const updateTaskMetadata = async (taskId: string, metadata: any): Promise<Task> => {
  const { data, error } = await supabase
    .from('tasks')
    .update({ metadata })
    .eq('id', taskId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating task metadata:', error);
    throw error;
  }
  
  // Transform the database record to the Task type
  return {
    id: data.id,
    title: data.title,
    description: data.description || '',
    status: data.status as TaskStatus,
    assigned_to: data.assigned_to,
    priority: data.priority as TaskPriority,
    project_id: data.project_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
    completed_at: data.completed_at,
    dependencies: data.dependencies || [],
    metadata: data.metadata
  };
};

// Helper to get the correct crewId from metadata
export const getCrewId = (metadata: Json): string | null => {
  if (!metadata) return null;
  
  // Check if metadata is an object with a crewai_id property
  if (typeof metadata === 'object' && metadata !== null && 'crewai_id' in metadata) {
    return (metadata as any).crewai_id;
  }
  
  return null;
};

// Helper to get a project's CrewAI ID
export const getProjectCrewId = async (projectId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('projects')
    .select('metadata')
    .eq('id', projectId)
    .single();
  
  if (error || !data) {
    console.error('Error fetching project metadata:', error);
    return null;
  }
  
  return getCrewId(data.metadata);
};

// Helper to get an agent's CrewAI ID
export const getAgentCrewId = async (agentId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('agent_statuses')
    .select('metadata')
    .eq('id', agentId)
    .single();
  
  if (error || !data) {
    console.error('Error fetching agent metadata:', error);
    return null;
  }
  
  return getCrewId(data.metadata);
};

// Helper function to get agent avatars
function getAgentAvatar(agentType: AgentType): string {
  switch (agentType) {
    case 'architect': return '👨‍💻';
    case 'frontend': return '🎨';
    case 'backend': return '🔧';
    case 'testing': return '🧪';
    case 'devops': return '🚀';
    default: return '🤖';
  }
}
