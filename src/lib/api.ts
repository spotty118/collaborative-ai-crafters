
import { supabase } from "@/integrations/supabase/client";
import { Project, Agent, Task, Message, CodeFile, AgentType, AgentStatus, TaskStatus } from "./types";

// Projects API
export const getProjects = async (): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const getProject = async (id: string): Promise<Project | null> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data;
};

export const createProject = async (project: Partial<Omit<Project, 'created_at' | 'updated_at'>>): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .insert([project])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateProject = async (id: string, updates: Partial<Omit<Project, 'created_at' | 'updated_at'>>): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Agents API
export const getAgents = async (projectId: string): Promise<Agent[]> => {
  const { data, error } = await supabase
    .from('agent_statuses')
    .select('*')
    .eq('project_id', projectId);
  
  if (error) throw error;
  
  // Transform from DB schema to our app types
  return (data || []).map(agent => ({
    id: agent.id,
    type: agent.agent_type as AgentType,
    name: agent.name,
    description: agent.description || '',
    status: agent.status as AgentStatus,
    progress: agent.progress || 0,
    project_id: agent.project_id,
    avatar: getAgentAvatar(agent.agent_type as AgentType),
  }));
};

export const createAgents = async (projectId: string): Promise<Agent[]> => {
  const defaultAgents = [
    {
      project_id: projectId,
      agent_type: 'architect',
      name: 'Architect Agent',
      description: 'Designs system architecture and project structure',
      status: 'idle',
      progress: 0
    },
    {
      project_id: projectId,
      agent_type: 'frontend',
      name: 'Frontend Agent',
      description: 'Builds UI components and client-side functionality',
      status: 'idle',
      progress: 0
    },
    {
      project_id: projectId,
      agent_type: 'backend',
      name: 'Backend Agent',
      description: 'Develops APIs and database models',
      status: 'idle',
      progress: 0
    },
    {
      project_id: projectId,
      agent_type: 'testing',
      name: 'Testing Agent',
      description: 'Creates tests and ensures quality',
      status: 'idle',
      progress: 0
    },
    {
      project_id: projectId,
      agent_type: 'devops',
      name: 'DevOps Agent',
      description: 'Handles deployment and CI/CD setup',
      status: 'idle',
      progress: 0
    }
  ];

  const { data, error } = await supabase
    .from('agent_statuses')
    .insert(defaultAgents)
    .select();
  
  if (error) throw error;
  
  return (data || []).map(agent => ({
    id: agent.id,
    type: agent.agent_type as AgentType,
    name: agent.name,
    description: agent.description || '',
    status: agent.status as AgentStatus,
    progress: agent.progress || 0,
    project_id: agent.project_id,
    avatar: getAgentAvatar(agent.agent_type as AgentType),
  }));
};

export const updateAgent = async (id: string, updates: Partial<Agent>): Promise<Agent> => {
  // Transform our app types to DB schema
  const dbUpdates: any = {};
  if (updates.status) dbUpdates.status = updates.status;
  if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
  if (updates.description) dbUpdates.description = updates.description;
  if (updates.name) dbUpdates.name = updates.name;
  if (updates.type) dbUpdates.agent_type = updates.type;

  const { data, error } = await supabase
    .from('agent_statuses')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    type: data.agent_type as AgentType,
    name: data.name,
    description: data.description || '',
    status: data.status as AgentStatus,
    progress: data.progress || 0,
    project_id: data.project_id,
    avatar: getAgentAvatar(data.agent_type as AgentType),
  };
};

// Tasks API
export const getTasks = async (projectId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return (data || []).map(task => ({
    ...task,
    status: task.status as TaskStatus
  }));
};

export const createTask = async (task: Omit<Partial<Task>, 'created_at' | 'updated_at' | 'completed_at'>): Promise<Task> => {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{
      ...task,
      status: task.status || 'pending'
    }])
    .select()
    .single();
  
  if (error) throw error;
  return {
    ...data,
    status: data.status as TaskStatus
  };
};

export const updateTask = async (id: string, updates: Omit<Partial<Task>, 'created_at' | 'updated_at' | 'completed_at'>): Promise<Task> => {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return {
    ...data,
    status: data.status as TaskStatus
  };
};

// Messages API
export const getMessages = async (projectId: string): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const createMessage = async (message: Omit<Partial<Message>, 'created_at'>): Promise<Message> => {
  if (!message.content || !message.project_id || !message.sender) {
    throw new Error("Message must have content, project_id, and sender");
  }
  
  const { data, error } = await supabase
    .from('chat_messages')
    .insert([{
      content: message.content,
      project_id: message.project_id,
      sender: message.sender,
      type: message.type || 'text',
      code_language: message.code_language
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Code Files API
export const getCodeFiles = async (projectId: string): Promise<CodeFile[]> => {
  const { data, error } = await supabase
    .from('code_files')
    .select('*')
    .eq('project_id', projectId)
    .order('path', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const createCodeFile = async (file: Omit<Partial<CodeFile>, 'created_at' | 'updated_at'>): Promise<CodeFile> => {
  if (!file.content || !file.created_by || !file.last_modified_by || 
      !file.name || !file.path || !file.project_id) {
    throw new Error("Code file missing required fields");
  }
  
  const { data, error } = await supabase
    .from('code_files')
    .insert([file])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateCodeFile = async (id: string, updates: Omit<Partial<CodeFile>, 'created_at' | 'updated_at'>): Promise<CodeFile> => {
  const { data, error } = await supabase
    .from('code_files')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Utility functions
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
