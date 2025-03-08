
import { supabase } from '@/integrations/supabase/client';
import { Agent, Project } from '@/lib/types';

interface SendAgentPromptOptions {
  model?: string;
  images?: string[];
}

/**
 * Send a prompt to an agent through OpenRouter
 * @param agent The agent to send the prompt to
 * @param prompt The prompt to send
 * @param project The project context
 * @param options Additional options like model and images
 * @returns The response from the agent
 */
export const sendAgentPrompt = async (
  agent: Agent,
  prompt: string,
  project: Project,
  options?: SendAgentPromptOptions
): Promise<string> => {
  console.log(`Sending prompt to ${agent.name} (${agent.type}) agent using ${options?.model || 'default'} model`);
  console.log(`Prompt: ${prompt.substring(0, 100)}...`);
  
  try {
    // Check if agent is in a stopped state
    if (agent.status === 'idle') {
      console.log(`Agent ${agent.name} is in idle state, stopping the operation`);
      throw new Error(`Agent ${agent.name} has been stopped or is idle. Please restart the agent to continue.`);
    }
    
    // Choose the model based on agent type or use the one specified in options
    const model = options?.model || getDefaultModelForAgentType(agent.type);
    
    // Enhance the prompt with project context
    const enhancedPrompt = addProjectContextToPrompt(prompt, project);
    
    const requestPayload = {
      agentType: agent.type,
      prompt: enhancedPrompt,
      projectContext: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
      },
      model,
      images: options?.images || []
    };
    
    console.log('Request payload to OpenRouter function:', JSON.stringify(requestPayload));
    
    const { data, error } = await supabase.functions.invoke('openrouter', {
      body: requestPayload
    });

    if (error) {
      console.error('OpenRouter function error:', error);
      throw new Error(`OpenRouter function error: ${error.message}`);
    }

    if (!data) {
      console.error('No data returned from OpenRouter function');
      throw new Error('No response received from the AI service');
    }

    console.log('Response from OpenRouter:', data);
    
    // Extract content from the response
    if (data.content) {
      return data.content;
    } else if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    } else {
      console.warn('Unexpected response format from OpenRouter:', data);
      return 'I received your request but encountered an issue processing it.';
    }
  } catch (error) {
    console.error('Error in sendAgentPrompt:', error);
    throw new Error(`Failed to get response from OpenRouter: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Helper functions

/**
 * Get the default model for an agent type
 */
function getDefaultModelForAgentType(agentType: string): string {
  switch (agentType) {
    case 'architect':
    case 'backend':
      return 'anthropic/claude-3.5-sonnet:thinking';
    case 'frontend':
      return 'anthropic/claude-3.5-sonnet:thinking';
    case 'testing':
      return 'anthropic/claude-3.5-sonnet:thinking';
    case 'devops':
      return 'anthropic/claude-3.5-sonnet:thinking';
    default:
      return 'anthropic/claude-3.5-sonnet:thinking';
  }
}

/**
 * Add project context to a prompt
 */
function addProjectContextToPrompt(prompt: string, project: Project): string {
  return `Project: ${project.name}
Description: ${project.description || 'No description'}
${project.tech_stack && project.tech_stack.length > 0 ? `Tech Stack: ${project.tech_stack.join(', ')}` : ''}

IMPORTANT: When asked to create or modify code, you MUST provide complete, functional code files that can be directly used in the project. Don't provide snippets or partial code. Always include imports and full implementation.

${prompt}`;
}

/**
 * Analyze a GitHub repository and create tasks
 */
export const analyzeGitHubAndCreateTasks = async (
  repoUrl: string,
  project: Project
): Promise<void> => {
  // Implement GitHub analysis functionality here
  console.log(`Analyzing GitHub repository: ${repoUrl} for project ${project.id}`);
};
