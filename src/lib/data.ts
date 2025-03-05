
import { Project, Agent, Task, Message, CodeFile, AgentType, AgentStatus, TaskStatus } from './types';

// Sample data for development and testing

export const mockAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'Architect Agent',
    type: 'architect',
    status: 'idle',
    progress: 0,
    description: 'Designs system architecture and project structure',
    avatar: '👨‍💻'
  },
  {
    id: 'agent-2',
    name: 'Frontend Agent',
    type: 'frontend',
    status: 'working',
    progress: 65,
    description: 'Builds UI components and client-side functionality',
    avatar: '🎨'
  },
  {
    id: 'agent-3',
    name: 'Backend Agent',
    type: 'backend',
    status: 'completed',
    progress: 100,
    description: 'Develops APIs and database models',
    avatar: '🔧'
  },
  {
    id: 'agent-4',
    name: 'Testing Agent',
    type: 'testing',
    status: 'waiting',
    progress: 0,
    description: 'Creates tests and ensures quality',
    avatar: '🧪'
  },
  {
    id: 'agent-5',
    name: 'DevOps Agent',
    type: 'devops',
    status: 'idle',
    progress: 0,
    description: 'Handles deployment and CI/CD setup',
    avatar: '🚀'
  }
];

export const mockTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Design system architecture',
    description: 'Create the initial system architecture diagram',
    status: 'completed',
    priority: 'high',
    assigned_to: 'agent-1',
    project_id: 'project-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: new Date().toISOString()
  },
  {
    id: 'task-2',
    title: 'Set up React project structure',
    description: 'Initialize the React project and set up directory structure',
    status: 'in_progress',
    priority: 'medium',
    assigned_to: 'agent-2',
    project_id: 'project-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'task-3',
    title: 'Design database schema',
    description: 'Create the database schema for user management',
    status: 'pending',
    priority: 'medium',
    assigned_to: 'agent-3',
    project_id: 'project-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'task-4',
    title: 'Set up testing framework',
    description: 'Configure Jest and React Testing Library',
    status: 'pending',
    priority: 'low',
    assigned_to: 'agent-4',
    project_id: 'project-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const mockProject: Project = {
  id: 'project-1',
  name: 'E-commerce Platform',
  description: 'A modern e-commerce platform with React and Node.js',
  mode: 'new',
  status: 'in_progress',
  progress: 40,
  techStack: {
    frontend: 'React',
    backend: 'Node.js',
    database: 'PostgreSQL',
    deployment: 'AWS'
  },
  source_type: 'git',
  source_url: 'https://github.com/user/repo',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export const mockMessages: Message[] = [
  {
    id: 'msg-1',
    project_id: 'project-1',
    content: 'Hello! I am the architect agent. How can I help you today?',
    sender: 'Architect Agent',
    type: 'text',
    created_at: new Date().toISOString()
  },
  {
    id: 'msg-2',
    project_id: 'project-1',
    content: 'Can you explain the current architecture of our project?',
    sender: 'You',
    type: 'text',
    created_at: new Date().toISOString()
  },
  {
    id: 'msg-3',
    project_id: 'project-1',
    content: 'Of course! We are using a React frontend with a Node.js backend. The application follows a microservices pattern...',
    sender: 'Architect Agent',
    type: 'text',
    created_at: new Date().toISOString()
  },
  {
    id: 'msg-4',
    project_id: 'project-1',
    content: '```javascript\nconst calculateTotal = (items) => {\n  return items.reduce((total, item) => total + item.price, 0);\n};\n```',
    sender: 'Frontend Agent',
    type: 'code',
    code_language: 'javascript',
    created_at: new Date().toISOString()
  }
];

export const mockCodeFiles: CodeFile[] = [
  {
    id: 'file-1',
    name: 'index.js',
    path: 'src/index.js',
    content: 'import React from "react";\nimport ReactDOM from "react-dom";\nimport App from "./App";\n\nReactDOM.render(<App />, document.getElementById("root"));',
    language: 'javascript',
    created_by: 'Frontend Agent',
    last_modified_by: 'Frontend Agent',
    project_id: 'project-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'file-2',
    name: 'server.js',
    path: 'server/server.js',
    content: 'const express = require("express");\nconst app = express();\n\napp.get("/api", (req, res) => {\n  res.json({ message: "Hello from server" });\n});\n\napp.listen(5000, () => console.log("Server running on port 5000"));',
    language: 'javascript',
    created_by: 'Backend Agent',
    last_modified_by: 'Backend Agent',
    project_id: 'project-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];
