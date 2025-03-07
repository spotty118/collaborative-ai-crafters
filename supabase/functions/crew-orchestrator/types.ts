// Deno and Request types
declare global {
  interface DenoNamespace {
    serve(handler: (request: Request) => Promise<Response> | Response): void;
    env: {
      get(key: string): string | undefined;
      set(key: string, value: string): void;
    };
  }

  const Deno: DenoNamespace;
}

// Agent types and statuses
export type AgentType = 'architect' | 'frontend' | 'backend' | 'testing' | 'devops';
export type AgentStatus = 'idle' | 'working' | 'completed' | 'error';

export interface AgentData {
  id: string;
  name: string;
  agent_type: AgentType;
  type: AgentType;  // Some parts of the code use type, others use agent_type
  status?: AgentStatus;
  progress?: number;
  project_id?: string;
}

// Task related types
export interface TaskData {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  project_id: string;
  assigned_to: string;
  parent_task_id?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
}

export interface TaskInfo {
  title: string;
  assignedTo: string;
  description: string;
  priority: string;
}

// Project related types
export interface ProjectData {
  id: string;
  name: string;
  description?: string;
  status?: string;
}

// Code related types
export interface CodeSnippet {
  filePath: string;
  code: string;
}

// Request body type
export interface RequestBody {
  projectId: string;
  agentId?: string;
  taskId?: string;
  action?: 'start' | 'stop' | 'team_collaborate';
  agents?: AgentData[];
  projectContext?: Record<string, unknown>;
  autostart?: boolean;
  verbose?: boolean;
}

// Export to make the file a module
export {};