/**
 * Mock data for CrewAI API integration when the actual API is unavailable
 */

import { RequiredInput, TaskStatus } from './crewAIApi';

// Mock required inputs
export const mockRequiredInputs: RequiredInput[] = [
  {
    name: 'project_name',
    type: 'string',
    description: 'Name of the project you want to create',
    required: true
  },
  {
    name: 'project_description',
    type: 'textarea',
    description: 'Detailed description of the project and its requirements',
    required: true
  },
  {
    name: 'technology_stack',
    type: 'string',
    description: 'Preferred technologies to use (e.g., React, Node.js, Python)',
    required: false
  },
  {
    name: 'deployment_target',
    type: 'string',
    description: 'Where the project will be deployed (e.g., AWS, Vercel, Heroku)',
    required: false
  }
];

// Mock task status response for different stages
export const getMockTaskStatus = (taskId: string, stage: 'pending' | 'in_progress' | 'completed' | 'failed' = 'pending'): TaskStatus => {
  const statuses: Record<string, TaskStatus> = {
    pending: {
      task_id: taskId,
      status: 'pending',
      progress: 0
    },
    in_progress: {
      task_id: taskId,
      status: 'in_progress',
      progress: 45
    },
    completed: {
      task_id: taskId,
      status: 'completed',
      progress: 100,
      result: {
        project_structure: [
          'src/',
          'src/components/',
          'src/pages/',
          'src/utils/',
          'public/',
          'package.json',
          'README.md'
        ],
        tasks: [
          {
            id: 'task-1',
            title: 'Setup project repository',
            status: 'completed',
            assignee: 'DevOps Engineer'
          },
          {
            id: 'task-2',
            title: 'Implement authentication',
            status: 'in_progress',
            assignee: 'Backend Developer'
          },
          {
            id: 'task-3',
            title: 'Create UI components',
            status: 'pending',
            assignee: 'Frontend Developer'
          }
        ],
        recommendations: [
          'Use Next.js for server-side rendering capabilities',
          'Implement CI/CD pipeline with GitHub Actions',
          'Consider using Supabase for authentication and database'
        ],
        next_steps: 'The team should now focus on implementing core features while maintaining a modular architecture'
      }
    },
    failed: {
      task_id: taskId,
      status: 'failed',
      error: 'Unable to complete project planning due to insufficient requirements'
    }
  };

  return statuses[stage];
};
