import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { broadcastMessage } from "./messageBroker";
import { Agent, Project } from "@/lib/types";

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
): Promise<any> => {
  try {
    console.log(`Starting agent orchestration: Project ${projectId}, Agent ${agentId}`);
    
    // Call the Supabase Function for crew orchestration
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: {
        projectId,
        agentId,
        taskId,
        action: 'start'
      }
    });
    
    if (error) {
      console.error('Orchestration error:', error);
      throw new Error(`Failed to start agent: ${error.message}`);
    }
    
    console.log('Orchestration response:', data);
    
    // Fetch agent data to check if this is the Architect
    const { data: agentData } = await supabase
      .from('agent_statuses')
      .select('*')
      .eq('id', agentId)
      .single();
      
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
        
        // Immediate start of team collaboration for faster response
        initiateTeamCollaboration(projectId, projectData);
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error in startAgentOrchestration:', error);
    throw error;
  }
};

/**
 * Initiate team collaboration for a project with enhanced planning capabilities
 */
const initiateTeamCollaboration = async (projectId: string, project: any) => {
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
    await broadcastMessage(
      projectId,
      {
        sender: "System",
        content: `Team collaboration has been initiated for project "${project.name}". Agents will now collaborate automatically on tasks following the planning, reasoning, execution framework.`,
        type: "text"
      }
    );
    
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
        autostart: true, // Explicit flag to auto-start all agents
        useEnhancedPlanning: true // Enable new planning capabilities
      }
    });
    
    if (orchError) {
      console.error('Team collaboration error:', orchError);
      toast.error(`Team collaboration failed: ${orchError.message}`);
      return;
    }
    
    console.log('Team collaboration initiated:', data);
    
    // Broadcast a message to inform about the collaborative process
    await broadcastMessage(
      projectId,
      {
        sender: "System",
        content: "Team is now collaborating using enhanced planning & reasoning capabilities. The Architect will coordinate task distribution.",
        type: "text"
      }
    );
    
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
): Promise<any> => {
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
export const initializeCrewAI = async (projectId: string): Promise<any> => {
  try {
    console.log(`Initializing CrewAI orchestration for project ${projectId}`);
    
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: {
        projectId,
        action: 'initialize'
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
          initiateTeamCollaboration(projectId, projectData);
        }, 8000);
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error in initializeCrewAI:', error);
    throw error;
  }
};

/**
 * Update CrewAI orchestration
 * 
 * @param projectId - The project ID
 * @param updates - The updates to apply
 * @returns Promise with the update response
 */
export const updateCrewAIOrchestration = async (
  projectId: string, 
  updates: any
): Promise<any> => {
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
  result: any
): Promise<any> => {
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

/**
 * Initialize agent orchestration for a project
 * @param projectId The project ID
 * @param agents The agents to initialize
 */
export const initializeAgentOrchestration = async (
  projectId: string,
  agents: Agent[]
): Promise<boolean> => {
  try {
    console.log(`Initializing agent orchestration for project ${projectId}`);
    
    const { data, error } = await supabase.functions.invoke('crew-orchestrator', {
      body: {
        projectId,
        agents,
        action: 'initialize'
      }
    });
    
    if (error) {
      console.error('Initialization error:', error);
      throw new Error(`Failed to initialize agent orchestration: ${error.message}`);
    }
    
    console.log('Initialization response:', data);
    
    // Ensure we properly call broadcastMessage with all required arguments
    if (data && data.success) {
      const architect = agents.find(agent => agent.type === 'architect');
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
        
      if (projectData && architect && !projectError) {
        await broadcastMessage(
          projectId,
          {
            sender: architect.name,
            content: `The Architect Agent has been initialized for project ${projectData.name}. I'll be leading the team to design and build ${projectData.description}.`,
            type: "text"
          }
        );
      }
    }
    
    return data.success;
  } catch (error) {
    console.error('Error in agent orchestration initialization:', error);
    return false;
  }
};
