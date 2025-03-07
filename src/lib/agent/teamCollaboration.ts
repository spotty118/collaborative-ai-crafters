
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { broadcastMessage } from "./messageBroker";

/**
 * Initiate team collaboration for a project with enhanced planning capabilities
 */
export const initiateTeamCollaboration = async (projectId: string, project: any) => {
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
    const systemAgent = {
      id: 'system',
      name: 'System',
      type: 'system' as any
    };
    
    await broadcastMessage(
      systemAgent,
      `Team collaboration has been initiated for project "${project.name}". Agents will now collaborate automatically on tasks following the planning, reasoning, execution framework.`,
      project
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
      systemAgent,
      "Team is now collaborating using enhanced planning & reasoning capabilities. The Architect will coordinate task distribution.",
      project
    );
    
  } catch (error) {
    console.error('Error initiating team collaboration:', error);
    toast.error(`Failed to initiate team collaboration: ${(error as Error).message}`);
  }
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
