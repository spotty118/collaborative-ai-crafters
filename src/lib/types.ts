
export type AgentType = 'architect' | 'frontend' | 'backend' | 'testing' | 'devops';

export type AgentStatus = 'idle' | 'working' | 'completed' | 'failed' | 'waiting';

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  status: AgentStatus;
  progress: number;
  avatar?: string;
  project_id?: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigned_to?: string;
  priority: 'low' | 'medium' | 'high';
  project_id: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  dependencies?: string[];
}

export type ProjectMode = 'new' | 'existing';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  progress: number;
  tech_stack: string[];
  source_type?: string;
  source_url?: string;
  requirements?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  content: string;
  sender: string;
  type: string;
  code_language?: string;
  project_id: string;
  created_at: Date;
}

export interface CodeFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language?: string;
  created_by: string;
  last_modified_by: string;
  project_id: string;
  created_at: Date;
  updated_at: Date;
}
