
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { broadcastMessage } from "./messageBroker";
import { Agent, Project } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const convertProject = (projectData: any): Project => {
  return {
    ...projectData,
    mode: projectData.source_type as any,
    techStack: {
      frontend: projectData.tech_stack.find((t: string) => /react/i.test(t)) || "",
      backend: projectData.tech_stack.find((t: string) => /node/i.test(t)) || "",
      database: projectData.tech_stack.find((t: string) => /postgres|mysql|mongo/i.test(t)) || "",
      deployment: projectData.tech_stack.find((t: string) => /docker|kubernetes|aws|vercel/i.test(t)) || ""
    }
  };
};

/**
 * Start agent orchestration
 * 
 * @param projectId - The project ID
 * @param agentId - The agent ID to start
 * @param taskId - Optional specific task ID to execute
 * @returns Promise with the response
 */
export const startAgentOrchestration = async (
  projectId: string,
  agentId: string,
  taskId?: string
): Promise<unknown> => {
  try {
    console.log(`Starting agent orchestration: Project ${projectId}, Agent ${agentId}`);
    
    // Call the Supabase Function for crew orchestration
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: {
        projectId,
        agentId,
        taskId,
        action: 'start',
        temperature: 0.3
      }
    });
    
    if (error) {
      console.error('Orchestration error:', error);
      throw new Error(`Failed to start agent: ${error.message}`);
    }
    
    console.log('Orchestration response:', data);
    
    // Fetch agent data to check if this is the Architect and retrieve token if available
    const { data: agentData } = await supabase
      .from('agent_statuses')
      .select('*')
      .eq('id', agentId)
      .single();
    // Cast agentData to any to retrieve the token, if it exists
    const token = (agentData as any)?.token || "";
      
    if (agentData && agentData.agent_type === 'architect') {
      console.log('Architect agent detected, will start team collaboration');
      
      // Fetch project data for context
      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
        
      if (projectData) {
        // Start team collaboration immediately
        toast.info("Starting team collaboration...");
        
        // Immediate start of team collaboration for faster response, passing token to next agent
        initiateTeamCollaboration(projectId, convertProject(projectData), token);
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error in startAgentOrchestration:', error);
    throw error;
  }
};

/**
 * Initiate team collaboration for a project
 */
const initiateTeamCollaboration = async (projectId: string, project: Project, token?: string) => {
  try {
    console.log(`Initiating team collaboration for project ${projectId}`);
    
    // Fetch all agents for the project
    const { data: agents, error } = await supabase
      .from('agent_statuses')
      .select('*')
      .eq('project_id', projectId);
      
    if (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to start team collaboration: Could not fetch agents');
      return;
    }
    
    if (!agents || agents.length === 0) {
      console.log('No agents found for collaboration');
      toast.error('No agents found for collaboration');
      return;
    }
    
    // Create a team message in chat
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `Team collaboration has been initiated for project "${project.name}". Agents will now collaborate automatically on tasks.`,
        sender: "System",
        type: "text"
      }]);
    
    // Update all agents to be in working state
    const agentIds = agents.map(agent => agent.id);
    await supabase
      .from('agent_statuses')
      .update({ status: 'working', progress: 10 })
      .in('id', agentIds);
      
    // Add a visible toast notification
    toast.success('Team collaboration initiated');
    
    // Call the orchestrator in "team_mode" to start collaboration with explicit autostart flag
    const { data, error: orchError } = await supabase.functions.invoke('crew-orchestrator', {
      body: {
        projectId,
        action: 'team_collaborate',
        agents: agents.map(a => ({ id: a.id, type: a.agent_type, name: a.name })),
        projectContext: project,
        temperature: 0.3,
        autostart: true // Explicit flag to auto-start all agents
      }
    });
    
    if (orchError) {
      console.error('Team collaboration error:', orchError);
      toast.error(`Team collaboration failed: ${orchError.message}`);
      return;
    }
    
    console.log('Team collaboration initiated:', data);
  } catch (error) {
    console.error('Error initiating team collaboration:', error);
    toast.error(`Failed to initiate team collaboration: ${(error as Error).message}`);
  }
};

/**
 * Stop agent orchestration
 * 
 * @param projectId - The project ID
 * @param agentId - The agent ID to stop
 * @returns Promise with the response
 */
export const stopAgentOrchestration = async (
  projectId: string,
  agentId: string
): Promise<unknown> => {
  try {
    console.log(`Stopping agent orchestration: Project ${projectId}, Agent ${agentId}`);
    
    // Call the Supabase Function for crew orchestration
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: {
        projectId,
        agentId,
        action: 'stop'
      }
    });
    
    if (error) {
      console.error('Orchestration error:', error);
      throw new Error(`Failed to stop agent: ${error.message}`);
    }
    
    console.log('Orchestration response:', data);
    return data;
  } catch (error) {
    console.error('Error in stopAgentOrchestration:', error);
    throw error;
  }
};

/**
 * Initialize CrewAI orchestration
 * 
 * @param projectId - The project ID
 * @returns Promise with the initialization response
 */
export const initializeCrewAI = async (projectId: string): Promise<unknown> => {
  try {
    console.log(`Initializing CrewAI orchestration for project ${projectId}`);
    
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: {
        projectId,
        action: 'initialize',
        temperature: 0.3
      }
    });
    
    if (error) {
      console.error('Initialization error:', error);
      throw new Error(`Failed to initialize CrewAI: ${error.message}`);
    }
    
    console.log('Initialization response:', data);
    
    // Automatically initiate team collaboration after initialization
    if (data && data.success) {
      // Fetch project data for context
      const { data: projectData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
        
        if (projectData) {
          // Wait a bit for agents to be properly initialized
          setTimeout(() => {
            initiateTeamCollaboration(projectId, convertProject(projectData), "");
          }, 8000);
        }
    }
    
    return data;
  } catch (error) {
    console.error('Error in initializeCrewAI:', error);
    throw error;
  }
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Update CrewAI orchestration
 * 
 * @param projectId - The project ID
 * @param updates - The updates to apply
 * @returns Promise with the update response
 */
export const updateCrewAIOrchestration = async (
  projectId: string, 
  updates: unknown
): Promise<unknown> => {
  try {
    console.log(`Updating CrewAI orchestration for project ${projectId}`, updates);
    
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: {
        projectId,
        updates,
        action: 'update'
      }
    });
    
    if (error) {
      console.error('Update error:', error);
      throw new Error(`Failed to update CrewAI: ${error.message}`);
    }
    
    console.log('Update response:', data);
    return data;
  } catch (error) {
    console.error('Error in updateCrewAIOrchestration:', error);
    throw error;
  }
};

/**
 * Handle CrewAI task completion
 * 
 * @param projectId - The project ID
 * @param taskId - The task ID that was completed
 * @param result - The task result
 * @returns Promise with the completion response
 */
export const handleCrewTaskCompletion = async (
  projectId: string,
  taskId: string,
  result: unknown
): Promise<unknown> => {
  try {
    console.log(`Handling task completion for project ${projectId}, task ${taskId}`);
    
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: {
        projectId,
        taskId,
        result,
        action: 'complete_task'
      }
    });
    
    if (error) {
      console.error('Task completion error:', error);
      throw new Error(`Failed to handle task completion: ${error.message}`);
    }
    
    console.log('Task completion response:', data);
    return data;
  } catch (error) {
    console.error('Error in handleCrewTaskCompletion:', error);
    throw error;
  }
};
