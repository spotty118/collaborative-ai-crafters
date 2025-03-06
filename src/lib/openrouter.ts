import { Agent, Project } from '@/lib/types';
import { createMessage } from '@/lib/api';
import { broadcastMessage } from './agent/messageBroker';

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Send a prompt to the agent using OpenRouter
 */
export const sendAgentPrompt = async (
  agent: Agent,
  prompt: string,
  project: Project
): Promise<string> => {
  try {
    // Get the OpenRouter API key from environment variables
    const openRouterApiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
    
    if (!openRouterApiKey) {
      throw new Error("OpenRouter API key is missing. Please set the OPENROUTER_API_KEY environment variable.");
    }
    
    // Construct the request body
    const requestBody = {
      model: "mistralai/mistral-medium",
      messages: [
        {
          role: "system",
          content: `You are an AI agent specializing in ${agent.type || 'software development'}.
Your role is to help build a software project named "${project.name}".
${project.description ? `Project description: ${project.description}` : ''}

As the ${agent.type} specialist, your responsibilities include:
- Writing high-quality, well-documented code
- Following best practices for software development
- Collaborating effectively with other specialists`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      // Add any other parameters required by the OpenRouter API
    };
    
    // Make the API request to OpenRouter
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    
    // Check if the request was successful
    if (!response.ok) {
      console.error('OpenRouter API Error:', response.status, response.statusText);
      const errorData = await response.json();
      console.error('OpenRouter API Error Details:', errorData);
      throw new Error(`OpenRouter API request failed with status ${response.status}: ${response.statusText}`);
    }
    
    // Parse the response as JSON
    const responseData = await response.json();
    
    // Extract the agent's response from the API response
    const agentResponse = responseData.choices[0].message.content;
    
    // Log the interaction
    console.log(`Agent ${agent.name} response:`, agentResponse);
    
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
