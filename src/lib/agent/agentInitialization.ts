
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { broadcastMessage } from "./messageBroker";
import { Agent } from "@/lib/types";

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
          architect,
          `The Architect Agent has been initialized for project ${projectData.name}. I'll be leading the team to design and build ${projectData.description}.`,
          projectData
        );
      }
    }
    
    return data.success;
  } catch (error) {
    console.error('Error in agent orchestration initialization:', error);
    return false;
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
      // Import from teamCollaboration to avoid circular dependencies
      const { initiateTeamCollaboration } = await import('./teamCollaboration');
      
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
