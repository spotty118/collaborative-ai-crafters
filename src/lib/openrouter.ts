
import { Agent, Project } from '@/lib/types';
import { createMessage } from '@/lib/api';
import { broadcastMessage } from './agent/messageBroker';

/**
 * Send a prompt to the agent using OpenRouter
 */
export const sendAgentPrompt = async (
  agent: Agent,
  prompt: string,
  project: Project
): Promise<string> => {
  try {
    console.log(`Sending prompt to ${agent.name}: ${prompt.substring(0, 50)}...`);
    
    // Send the request to our Supabase Edge Function for OpenRouter
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openrouter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        agentType: agent.type,
        projectContext: {
          name: project.name,
          description: project.description,
          sourceUrl: project.sourceUrl,
          sourceType: project.sourceType,
          id: project.id,
          created_at: project.created_at
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenRouter API Error:', errorData);
      throw new Error(`OpenRouter API request failed: ${errorData.error || response.statusText}`);
    }

    const responseData = await response.json();
    const agentResponse = responseData.choices[0].message.content;
    
    // Check if the response includes progress update data
    if (responseData.progressUpdate && responseData.progressUpdate.progress) {
      // This would be handled by the orchestrator now, but we could add a fallback here
      console.log(`Agent ${agent.name} progress update:`, responseData.progressUpdate.progress);
    }
    
    console.log(`Agent ${agent.name} response:`, agentResponse.substring(0, 100) + '...');
    
    return agentResponse;
  } catch (error: any) {
    console.error("Error in sendAgentPrompt:", error);
    
    // Create an error message in chat
    if (project.id) {
      await createMessage({
        project_id: project.id,
        content: `I encountered an error: ${error.message}`,
        sender: agent.name,
        type: "error"
      });
    }
    
    throw error;
  }
};

/**
 * Send a team collaborative prompt to multiple agents
 */
export const sendTeamPrompt = async (
  agents: Agent[],
  prompt: string,
  project: Project
): Promise<Record<string, string>> => {
  try {
    console.log(`Sending team prompt to ${agents.length} agents: ${prompt.substring(0, 50)}...`);
    
    // Create a map to store each agent's response
    const responses: Record<string, string> = {};
    
    // Process agents in sequence for a more coherent conversation flow
    for (const agent of agents) {
      // Add context about which agents are participating
      const teamContext = {
        team: agents.map(a => ({ name: a.name, type: a.type })),
        currentAgent: { name: agent.name, type: agent.type }
      };
      
      // Create an enhanced prompt that includes team context
      const enhancedPrompt = `
As part of a development team that includes ${agents.map(a => a.name).join(', ')}, 
please respond to the following request from the user:

${prompt}

Remember that you are the ${agent.name} (${agent.type}) and should focus on your specialty 
while acknowledging the roles of your teammates.`;
      
      // Send the request to our Supabase Edge Function for OpenRouter
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openrouter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          agentType: agent.type,
          projectContext: {
            name: project.name,
            description: project.description,
            sourceUrl: project.sourceUrl,
            sourceType: project.sourceType,
            id: project.id,
            created_at: project.created_at,
            teamContext
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`OpenRouter API Error for ${agent.name}:`, errorData);
        responses[agent.id] = `I couldn't process this request due to an error: ${errorData.error || response.statusText}`;
        continue;
      }

      const responseData = await response.json();
      const agentResponse = responseData.choices[0].message.content;
      
      // Store the response
      responses[agent.id] = agentResponse;
      
      // Send the message to the chat
      await createMessage({
        project_id: project.id,
        content: agentResponse,
        sender: agent.name,
        type: "text"
      });
      
      // Small delay between agent responses to make the conversation more natural
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return responses;
  } catch (error: any) {
    console.error("Error in sendTeamPrompt:", error);
    
    // Create an error message in chat
    if (project.id) {
      await createMessage({
        project_id: project.id,
        content: `Team communication error: ${error.message}`,
        sender: "System",
        type: "error"
      });
    }
    
    throw error;
  }
};
