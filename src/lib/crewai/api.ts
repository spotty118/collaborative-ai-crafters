
import { supabase } from "@/integrations/supabase/client";
import { Agent, Project, Task } from "@/lib/types";
import { toast } from "sonner";
import { crewAIClient, CrewAIAgent, CrewAICrew, CrewAITask } from "./client";

// Function to create a new crew for a project
export const createCrewForProject = async (project: Project): Promise<string | null> => {
  try {
    console.log(`Creating CrewAI crew for project ${project.id}`);
    
    // Create the crew via OpenRouter edge function (to avoid CORS)
    const { data, error } = await supabase.functions.invoke('openrouter', {
      body: {
        useCrewAI: true,
        crewAction: 'create_crew',
        projectContext: {
          name: project.name,
          description: project.description
        }
      }
    });
    
    if (error) {
      console.error("Error creating CrewAI crew:", error);
      toast.error(`Failed to create CrewAI crew: ${error.message}`);
      return null;
    }
    
    const crewId = data.id;
    console.log(`CrewAI crew created with ID: ${crewId}`);
    
    // Update project with CrewAI ID
    const { error: updateError } = await supabase
      .from('projects')
      .update({ 
        metadata: { 
          crewai_id: crewId 
        }
      })
      .eq('id', project.id);
      
    if (updateError) {
      console.error("Error updating project with CrewAI ID:", updateError);
      toast.error(`Failed to update project with CrewAI ID: ${updateError.message}`);
    }
    
    return crewId;
  } catch (error) {
    console.error("Exception creating CrewAI crew:", error);
    toast.error(`Exception creating CrewAI crew: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

// Function to create a CrewAI agent
export const createCrewAgent = async (
  crewId: string, 
  agent: Agent
): Promise<string | null> => {
  try {
    console.log(`Creating CrewAI agent for ${agent.name} in crew ${crewId}`);
    
    // Map agent type to role and goal
    const agentData = getAgentRoleAndGoal(agent.type);
    
    // Create the agent via OpenRouter edge function
    const { data, error } = await supabase.functions.invoke('openrouter', {
      body: {
        useCrewAI: true,
        crewAction: 'create_agent',
        crewId,
        agentData: {
          name: agent.name,
          role: agentData.role,
          goal: agentData.goal,
          backstory: agentData.backstory
        }
      }
    });
    
    if (error) {
      console.error("Error creating CrewAI agent:", error);
      toast.error(`Failed to create CrewAI agent: ${error.message}`);
      return null;
    }
    
    const crewAgentId = data.id;
    console.log(`CrewAI agent created with ID: ${crewAgentId}`);
    
    // Update agent with CrewAI ID
    const { error: updateError } = await supabase
      .from('agent_statuses')
      .update({ 
        metadata: { 
          crewai_id: crewAgentId 
        }
      })
      .eq('id', agent.id);
      
    if (updateError) {
      console.error("Error updating agent with CrewAI ID:", updateError);
      toast.error(`Failed to update agent with CrewAI ID: ${updateError.message}`);
    }
    
    return crewAgentId;
  } catch (error) {
    console.error("Exception creating CrewAI agent:", error);
    toast.error(`Exception creating CrewAI agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

// Function to create a CrewAI task
export const createCrewTask = async (
  crewId: string, 
  task: Task, 
  crewAgentId?: string
): Promise<string | null> => {
  try {
    console.log(`Creating CrewAI task in crew ${crewId}${crewAgentId ? ` for agent ${crewAgentId}` : ''}`);
    
    // Create the task via OpenRouter edge function
    const { data, error } = await supabase.functions.invoke('openrouter', {
      body: {
        useCrewAI: true,
        crewAction: 'create_task',
        crewId,
        taskData: {
          description: task.description || task.title,
          agent_id: crewAgentId
        }
      }
    });
    
    if (error) {
      console.error("Error creating CrewAI task:", error);
      toast.error(`Failed to create CrewAI task: ${error.message}`);
      return null;
    }
    
    const crewTaskId = data.id;
    console.log(`CrewAI task created with ID: ${crewTaskId}`);
    
    // Update task with CrewAI ID
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ 
        metadata: { 
          crewai_id: crewTaskId 
        }
      })
      .eq('id', task.id);
      
    if (updateError) {
      console.error("Error updating task with CrewAI ID:", updateError);
      toast.error(`Failed to update task with CrewAI ID: ${updateError.message}`);
    }
    
    return crewTaskId;
  } catch (error) {
    console.error("Exception creating CrewAI task:", error);
    toast.error(`Exception creating CrewAI task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

// Function to run a CrewAI crew
export const runCrewAICrew = async (crewId: string): Promise<boolean> => {
  try {
    console.log(`Running CrewAI crew ${crewId}`);
    
    // Run the crew via OpenRouter edge function
    const { data, error } = await supabase.functions.invoke('openrouter', {
      body: {
        useCrewAI: true,
        crewAction: 'run_crew',
        crewId
      }
    });
    
    if (error) {
      console.error("Error running CrewAI crew:", error);
      toast.error(`Failed to run CrewAI crew: ${error.message}`);
      return false;
    }
    
    console.log(`CrewAI crew ${crewId} started successfully`);
    return true;
  } catch (error) {
    console.error("Exception running CrewAI crew:", error);
    toast.error(`Exception running CrewAI crew: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// Function to get CrewAI crew status
export const getCrewStatus = async (crewId: string): Promise<CrewAICrew | null> => {
  try {
    console.log(`Getting status for CrewAI crew ${crewId}`);
    
    // Get crew status via OpenRouter edge function
    const { data, error } = await supabase.functions.invoke('openrouter', {
      body: {
        useCrewAI: true,
        crewAction: 'get_crew',
        crewId
      }
    });
    
    if (error) {
      console.error("Error getting CrewAI crew status:", error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error("Exception getting CrewAI crew status:", error);
    return null;
  }
};

// Function to get CrewAI agent results
export const getAgentResults = async (crewId: string, agentId: string): Promise<any | null> => {
  try {
    console.log(`Getting results for agent ${agentId} in crew ${crewId}`);
    
    // Get agent results via OpenRouter edge function
    const { data, error } = await supabase.functions.invoke('openrouter', {
      body: {
        useCrewAI: true,
        crewAction: 'get_agent_results',
        crewId,
        agentId
      }
    });
    
    if (error) {
      console.error("Error getting CrewAI agent results:", error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error("Exception getting CrewAI agent results:", error);
    return null;
  }
};

// Function to get CrewAI task result
export const getTaskResult = async (crewId: string, taskId: string): Promise<any | null> => {
  try {
    console.log(`Getting results for task ${taskId} in crew ${crewId}`);
    
    // Get task result via OpenRouter edge function
    const { data, error } = await supabase.functions.invoke('openrouter', {
      body: {
        useCrewAI: true,
        crewAction: 'get_task_result',
        crewId,
        taskId
      }
    });
    
    if (error) {
      console.error("Error getting CrewAI task result:", error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error("Exception getting CrewAI task result:", error);
    return null;
  }
};

// Utility function to get role and goal for agent types
function getAgentRoleAndGoal(agentType: string) {
  switch (agentType) {
    case 'architect':
      return {
        role: 'Software Architect',
        goal: 'Design the overall system architecture and coordinate the development efforts',
        backstory: 'You are an experienced software architect with expertise in designing scalable systems. You understand the big picture and can break down complex problems into manageable components.'
      };
    case 'frontend':
      return {
        role: 'Frontend Developer',
        goal: 'Implement user interfaces and client-side functionality',
        backstory: 'You are a frontend developer skilled in creating intuitive and responsive user interfaces. You have a keen eye for design and user experience.'
      };
    case 'backend':
      return {
        role: 'Backend Developer',
        goal: 'Build APIs, services, and database models',
        backstory: 'You are a backend developer with expertise in server-side programming and database design. You know how to create efficient and secure APIs.'
      };
    case 'testing':
      return {
        role: 'QA Engineer',
        goal: 'Ensure software quality through comprehensive testing',
        backstory: 'You are a detail-oriented QA engineer who values software quality. You are skilled at identifying bugs and edge cases.'
      };
    case 'devops':
      return {
        role: 'DevOps Engineer',
        goal: 'Set up deployment pipelines and infrastructure',
        backstory: 'You are a DevOps engineer with expertise in automation, CI/CD, and cloud infrastructure. You ensure smooth deployment and operation of applications.'
      };
    default:
      return {
        role: 'Software Developer',
        goal: 'Implement software components based on requirements',
        backstory: 'You are a skilled software developer with experience in multiple technologies. You can adapt to different challenges and deliver quality code.'
      };
  }
}
