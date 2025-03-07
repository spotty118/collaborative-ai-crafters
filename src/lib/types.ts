export type ProjectMode = "new" | "existing";

export type AgentStatus = "idle" | "working" | "completed" | "failed" | "waiting" | "running";
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed";
export type TaskPriority = "low" | "medium" | "high";
export type MessageType = "text" | "code" | "task" | "error" | "progress" | "notification" | "request" | "response";

export interface TechStack {
  frontend: string;
  backend: string;
  database: string;
  deployment: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  mode: ProjectMode;
  techStack: TechStack;
  repoUrl?: string;
  status?: string;
  sourceType?: string;
  sourceUrl?: string;
  progress?: number;
  tech_stack?: string[]; // For backward compatibility
  // Additional fields needed based on API usage
  created_at?: string;
  updated_at?: string;
  requirements?: string;
  agents?: Agent[]; // Adding the agents array property to fix TypeScript errors
}

// Database interfaces
export interface ProjectDB {
  name: string;
  description: string;
  status?: string;
  progress?: number;
  tech_stack?: string[];
  source_type?: string;
  source_url?: string;
  requirements?: string;
}

export type AgentType = 'architect' | 'frontend' | 'backend' | 'testing' | 'devops';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  description?: string;
  progress?: number;
  project_id?: string;
  avatar?: string;
}

export interface AgentDB {
  project_id: string;
  agent_type: AgentType;
  name: string;
  description?: string;
  status: AgentStatus;
  progress: number;
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export interface GitHubFile {
  path: string;
  content: string;
  sha?: string;
}

export interface GitHubCommit {
  message: string;
  files: GitHubFile[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority?: TaskPriority;
  status: TaskStatus;
  assigned_to?: string;
  project_id: string;
  updated_at: string;
  created_at?: string;
  completed_at?: string;
  dependencies?: string[];
}

export interface TaskDB {
  title: string;
  description: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  assigned_to?: string;
  project_id: string;
  dependencies?: string[];
}

export interface Message {
  id?: string;
  project_id: string;
  content: string;
  sender: string;
  type: MessageType;
  code_language?: string;
  created_at?: string;
  timestamp?: string;
}

export interface MessageDB {
  project_id: string;
  content: string;
  sender: string;
  type: MessageType;
  code_language?: string;
}

export interface CodeFile {
  id: string;
  name: string;
  path: string;
  content?: string;
  language?: string;
  created_by: string;
  last_modified_by?: string;
  project_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CodeFileDB {
  name: string;
  path: string;
  content: string;
  language?: string;
  created_by: string;
  last_modified_by: string;
  project_id: string;
}
