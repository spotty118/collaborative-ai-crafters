export type ProjectMode = "new" | "existing";

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

export interface CodeFile {
  id: string;
  name: string;
  path: string;
  content?: string;
  language?: string;
  created_by: string;
}

export interface Message {
  project_id: string;
  content: string;
  sender: string;
  type: string;
  timestamp?: string;
  id?: string;
}

