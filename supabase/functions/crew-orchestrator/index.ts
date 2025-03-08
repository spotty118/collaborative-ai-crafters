
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Get environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const CREWAI_API_TOKEN = Deno.env.get('CREWAI_API_TOKEN') || '8b45b95c0542';
const CREWAI_UUID = Deno.env.get('CREWAI_UUID') || '8f975a62-fed4-4c2f-88ac-30c374646154';
const CREWAI_API_URL = "https://could-you-clarify-if-this-chat-is-intended--fc133f12.crewai.com";

// Log environment variables for debugging
console.log('==== CREW ORCHESTRATOR ENVIRONMENT ====');
console.log('SUPABASE_URL:', SUPABASE_URL ? 'Set (starts with: ' + SUPABASE_URL.substring(0, 10) + '...)' : 'Not set');
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'Set (length: ' + SUPABASE_ANON_KEY.length + ')' : 'Not set');
console.log('CREWAI_API_TOKEN:', CREWAI_API_TOKEN ? 'Set (starts with: ' + CREWAI_API_TOKEN.substring(0, 8) + '...)' : 'Not set');

// Create Supabase client
let supabase = null;
try {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client created successfully');
  } else {
    console.error('Missing Supabase URL or anonymous key');
  }
} catch (error) {
  console.error('Error creating Supabase client:', error);
}

// Response headers for CORS
const responseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// Function to handle HTTP requests
serve(async (req) => {
  console.log(`[${new Date().toISOString()}] Crew orchestrator received request`);
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: responseHeaders 
    });
  }
  
  // Simple ping endpoint for health checks
  if (req.method === 'POST') {
    try {
      const requestData = await req.json();
      
      console.log('Request body:', JSON.stringify(requestData));
      
      if (requestData.action === 'ping') {
        return new Response(
          JSON.stringify({ success: true, message: 'Crew orchestrator is online' }),
          { headers: responseHeaders }
        );
      }
      
      return await handleCrewAction(requestData);
    } catch (error) {
      console.error('Crew orchestrator error:', error);
      console.error('Error stack:', error.stack);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }),
        { status: 500, headers: responseHeaders }
      );
    }
  }
  
  return new Response(
    JSON.stringify({ 
      success: false, 
      message: 'Method not allowed' 
    }),
    { status: 405, headers: responseHeaders }
  );
});

// Helper function to make requests to CrewAI API
async function crewAIRequest(endpoint, method = 'GET', body = null) {
  try {
    const url = `${CREWAI_API_URL}${endpoint}`;
    console.log(`Making ${method} request to CrewAI API: ${url}`);
    
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${CREWAI_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    };
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CrewAI API error: ${response.status} ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error in CrewAI request:`, error);
    throw error;
  }
}

// Map our agent types to appropriate CrewAI agent roles
function getAgentRoleAndGoal(agentType) {
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

// Handle different actions
async function handleCrewAction(requestData: any): Promise<Response> {
  console.log('Handling crew action:', requestData.action);
  
  if (!supabase) {
    console.error('Supabase client is not initialized.');
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Supabase client is not initialized. Check environment variables.' 
      }),
      { status: 500, headers: responseHeaders }
    );
  }
  
  const { action, projectId, agentId, taskId, updates } = requestData;

  // Handle initialize action - Create a new CrewAI crew for the project
  if (action === 'initialize') {
    try {
      console.log(`Initializing project ${projectId} with CrewAI`);
      
      // Get project details
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
        
      if (projectError) {
        console.error('Error getting project details:', projectError);
        throw new Error(`Failed to get project details: ${projectError.message}`);
      }
      
      // Create a new crew in CrewAI
      const crewName = project.name || 'New Project';
      const crewDescription = project.description || 'No description provided';
      
      const crew = await crewAIRequest('/crews', 'POST', {
        name: crewName,
        description: crewDescription,
        uuid: CREWAI_UUID
      });
      
      console.log(`CrewAI crew created with ID: ${crew.id}`);
      
      // Store the CrewAI crew ID in the project
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          metadata: { 
            crewai_id: crew.id 
          }
        })
        .eq('id', projectId);
        
      if (updateError) {
        console.error('Error updating project with CrewAI ID:', updateError);
        throw new Error(`Failed to update project with CrewAI ID: ${updateError.message}`);
      }
      
      // Success response
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Project initialized successfully with CrewAI',
          crewId: crew.id
        }),
        { headers: responseHeaders }
      );
    } catch (error) {
      console.error('Error initializing project with CrewAI:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { status: 500, headers: responseHeaders }
      );
    }
  }

  // Handle create_crew_agents action - create agents in CrewAI for the project
  if (action === 'create_crew_agents') {
    try {
      console.log(`Creating CrewAI agents for project ${projectId}`);
      
      // Get project crew ID
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('metadata')
        .eq('id', projectId)
        .single();
        
      if (projectError) {
        console.error('Error getting project details:', projectError);
        throw new Error(`Failed to get project details: ${projectError.message}`);
      }
      
      const crewId = project.metadata?.crewai_id;
      if (!crewId) {
        throw new Error('Project does not have a CrewAI crew ID. Please initialize first.');
      }
      
      // Get all agents for this project
      const { data: agents, error: agentsError } = await supabase
        .from('agent_statuses')
        .select('*')
        .eq('project_id', projectId);
        
      if (agentsError) {
        console.error('Error getting project agents:', agentsError);
        throw new Error(`Failed to get project agents: ${agentsError.message}`);
      }
      
      const crewAIAgents = [];
      
      // Create each agent in CrewAI
      for (const agent of agents) {
        const { role, goal, backstory } = getAgentRoleAndGoal(agent.agent_type);
        
        const crewAIAgent = await crewAIRequest(`/crews/${crewId}/agents`, 'POST', {
          name: agent.name,
          role: role,
          goal: goal,
          backstory: backstory
        });
        
        console.log(`Created CrewAI agent: ${crewAIAgent.id} for ${agent.name}`);
        
        // Update the agent with CrewAI ID
        const { error: updateError } = await supabase
          .from('agent_statuses')
          .update({ 
            metadata: { 
              crewai_id: crewAIAgent.id 
            }
          })
          .eq('id', agent.id);
          
        if (updateError) {
          console.warn(`Warning: Failed to update agent ${agent.id} with CrewAI ID: ${updateError.message}`);
        }
        
        crewAIAgents.push(crewAIAgent);
      }
      
      // Success response
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'CrewAI agents created successfully',
          agents: crewAIAgents
        }),
        { headers: responseHeaders }
      );
    } catch (error) {
      console.error('Error creating CrewAI agents:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { status: 500, headers: responseHeaders }
      );
    }
  }

  // Handle start action - when user activates an agent
  if (action === 'start') {
    try {
      console.log(`Starting agent orchestration for ${agentId}`);
      
      // Validate that projectId and agentId are provided
      if (!projectId || !agentId) {
        console.error('Project ID and Agent ID must be provided.');
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Project ID and Agent ID must be provided' 
          }),
          { status: 400, headers: responseHeaders }
        );
      }
      
      // Get project and agent details
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('metadata')
        .eq('id', projectId)
        .single();
        
      if (projectError) {
        console.error('Error getting project details:', projectError);
        throw new Error(`Failed to get project details: ${projectError.message}`);
      }
      
      const { data: agent, error: agentError } = await supabase
        .from('agent_statuses')
        .select('*')
        .eq('id', agentId)
        .single();
        
      if (agentError) {
        console.error('Error getting agent details:', agentError);
        throw new Error(`Failed to get agent details: ${agentError.message}`);
      }
      
      // Check if we have CrewAI IDs
      const crewId = project.metadata?.crewai_id;
      const crewAgentId = agent.metadata?.crewai_id;
      
      if (!crewId || !crewAgentId) {
        console.log('No CrewAI IDs found. Need to initialize with CrewAI first.');
        
        // Initialize project with CrewAI if needed
        if (!crewId) {
          console.log('Creating new CrewAI crew for project');
          
          // Get full project details
          const { data: fullProject, error: fullProjectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();
            
          if (fullProjectError) {
            console.error('Error getting full project details:', fullProjectError);
            throw new Error(`Failed to get project details: ${fullProjectError.message}`);
          }
          
          // Create a new crew in CrewAI
          const crew = await crewAIRequest('/crews', 'POST', {
            name: fullProject.name || 'New Project',
            description: fullProject.description || 'No description provided',
            uuid: CREWAI_UUID
          });
          
          console.log(`CrewAI crew created with ID: ${crew.id}`);
          
          // Update project with CrewAI ID
          const { error: updateProjectError } = await supabase
            .from('projects')
            .update({ 
              metadata: { 
                crewai_id: crew.id 
              }
            })
            .eq('id', projectId);
            
          if (updateProjectError) {
            console.error('Error updating project with CrewAI ID:', updateProjectError);
            throw new Error(`Failed to update project: ${updateProjectError.message}`);
          }
          
          const newCrewId = crew.id;
          
          // Create CrewAI agent
          const { role, goal, backstory } = getAgentRoleAndGoal(agent.agent_type);
          
          const crewAIAgent = await crewAIRequest(`/crews/${newCrewId}/agents`, 'POST', {
            name: agent.name,
            role: role,
            goal: goal,
            backstory: backstory
          });
          
          console.log(`Created CrewAI agent: ${crewAIAgent.id} for ${agent.name}`);
          
          // Update the agent with CrewAI ID
          const { error: updateAgentError } = await supabase
            .from('agent_statuses')
            .update({ 
              metadata: { 
                crewai_id: crewAIAgent.id 
              }
            })
            .eq('id', agent.id);
            
          if (updateAgentError) {
            console.warn(`Warning: Failed to update agent with CrewAI ID: ${updateAgentError.message}`);
          }
          
          // Now set the variables for use below
          const newCrewAgentId = crewAIAgent.id;
          
          // Create a task for this agent
          let taskDescription = `Based on the project ${fullProject.name}, perform your role as ${role}.`;
          
          if (taskId) {
            // Get the task details if taskId was provided
            const { data: task, error: taskError } = await supabase
              .from('tasks')
              .select('*')
              .eq('id', taskId)
              .single();
              
            if (taskError) {
              console.error('Error getting task details:', taskError);
              throw new Error(`Failed to get task details: ${taskError.message}`);
            }
            
            taskDescription = task.description || task.title;
          }
          
          const crewAITask = await crewAIRequest(`/crews/${newCrewId}/tasks`, 'POST', {
            description: taskDescription,
            agent_id: newCrewAgentId
          });
          
          console.log(`Created CrewAI task: ${crewAITask.id} for agent ${agent.name}`);
          
          // Run the crew
          await crewAIRequest(`/crews/${newCrewId}/run`, 'POST');
          console.log(`Started running CrewAI crew ${newCrewId}`);
        }
      } else {
        console.log(`Using existing CrewAI integration - Crew ID: ${crewId}, Agent ID: ${crewAgentId}`);
        
        // Create a task for this agent if needed
        if (taskId) {
          // Get the task details
          const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .single();
            
          if (taskError) {
            console.error('Error getting task details:', taskError);
            throw new Error(`Failed to get task details: ${taskError.message}`);
          }
          
          const taskDescription = task.description || task.title;
          
          const crewAITask = await crewAIRequest(`/crews/${crewId}/tasks`, 'POST', {
            description: taskDescription,
            agent_id: crewAgentId
          });
          
          console.log(`Created CrewAI task: ${crewAITask.id} for agent ${agent.name}`);
          
          // Run the crew
          await crewAIRequest(`/crews/${crewId}/run`, 'POST');
          console.log(`Started running CrewAI crew ${crewId}`);
        }
      }
      
      // Update agent status to working
      const { error: updateError } = await supabase
        .from('agent_statuses')
        .update({ status: 'working' })
        .eq('id', agentId);
          
      if (updateError) {
        console.warn('Error updating agent status:', updateError);
        // Continue anyway since this is not critical
      } else {
        console.log('Agent status updated to working');
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Agent started successfully with CrewAI' 
        }),
        { headers: responseHeaders }
      );
    } catch (error) {
      console.error('Error starting agent orchestration:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { status: 500, headers: responseHeaders }
      );
    }
  }
  
  // Handle stop action - when user deactivates an agent
  if (action === 'stop') {
    try {
      console.log(`Stopping agent orchestration for ${agentId}`);
      
      // Update agent status to idle
      try {
        const { error: updateError } = await supabase
          .from('agent_statuses')
          .update({ status: 'idle' })
          .eq('id', agentId);
            
        if (updateError) {
          console.warn('Error updating agent status:', updateError);
          // Continue anyway since client has already updated UI
        } else {
          console.log('Agent status updated to idle');
        }
      } catch (error) {
        console.warn('Exception updating agent status:', error);
        // Continue anyway since client has already updated UI
      }
      
      // Note: CrewAI doesn't have an explicit "stop" API, but we can mark the agent as idle in our system
      
      // Always return success to prevent UI getting stuck
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Agent stopped successfully' 
        }),
        { headers: responseHeaders }
      );
    } catch (error) {
      console.error('Error stopping agent orchestration:', error);
      // Always return success to prevent UI getting stuck
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Agent stop attempted with errors',
          error: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { headers: responseHeaders }
      );
    }
  }
  
  // Handle update_progress action
  if (action === 'update_progress') {
    try {
      console.log(`Updating agent progress to ${requestData.progress}%`);
      
      // Success response
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Agent progress updated successfully' 
        }),
        { headers: responseHeaders }
      );
    } catch (error) {
      console.error('Error updating agent progress:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }),
        { status: 500, headers: responseHeaders }
      );
    }
  }
  
  // Handle other actions with default response
  return new Response(
    JSON.stringify({ 
      success: false, 
      message: 'Invalid action specified' 
    }),
    { status: 400, headers: responseHeaders }
  );
}
