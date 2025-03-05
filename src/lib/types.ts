
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
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  agentId: string;
  createdAt: Date;
  updatedAt: Date;
  dependencies?: string[];
}

export type ProjectMode = 'new' | 'existing';

export interface Project {
  id: string;
  name: string;
  description: string;
  mode: ProjectMode;
  createdAt: Date;
  updatedAt: Date;
  techStack: {
    frontend?: string;
    backend?: string;
    database?: string;
    deployment?: string;
  };
  tasks: Task[];
}

export interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: Date;
  agentId?: string;
}
