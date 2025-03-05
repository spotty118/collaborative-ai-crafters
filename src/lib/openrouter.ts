
import { supabase } from '@/integrations/supabase/client';
import { Agent, Project } from './types';

export interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    index: number;
    finish_reason: string;
  }[];
  error?: string;
}

/**
 * Send a prompt to an agent and get a response via OpenRouter
 */
export const sendAgentPrompt = async (
  agent: Agent,
  prompt: string,
  project?: Project
): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('openrouter', {
      body: {
        agentType: agent.type,
        prompt,
        projectContext: project ? {
          id: project.id,
          name: project.name,
          description: project.description,
          tech_stack: project.tech_stack,
          status: project.status
        } : {}
      }
    });

    if (error) {
      console.error('Error calling OpenRouter function:', error);
      return `Error: ${error.message}`;
    }

    const response = data as OpenRouterResponse;
    
    if (response.error) {
      console.error('OpenRouter API error:', response.error);
      return `Error: ${response.error}`;
    }

    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content;
    }

    return 'No response generated. Please try again.';
  } catch (error) {
    console.error('Exception when calling OpenRouter:', error);
    return `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
  }
};
