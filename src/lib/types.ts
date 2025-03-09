import { Json } from '@/integrations/supabase/types';

export type ProjectMode = "new" | "existing";

export type AgentStatus = "idle" | "working" | "completed" | "failed" | "waiting";
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed";
export type TaskPriority = "low" | "medium" | "high";

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
  techStack?: TechStack;
  repoUrl?: string;
  githubToken?: string;
  status?: string;
  sourceType?: string;
  sourceUrl?: string;
  progress?: number;
  tech_stack?: string[]; // For backward compatibility
  source_type?: string;  // For backward compatibility
  source_url?: string;   // For backward compatibility
  created_at?: string;
  updated_at?: string;
  requirements?: string;
  metadata?: Json | Record<string, any>; // Updated to accept both types
}

export type AgentType = 'architect' | 'frontend' | 'backend' | 'testing' | 'devops' | 'custom';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status?: AgentStatus;
  progress?: number;
  project_id?: string;
  description?: string;
  avatar?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Json | Record<string, any>; // Updated to accept both types
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
  status?: TaskStatus;
  assigned_to?: string;
  agent_id?: string; 
  project_id: string;
  dependencies?: string[];
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  metadata?: Json | Record<string, any>; // Updated to accept both types
}

export interface Message {
  id?: string;
  project_id: string;
  content: string;
  sender: string;
  type: string;
  code_language?: string;
  created_at?: string;
  timestamp?: string;
}

export interface CodeFile {
  id: string;
  name: string;
  path: string;
  content: string; // Making content required
  language?: string;
  created_by: string;
  last_modified_by: string; // Making last_modified_by required
  project_id: string; // Making project_id required
  created_at?: string;
  updated_at?: string;
}

// Database types (match Supabase structure)
// Make id optional in DB types since they are often auto-generated
export type ProjectDB = {
  id?: string; // Optional for inserts
  name: string;
  description?: string;
  tech_stack?: string[];
  source_type?: string;
  source_url?: string;
  status?: string;
  progress?: number;
  requirements?: string;
  metadata?: Json | Record<string, any>; // Updated to accept both types
};

export type AgentDB = Omit<Agent, 'type' | 'id'> & {
  id?: string; // Optional for inserts
  agent_type: AgentType;
  metadata?: Json | Record<string, any>; // Updated to accept both types
};

export type TaskDB = Omit<Task, 'id'> & {
  id?: string; // Optional for inserts
  agent_id?: string; 
  metadata?: Json | Record<string, any>; // Updated to accept both types
};

export type MessageDB = Message;

export type CodeFileDB = Omit<CodeFile, 'id'> & {
  id?: string; // Optional for inserts
};

// Add the SendAgentPromptOptions interface to the exported types
export interface SendAgentPromptOptions {
  model?: string;
  images?: string[];
  ignoreStatus?: boolean; // Option to bypass status check
  context?: string; // Additional context from other agents
  task?: string; // Specific task information
  expectCode?: boolean; // Signal that code output is expected
  useDirectSdk?: boolean; // Signal to use the SDK directly instead of edge function
}
