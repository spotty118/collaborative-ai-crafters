
import { supabase } from "@/lib/supabase";
import { 
  Project, Agent, Task, Message, CodeFile, 
  AgentType, AgentStatus, TaskStatus, TaskPriority,
  ProjectDB, AgentDB, TaskDB, MessageDB, CodeFileDB, MessageType
} from "./types";

// Projects API
export const getProjects = async (): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return (data || []).map(item => ({
    id: item.id,
    name: item.name,
    description: item.description || '',
    status: item.status,
    progress: item.progress || 0,
    tech_stack: item.tech_stack || [],
    sourceType: item.source_type,
    sourceUrl: item.source_url,
    requirements: item.requirements,
    created_at: item.created_at,
    updated_at: item.updated_at,
    mode: item.source_type ? 'existing' : 'new',
    techStack: {
      frontend: item.tech_stack?.[0] || '',
      backend: item.tech_stack?.[1] || '',
      database: item.tech_stack?.[2] || '',
      deployment: item.tech_stack?.[3] || ''
    }
  }));
};

export const getProject = async (id: string): Promise<Project | null> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  
  if (!data) return null;
  
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
    mode: data.source_type ? 'existing' : 'new',
    techStack: {
      frontend: data.tech_stack?.[0] || '',
      backend: data.tech_stack?.[1] || '',
      database: data.tech_stack?.[2] || '',
      deployment: data.tech_stack?.[3] || ''
    }
  };
};

export const createProject = async (project: ProjectDB): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .insert([project])
    .select()
    .single();
  
  if (error) throw error;
  
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
    mode: data.source_type ? 'existing' : 'new',
    techStack: {
      frontend: data.tech_stack?.[0] || '',
      backend: data.tech_stack?.[1] || '',
      database: data.tech_stack?.[2] || '',
      deployment: data.tech_stack?.[3] || ''
    }
  };
};

export const updateProject = async (id: string, updates: Partial<ProjectDB>): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
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
    mode: data.source_type ? 'existing' : 'new',
    techStack: {
      frontend: data.tech_stack?.[0] || '',
      backend: data.tech_stack?.[1] || '',
      database: data.tech_stack?.[2] || '',
      deployment: data.tech_stack?.[3] || ''
    }
  };
};

export const deleteProject = async (id: string): Promise<void> => {
  const projectExists = await checkProjectExists(id);
  if (!projectExists) {
    throw new Error('Project not found');
  }

  const { error: agentError } = await supabase
    .from('agent_statuses')
    .delete()
    .eq('project_id', id);
    
  if (agentError) throw agentError;
  
  const { error: taskError } = await supabase
    .from('tasks')
    .delete()
    .eq('project_id', id);
    
  if (taskError) throw taskError;
  
  const { error: messageError } = await supabase
    .from('chat_messages')
    .delete()
    .eq('project_id', id);
    
  if (messageError) throw messageError;
  
  const { error: codeFileError } = await supabase
    .from('code_files')
    .delete()
    .eq('project_id', id);
    
  if (codeFileError) throw codeFileError;
  
  const { error: projectError } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);
    
  if (projectError) throw projectError;
};

export const checkProjectExists = async (id: string | number): Promise<boolean> => {
  const projectId = typeof id === 'number' ? id.toString() : id;
  
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .single();
  
  if (error) return false;
  return !!data;
};

// Agents API
export const getAgents = async (projectId: string): Promise<Agent[]> => {
  const { data, error } = await supabase
    .from('agent_statuses')
    .select('*')
    .eq('project_id', projectId);
  
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

export const createAgents = async (projectId: string): Promise<Agent[]> => {
  const defaultAgents: AgentDB[] = [
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
  const dbUpdates: Partial<AgentDB> = {};
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
    id: task.id,
    title: task.title,
    description: task.description || '',
    status: task.status as TaskStatus,
    assigned_to: task.assigned_to,
    priority: task.priority as TaskPriority,
    project_id: task.project_id,
    created_at: task.created_at,
    updated_at: task.updated_at,
    completed_at: task.completed_at,
    dependencies: task.dependencies || []
  }));
};

export const createTask = async (task: TaskDB): Promise<Task> => {
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
    dependencies: data.dependencies || []
  };
};

export const updateTask = async (id: string, updates: Partial<TaskDB>): Promise<Task> => {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
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
    dependencies: data.dependencies || []
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
  
  return (data || []).map(msg => ({
    id: msg.id,
    content: msg.content,
    sender: msg.sender,
    type: msg.type as MessageType,
    code_language: msg.code_language,
    project_id: msg.project_id,
    created_at: msg.created_at
  }));
};

export const createMessage = async (message: MessageDB): Promise<Message> => {
  if (!message.content || !message.project_id || !message.sender) {
    throw new Error("Message must have content, project_id, and sender");
  }
  
  const { data, error } = await supabase
    .from('chat_messages')
    .insert([{
      content: message.content,
      project_id: message.project_id,
      sender: message.sender,
      type: message.type || 'text' as MessageType,
      code_language: message.code_language
    }])
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    content: data.content,
    sender: data.sender,
    type: data.type as MessageType,
    code_language: data.code_language,
    project_id: data.project_id,
    created_at: data.created_at
  };
};

// Code Files API
export const getCodeFiles = async (projectId: string): Promise<CodeFile[]> => {
  const { data, error } = await supabase
    .from('code_files')
    .select('*')
    .eq('project_id', projectId)
    .order('path', { ascending: true });
  
  if (error) throw error;
  
  return (data || []).map(file => ({
    id: file.id,
    name: file.name,
    path: file.path,
    content: file.content,
    language: file.language,
    created_by: file.created_by,
    last_modified_by: file.last_modified_by,
    project_id: file.project_id,
    created_at: file.created_at,
    updated_at: file.updated_at
  }));
};

export const createCodeFile = async (file: CodeFileDB): Promise<CodeFile> => {
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
  
  return {
    id: data.id,
    name: data.name,
    path: data.path,
    content: data.content,
    language: data.language,
    created_by: data.created_by,
    last_modified_by: data.last_modified_by,
    project_id: data.project_id,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
};

export const updateCodeFile = async (id: string, updates: Partial<CodeFileDB>): Promise<CodeFile> => {
  const { data, error } = await supabase
    .from('code_files')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    name: data.name,
    path: data.path,
    content: data.content,
    language: data.language,
    created_by: data.created_by,
    last_modified_by: data.last_modified_by,
    project_id: data.project_id,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
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
