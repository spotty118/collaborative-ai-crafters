
import { supabase } from "@/integrations/supabase/client";
import { Agent, Project, Task } from "@/lib/types";

/**
 * Initialize a project with CrewAI
 * @param projectId The project ID to initialize
 * @returns The initialized project
 */
export async function initializeProjectWithCrewAI(projectId: string): Promise<Project | null> {
  try {
    // Get project details from the database
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      console.error('Error fetching project:', error);
      return null;
    }

    // Call the CrewAI endpoint to initialize the project
    const response = await fetch(`${window.location.origin}/api/functions/v1/crew-orchestrator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'initialize',
        projectId,
      }),
    });

    const result = await response.json();
    
    if (!result.success) {
      console.error('Error initializing project with CrewAI:', result.message);
      return null;
    }

    // Update the project with the CrewAI ID
    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update({
        metadata: {
          crewai_id: result.crewId
        }
      })
      .eq('id', projectId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating project:', updateError);
      return null;
    }

    console.log('Project initialized with CrewAI:', updatedProject);
    return updatedProject;
  } catch (error) {
    console.error('Error in initializeProjectWithCrewAI:', error);
    return null;
  }
}

/**
 * Create CrewAI agents for a project
 * @param projectId The project ID to create agents for
 * @returns Whether the agents were created successfully
 */
export async function createCrewAIAgents(projectId: string): Promise<Agent[] | null> {
  try {
    const response = await fetch(`${window.location.origin}/api/functions/v1/crew-orchestrator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create_crew_agents',
        projectId,
      }),
    });

    const result = await response.json();
    
    if (!result.success) {
      console.error('Error creating CrewAI agents:', result.message);
      return null;
    }

    // Update the agents in the database with their CrewAI IDs
    for (const agent of result.agents) {
      // First, find the agent in our database
      const { data: ourAgents, error: fetchError } = await supabase
        .from('agent_statuses')
        .select('*')
        .eq('project_id', projectId)
        .eq('name', agent.name);
        
      if (fetchError || !ourAgents || ourAgents.length === 0) {
        console.error(`Error fetching agent ${agent.name}:`, fetchError);
        continue;
      }
      
      const ourAgent = ourAgents[0];
      
      // Update the agent with the CrewAI ID
      const { error: updateError } = await supabase
        .from('agent_statuses')
        .update({
          metadata: {
            crewai_id: agent.id
          }
        })
        .eq('id', ourAgent.id);
        
      if (updateError) {
        console.error(`Error updating agent ${ourAgent.name}:`, updateError);
      }
    }

    // Fetch all the agents for the project
    const { data: agents, error } = await supabase
      .from('agent_statuses')
      .select('*')
      .eq('project_id', projectId);
      
    if (error) {
      console.error('Error fetching agents:', error);
      return null;
    }
    
    return agents;
  } catch (error) {
    console.error('Error in createCrewAIAgents:', error);
    return null;
  }
}

/**
 * Start a task with CrewAI
 * @param projectId The project ID
 * @param agentId The agent ID to start
 * @param taskId Optional task ID to assign
 * @returns Whether the task was started successfully
 */
export async function startCrewAITask(
  projectId: string,
  agentId: string,
  taskId?: string
): Promise<boolean> {
  try {
    // If there's a task, update it to assign it to the agent
    if (taskId) {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          assigned_to: agentId,
          status: 'in_progress',
          metadata: {
            start_time: new Date().toISOString()
          }
        })
        .eq('id', taskId);
        
      if (updateError) {
        console.error('Error updating task:', updateError);
        return false;
      }
    }

    // Start the agent through the CrewAI API
    const response = await fetch(`${window.location.origin}/api/functions/v1/crew-orchestrator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'start',
        projectId,
        agentId,
        taskId,
      }),
    });

    const result = await response.json();
    
    if (!result.success) {
      console.error('Error starting CrewAI task:', result.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in startCrewAITask:', error);
    return false;
  }
}

/**
 * Stop a task with CrewAI
 * @param projectId The project ID
 * @param agentId The agent ID to stop
 * @returns Whether the task was stopped successfully
 */
export async function stopCrewAITask(projectId: string, agentId: string): Promise<boolean> {
  try {
    const response = await fetch(`${window.location.origin}/api/functions/v1/crew-orchestrator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'stop',
        projectId,
        agentId,
      }),
    });

    const result = await response.json();
    
    // Even if there's an error, we want to update our local state
    // to reflect that the agent is no longer working
    
    // Update the agent status
    const { error: updateError } = await supabase
      .from('agent_statuses')
      .update({
        status: 'idle'
      })
      .eq('id', agentId);
      
    if (updateError) {
      console.error('Error updating agent status:', updateError);
    }
    
    if (!result.success) {
      console.error('Error stopping CrewAI task:', result.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in stopCrewAITask:', error);
    
    // Even if there's an error, try to update the agent status
    try {
      await supabase
        .from('agent_statuses')
        .update({
          status: 'idle'
        })
        .eq('id', agentId);
    } catch (updateError) {
      console.error('Error updating agent status:', updateError);
    }
    
    return false;
  }
}

/**
 * Get the CrewAI ID for a project
 * @param projectId The project ID
 * @returns The CrewAI ID or null
 */
export async function getCrewAIId(projectId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('metadata')
      .eq('id', projectId)
      .single();
      
    if (error || !data || !data.metadata) {
      return null;
    }
    
    return data.metadata.crewai_id || null;
  } catch (error) {
    console.error('Error in getCrewAIId:', error);
    return null;
  }
}

/**
 * Get the CrewAI ID for an agent
 * @param agentId The agent ID
 * @returns The CrewAI ID or null
 */
export async function getAgentCrewAIId(agentId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('agent_statuses')
      .select('metadata')
      .eq('id', agentId)
      .single();
      
    if (error || !data || !data.metadata) {
      return null;
    }
    
    return data.metadata.crewai_id || null;
  } catch (error) {
    console.error('Error in getAgentCrewAIId:', error);
    return null;
  }
}
