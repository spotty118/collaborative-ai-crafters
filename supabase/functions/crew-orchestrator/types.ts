
export interface AgentData {
  id: string;
  name: string;
  agent_type?: string;
  type?: string;
  status?: string;
  description?: string;
  progress?: number;
  project_id?: string;
}

export interface TaskData {
  id: string;
  title: string;
  description: string;
  status: string;
  priority?: string;
  assigned_to?: string;
  dependencies?: string[];
  project_id: string;
}

export interface ProjectData {
  id: string;
  name: string;
  description?: string;
  status?: string;
  progress?: number;
  tech_stack?: string[];
  source_type?: string;
  source_url?: string;
}

export interface CodeSnippet {
  filePath: string;
  code: string;
}

export interface TaskInfo {
  title: string;
  assignedTo: string;
  description: string;
  priority: string;
}

export type AgentType = 'architect' | 'frontend' | 'backend' | 'testing' | 'devops';

export interface RequestBody {
  projectId: string;
  agentId?: string;
  action?: 'start' | 'stop' | 'team_collaborate' | 'initialize' | 'update' | 'complete_task';
  agents?: AgentData[];
  verbose?: boolean;
  task?: string;
  projectName?: string;
  description?: string;
  techStack?: any;
  temperature?: number;
  updates?: any;
  taskId?: string;
  result?: any;
  agentType?: string;
}
