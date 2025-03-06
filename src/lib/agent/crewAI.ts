
import { Agent, Project, Task } from '@/lib/types';
import { createMessage, createTask, getAgents, updateAgent, updateProject } from '@/lib/api';
import { sendAgentPrompt } from '@/lib/openrouter';
import { toast } from 'sonner';
import { broadcastMessage } from './messageBroker';

/**
 * Initialize CrewAI orchestration for a project
 */
export const initializeCrewAI = async (project: Project): Promise<boolean> => {
  if (!project.id) return false;
  
  try {
    console.log(`Initializing CrewAI orchestration for project: ${project.name}`);
    
    // Call Supabase Edge Function to start CrewAI process
    const response = await fetch('/api/crew-orchestrator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: project.id,
        action: 'start'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('CrewAI initialization failed:', errorText);
      return false;
    }
    
    const result = await response.json();
    console.log('CrewAI initialization result:', result);
    
    // Create initial tasks for the project if none exist yet
    await createInitialCrewTasks(project);
    
    return true;
  } catch (error) {
    console.error('Error initializing CrewAI:', error);
    return false;
  }
};

/**
 * Create initial tasks for the project using CrewAI
 */
export const createInitialCrewTasks = async (project: Project): Promise<boolean> => {
  if (!project.id) return false;
  
  try {
    console.log(`Creating initial tasks for project with CrewAI: ${project.name}`);
    
    // Get project agents
    const agents = project.agents || await getAgents(project.id);
    
    // Find the architect agent to lead task creation
    const architectAgent = agents.find(a => a.type === 'architect');
    
    if (!architectAgent) {
      console.error('No architect agent found to create initial tasks');
      return false;
    }
    
    // Basic task templates for each agent type
    const taskTemplates = {
      architect: [
        {
          title: "System Architecture Planning",
          description: "Define the overall architecture for the application including component structure, data flow, and technology choices."
        },
        {
          title: "Technical Requirements Analysis",
          description: "Analyze project requirements and translate them into technical specifications and acceptance criteria."
        }
      ],
      frontend: [
        {
          title: "UI Component Design",
          description: "Design and implement the core UI components following best practices for reusability and accessibility."
        },
        {
          title: "State Management Setup",
          description: "Establish the application's state management approach and implement core state logic."
        }
      ],
      backend: [
        {
          title: "API Endpoint Design",
          description: "Design RESTful API endpoints that align with frontend requirements and follow REST best practices."
        },
        {
          title: "Database Schema Creation",
          description: "Design and implement the database schema with proper relationships and constraints."
        }
      ],
      testing: [
        {
          title: "Test Plan Development",
          description: "Create a comprehensive test plan covering unit, integration, and end-to-end testing approaches."
        },
        {
          title: "Test Environment Setup",
          description: "Set up testing infrastructure and tools for automated testing of the application."
        }
      ],
      devops: [
        {
          title: "CI/CD Pipeline Setup",
          description: "Create continuous integration and deployment pipelines for automated building, testing, and deployment."
        },
        {
          title: "Infrastructure Configuration",
          description: "Configure cloud resources and infrastructure required for the application deployment."
        }
      ]
    };
    
    // Create tasks for each agent type
    for (const agent of agents) {
      if (!agent.type || !taskTemplates[agent.type]) continue;
      
      const templates = taskTemplates[agent.type];
      
      for (const template of templates) {
        try {
          console.log(`Creating task: ${template.title} for ${agent.name}`);
          
          await createTask({
            title: template.title,
            description: template.description,
            status: "pending",
            priority: "high",
            assigned_to: agent.id,
            project_id: project.id
          });
        } catch (error) {
          console.error(`Error creating task ${template.title}:`, error);
        }
      }
      
      // Update agent status to working
      await updateAgent(agent.id, { status: 'working' });
    }
    
    // Update project status
    await updateProject(project.id, { 
      status: 'in_progress',
      progress: 10
    });
    
    // Have the architect announce task creation
    broadcastMessage(
      architectAgent,
      "I've created initial tasks for our team. Each agent now has specific tasks assigned based on their specialties. Let's begin working on these tasks systematically.",
      project
    );
    
    return true;
  } catch (error) {
    console.error('Error creating initial tasks with CrewAI:', error);
    return false;
  }
};

/**
 * Update CrewAI orchestration for a project
 */
export const updateCrewAIOrchestration = async (project: Project): Promise<boolean> => {
  if (!project.id) return false;
  
  try {
    console.log(`Updating CrewAI orchestration for project: ${project.name}`);
    
    // Call Supabase Edge Function to update CrewAI process
    const response = await fetch('/api/crew-orchestrator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: project.id,
        action: 'update'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('CrewAI update failed:', errorText);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error updating CrewAI orchestration:', error);
    return false;
  }
};

/**
 * Handle task completion for CrewAI
 */
export const handleCrewTaskCompletion = async (
  agent: Agent,
  taskId: string,
  project: Project
): Promise<void> => {
  if (!project.id) return;
  
  try {
    console.log(`CrewAI: Agent ${agent.name} completed task ${taskId}`);
    
    // Generate next steps using the agent
    const nextStepsPrompt = `
You've just completed task ${taskId} for project "${project.name}". 
Based on your expertise as a ${agent.type} specialist, what should be the next step or task to focus on?
Please be specific and actionable in your response.
    `;
    
    const response = await sendAgentPrompt(agent, nextStepsPrompt, project);
    
    // Create a message with the agent's thoughts
    await createMessage({
      project_id: project.id,
      content: `I've completed task ${taskId}. ${response}`,
      sender: agent.name,
      type: "text"
    });
    
    // If this agent is the architect, create follow-up tasks
    if (agent.type === 'architect') {
      const taskCreationPrompt = `
Based on completing task ${taskId} for project "${project.name}", 
create 2 new specific tasks that should be prioritized next.
For each task, specify which specialist agent (frontend, backend, testing, or devops) should handle it and why.
Format your response clearly with numbered tasks and assigned agent for each.
      `;
      
      const taskResponse = await sendAgentPrompt(agent, taskCreationPrompt, project);
      
      // Have the system notify about new tasks being created
      await createMessage({
        project_id: project.id,
        content: "Creating follow-up tasks based on architect's recommendations...",
        sender: "System",
        type: "text"
      });
      
      // Use the existing task parsing function from taskManagement.ts
      // We'll manually create some tasks here for demonstration
      
      const taskLines = taskResponse.split('\n');
      const agents = project.agents || await getAgents(project.id);
      let tasksCreated = 0;
      
      // A very simple task parser for demonstration
      for (const line of taskLines) {
        // Look for lines with task indicators
        if (/^(Task \d+:|[*-]\s+|\d+\.\s+)/i.test(line) && line.length > 15) {
          const taskTitle = line.replace(/^(Task \d+:|[*-]\s+|\d+\.\s+)/i, '').trim();
          
          // Skip if empty
          if (!taskTitle) continue;
          
          // Try to determine target agent from the text
          let targetAgentType = 'architect';
          
          const lowerLine = line.toLowerCase();
          if (lowerLine.includes('frontend') || lowerLine.includes('ui')) {
            targetAgentType = 'frontend';
          } else if (lowerLine.includes('backend') || lowerLine.includes('api')) {
            targetAgentType = 'backend';
          } else if (lowerLine.includes('test')) {
            targetAgentType = 'testing';
          } else if (lowerLine.includes('devops') || lowerLine.includes('deploy')) {
            targetAgentType = 'devops';
          }
          
          // Find the target agent
          const targetAgent = agents.find(a => a.type === targetAgentType);
          if (!targetAgent) continue;
          
          try {
            await createTask({
              title: taskTitle,
              description: `Follow-up task created by architect: ${taskTitle}`,
              status: "pending",
              priority: "medium",
              assigned_to: targetAgent.id,
              project_id: project.id
            });
            
            tasksCreated++;
          } catch (error) {
            console.error(`Error creating follow-up task:`, error);
          }
        }
      }
      
      // If we couldn't parse any tasks, create at least one generic task
      if (tasksCreated === 0) {
        const frontendAgent = agents.find(a => a.type === 'frontend');
        if (frontendAgent) {
          await createTask({
            title: "Implement UI improvements based on latest requirements",
            description: "Review the latest project requirements and update UI components to match specifications.",
            status: "pending",
            priority: "medium",
            assigned_to: frontendAgent.id,
            project_id: project.id
          });
          tasksCreated = 1;
        }
      }
      
      // Notify about task creation
      await createMessage({
        project_id: project.id,
        content: `Created ${tasksCreated} new task(s) based on completed work.`,
        sender: "System",
        type: "text"
      });
    }
  } catch (error) {
    console.error('Error handling CrewAI task completion:', error);
  }
};
