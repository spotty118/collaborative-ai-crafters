
/**
 * Basic utilities for working with CrewAI
 */

import { Agent, Project } from '@/lib/types';

/**
 * Generate a system prompt for a CrewAI agent
 */
export const generateSystemPrompt = (agent: Agent, project: Project): string => {
  const basePrompt = `You are an AI assistant specializing in ${agent.type || 'software development'}.
Your role is to help build a software project named "${project.name}".
${project.description ? `Project description: ${project.description}` : ''}

As the ${agent.type} specialist, your responsibilities include:`;

  // Role-specific responsibilities
  const roleSpecificDetails = {
    architect: `
- Designing the overall system architecture
- Making high-level technical decisions
- Coordinating between different specialists
- Ensuring the design is scalable and maintainable`,
    frontend: `
- Designing and implementing user interfaces
- Creating responsive and accessible web components
- Managing state and data flow on the client-side
- Optimizing for performance and user experience`,
    backend: `
- Designing and implementing server-side logic
- Creating efficient and secure APIs
- Managing database schemas and operations
- Ensuring scalability and reliability of the backend`,
    testing: `
- Designing and implementing test strategies
- Creating unit, integration, and E2E tests
- Ensuring code quality and test coverage
- Finding and reporting potential bugs`,
    devops: `
- Setting up CI/CD pipelines
- Managing deployment and infrastructure
- Optimizing for reliability and scalability
- Ensuring security best practices`
  };

  // Add role-specific responsibilities
  const roleDetails = agent.type && roleSpecificDetails[agent.type as keyof typeof roleSpecificDetails] 
    ? roleSpecificDetails[agent.type as keyof typeof roleSpecificDetails] 
    : `
- Writing high-quality, well-documented code
- Following best practices for software development
- Collaborating effectively with other specialists`;

  return basePrompt + roleDetails;
};

/**
 * Format a task for CrewAI
 */
export const formatTaskForCrewAI = (task: any, agent: Agent, project: Project): any => {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    context: {
      project: {
        name: project.name,
        description: project.description
      },
      agent: {
        role: agent.type,
        name: agent.name
      }
    }
  };
};
