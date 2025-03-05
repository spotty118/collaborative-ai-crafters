
// Mock data for testing and development
import { Agent, Task, Message, Project, CodeFile, AgentType, AgentStatus, TaskStatus } from "./types";

// Agent mock data
export const agentsMock: Agent[] = [
  {
    id: "1",
    name: "Architect Agent",
    type: "architect",
    description: "Designs system architecture and project structure",
    status: "idle",
    progress: 0,
    avatar: "👨‍💻",
    project_id: "project-1"
  },
  {
    id: "2",
    name: "Frontend Agent",
    type: "frontend",
    description: "Builds UI components and client-side functionality",
    status: "working",
    progress: 45,
    avatar: "🎨",
    project_id: "project-1"
  },
  {
    id: "3",
    name: "Backend Agent",
    type: "backend",
    description: "Develops APIs and database models",
    status: "completed",
    progress: 100,
    avatar: "🔧",
    project_id: "project-1"
  },
  {
    id: "4",
    name: "Testing Agent",
    type: "testing",
    description: "Creates tests and ensures quality",
    status: "idle",
    progress: 0,
    avatar: "🧪",
    project_id: "project-1"
  },
  {
    id: "5",
    name: "DevOps Agent",
    type: "devops",
    description: "Handles deployment and CI/CD setup",
    status: "idle",
    progress: 0,
    avatar: "🚀",
    project_id: "project-1"
  }
];

// Task mock data
export const tasksMock: Task[] = [
  {
    id: "task-1",
    title: "Design System Architecture",
    description: "Create the overall system architecture including component structure and data flow",
    status: "completed",
    assigned_to: "1",
    priority: "high",
    project_id: "project-1",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    completed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    dependencies: []
  },
  {
    id: "task-2",
    title: "Create API Service Modules",
    description: "Implement backend service modules for data retrieval and processing",
    status: "in_progress",
    assigned_to: "3",
    priority: "medium",
    project_id: "project-1",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 3),
    dependencies: ["task-1"]
  },
  {
    id: "task-3",
    title: "Implement User Dashboard Components",
    description: "Create React components for the user dashboard interface",
    status: "in_progress",
    assigned_to: "2",
    priority: "high",
    project_id: "project-1",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2),
    dependencies: ["task-1"]
  },
  {
    id: "task-4",
    title: "Set up Testing Framework",
    description: "Configure Jest and React Testing Library for component testing",
    status: "pending",
    assigned_to: "4",
    priority: "low",
    project_id: "project-1",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 12),
    dependencies: ["task-2", "task-3"]
  }
];

// Project mock data
export const projectMock: Project = {
  id: "project-1",
  name: "AI Developer Platform",
  description: "An intelligent platform for collaborative software development with AI agents",
  status: "in_progress",
  progress: 35,
  tech_stack: ["React", "TypeScript", "Node.js", "Express", "PostgreSQL"],
  source_type: "git",
  source_url: "https://github.com/example/ai-dev-platform",
  requirements: "Building a scalable platform for AI-driven software development...",
  created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
  updated_at: new Date(Date.now() - 1000 * 60 * 60 * 3),
  mode: "existing"
};

// Message mock data
export const messagesMock: Message[] = [
  {
    id: "msg-1",
    content: "Can you help me design the user authentication system?",
    sender: "You",
    type: "text",
    project_id: "project-1",
    created_at: new Date(Date.now() - 1000 * 60 * 30)
  },
  {
    id: "msg-2",
    content: "I'll design a secure authentication system using JWT tokens with refresh capability and role-based access control.",
    sender: "Architect Agent",
    type: "text",
    project_id: "project-1",
    created_at: new Date(Date.now() - 1000 * 60 * 28)
  },
  {
    id: "msg-3",
    content: "Great, also make sure it integrates with the existing user database.",
    sender: "You",
    type: "text",
    project_id: "project-1",
    created_at: new Date(Date.now() - 1000 * 60 * 25)
  },
  {
    id: "msg-4",
    content: "Here's a code example for the integration:\n\n```typescript\nconst authenticateUser = async (email, password) => {\n  // Implementation details\n};\n```",
    sender: "Backend Agent",
    type: "code",
    code_language: "typescript",
    project_id: "project-1",
    created_at: new Date(Date.now() - 1000 * 60 * 20)
  }
];

// Code files mock data
export const codeFilesMock: CodeFile[] = [
  {
    id: "file-1",
    name: "auth.service.ts",
    path: "src/services/auth.service.ts",
    content: `import { User } from '../models/user';\n\nexport class AuthService {\n  async login(email: string, password: string): Promise<User> {\n    // Implementation\n    return user;\n  }\n}`,
    language: "typescript",
    created_by: "Backend Agent",
    last_modified_by: "Backend Agent",
    project_id: "project-1",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 12)
  },
  {
    id: "file-2",
    name: "Login.tsx",
    path: "src/components/auth/Login.tsx",
    content: `import React from 'react';\n\nconst Login: React.FC = () => {\n  return (\n    <div>\n      {/* Implementation */}\n    </div>\n  );\n};\n\nexport default Login;`,
    language: "typescript",
    created_by: "Frontend Agent",
    last_modified_by: "Frontend Agent",
    project_id: "project-1",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 18),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 6)
  }
];
