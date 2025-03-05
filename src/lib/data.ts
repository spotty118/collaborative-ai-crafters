
import { Agent, Project, Task, Message } from './types';

export const agents: Agent[] = [
  {
    id: '1',
    type: 'architect',
    name: 'Architect Agent',
    description: 'Designs system architecture and project structure',
    status: 'idle',
    progress: 0,
    avatar: '👨‍💻'
  },
  {
    id: '2',
    type: 'frontend',
    name: 'Frontend Agent',
    description: 'Builds UI components and client-side functionality',
    status: 'idle',
    progress: 0,
    avatar: '🎨'
  },
  {
    id: '3',
    type: 'backend',
    name: 'Backend Agent',
    description: 'Develops APIs and server-side logic',
    status: 'idle',
    progress: 0,
    avatar: '🔧'
  },
  {
    id: '4',
    type: 'testing',
    name: 'Testing Agent',
    description: 'Creates tests and ensures quality',
    status: 'idle',
    progress: 0,
    avatar: '🧪'
  },
  {
    id: '5',
    type: 'devops',
    name: 'DevOps Agent',
    description: 'Handles deployment and CI/CD setup',
    status: 'idle',
    progress: 0,
    avatar: '🚀'
  }
];

export const tasks: Task[] = [
  {
    id: '1',
    title: 'Define system architecture',
    description: 'Create overall system design and component relationships',
    status: 'pending',
    agentId: '1',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    title: 'Design database schema',
    description: 'Create database models and relationships',
    status: 'pending',
    agentId: '3',
    createdAt: new Date(),
    updatedAt: new Date(),
    dependencies: ['1']
  },
  {
    id: '3',
    title: 'Create UI components',
    description: 'Build reusable UI components for the application',
    status: 'pending',
    agentId: '2',
    createdAt: new Date(),
    updatedAt: new Date(),
    dependencies: ['1']
  }
];

export const project: Project = {
  id: '1',
  name: 'Agentic Development Platform',
  description: 'A collaborative AI development system',
  mode: 'new',
  createdAt: new Date(),
  updatedAt: new Date(),
  techStack: {
    frontend: 'React',
    backend: 'Node.js',
    database: 'Supabase',
    deployment: 'Vercel'
  },
  tasks: tasks
};

export const messages: Message[] = [
  {
    id: '1',
    content: 'Starting analysis of project requirements...',
    sender: 'Architect Agent',
    timestamp: new Date(Date.now() - 60000 * 10),
    agentId: '1'
  },
  {
    id: '2',
    content: 'I recommend using a React frontend with a Node.js backend.',
    sender: 'Architect Agent',
    timestamp: new Date(Date.now() - 60000 * 5),
    agentId: '1'
  },
  {
    id: '3',
    content: 'Waiting for architecture design to begin UI component planning.',
    sender: 'Frontend Agent',
    timestamp: new Date(Date.now() - 60000 * 2),
    agentId: '2'
  }
];
