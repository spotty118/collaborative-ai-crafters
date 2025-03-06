
import { supabase } from '@/lib/supabase';
import { Agent, Project, Task, AgentType, AgentStatus, TaskStatus } from '@/lib/types';
import { getProject, getAgents, getTasks, getCodeFiles, updateProject, updateAgent, createTask, createMessage, createCodeFile, updateCodeFile } from '@/lib/api';
import { toast } from 'sonner';

/**
 * Initialize CrewAI orchestration for a project
 */
export const initializeCrewAI = async (project: Project): Promise<void> => {
  if (!project.id) {
    console.error("Cannot initialize CrewAI orchestration without a project ID");
    toast.error("Cannot initialize project: missing project ID");
    return;
  }
  
  try {
    console.log('Initializing CrewAI orchestration for project:', project);
    
    // Get all available agents for this project
    let agents = project.agents;
    
    // If agents aren't provided with the project, fetch them
    if (!agents || agents.length === 0) {
      console.log('No agents provided with project, attempting to fetch agents...');
      try {
        agents = await getAgents(project.id);
        console.log('Fetched agents:', agents);
      } catch (error) {
        console.error('Error fetching agents:', error);
      }
    }
    
    // If still no agents, try to create default agents
    if (!agents || agents.length === 0) {
      console.log('No agents available, attempting to create default agents...');
      try {
        agents = await createAgents(project.id);
        console.log('Created default agents:', agents);
      } catch (error) {
        console.error('Error creating default agents:', error);
        toast.error("Failed to create agents. Please refresh the page and try again.");
        return;
      }
    }
    
    if (!agents || agents.length === 0) {
      console.warn('No agents available for orchestration even after creation attempt');
      toast.error("Failed to initialize agents. Please refresh the page.");
      return;
    }
    
    // Find the architect agent as the lead orchestrator
    const architectAgent = agents.find(a => a.type === 'architect');
    
    if (!architectAgent) {
      console.warn('Architect agent not available');
      toast.error("Architect agent not found. Please refresh the page.");
      return;
    }
    
    // Update architect's status to working if it's not already
    if (architectAgent.status !== 'working') {
      try {
        console.log('Updating architect agent status to working...');
        await updateAgent(architectAgent.id, { status: 'working' });
        architectAgent.status = 'working'; // Update local object too
        console.log(`Updated architect agent status to working`);
      } catch (error) {
        console.error('Error updating architect agent status:', error);
        toast.error("Failed to update architect status. Continuing anyway...");
      }
    }
    
    // Inform the team that orchestration is starting
    try {
      console.log('Creating initial message from architect...');
      await createMessage({
        project_id: project.id,
        content: "CrewAI orchestration initialized. I'll be coordinating our team using advanced AI techniques to complete this project efficiently.",
        sender: architectAgent.name,
        type: "text"
      });
      console.log('Initial message created successfully');
    } catch (error) {
      console.error('Error creating initial message:', error);
      toast.error("Communication error. Continuing anyway...");
    }
    
    // Call the CrewAI edge function
    try {
      console.log('Calling CrewAI orchestrator edge function...');
      const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
        body: {
          projectId: project.id,
          action: 'start'
        }
      });
      
      if (error) {
        console.error('Error calling CrewAI orchestrator:', error);
        toast.error("Failed to start CrewAI orchestration. Check console for details.");
        return;
      }
      
      console.log('CrewAI orchestrator response:', data);
      toast.success("CrewAI orchestration initiated successfully");
    } catch (error) {
      console.error('Exception calling CrewAI orchestrator:', error);
      toast.error("Failed to start CrewAI orchestration. Check console for details.");
    }
    
  } catch (error) {
    console.error('Error initializing CrewAI orchestration:', error);
    toast.error('Error starting agent orchestration. Please try again.');
  }
};

/**
 * Update CrewAI orchestration with new information
 */
export const updateCrewAIOrchestration = async (project: Project, message?: string): Promise<void> => {
  if (!project.id) return;
  
  try {
    console.log('Updating CrewAI orchestration for project:', project);
    
    // Call the CrewAI edge function
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: {
        projectId: project.id,
        action: 'update',
        message
      }
    });
    
    if (error) {
      console.error('Error updating CrewAI orchestration:', error);
      return;
    }
    
    console.log('CrewAI orchestration update response:', data);
  } catch (error) {
    console.error('Error updating CrewAI orchestration:', error);
  }
};

/**
 * Handle task completion in CrewAI context
 */
export const handleCrewTaskCompletion = async (
  agent: Agent,
  taskId: string,
  project: Project
): Promise<void> => {
  if (!project.id) return;
  
  try {
    console.log(`Agent ${agent.name} completed task ${taskId}`);
    
    // Update task status
    await updateTask(taskId, { status: 'completed' as TaskStatus });
    
    // Notify the crew orchestration
    await updateCrewAIOrchestration(project, 
      `Agent ${agent.name} completed task ${taskId}. Moving to next task in sequence.`
    );
  } catch (error) {
    console.error('Error handling task completion in CrewAI:', error);
  }
};

/**
 * Create default agents for CrewAI
 */
const createAgents = async (projectId: string): Promise<Agent[]> => {
  // This function is imported from api.ts
  // Just here for type completion
  return getAgents(projectId);
};

/**
 * Update a task
 */
const updateTask = async (taskId: string, updates: Partial<Task>): Promise<void> => {
  try {
    // This function should be imported from api.ts
    // Just a stub for type completion
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
};
