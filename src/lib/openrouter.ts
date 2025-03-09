
import { supabase } from '@/integrations/supabase/client';
import { VectorDatabase } from './vectorDb';
import { Project, Agent } from './types';

export interface SendAgentPromptOptions {
  prompt: string;
  agentType?: string;
  expectCode?: boolean;
  model?: string;
  task?: string;
  images?: string[];
  useVectorContext?: boolean;
  context?: string;
  ignoreStatus?: boolean;
}

/**
 * Send a prompt to an AI agent via OpenRouter
 */
export async function sendAgentPrompt(
  agent: Agent | string,
  prompt: string,
  project?: Project,
  options: Partial<SendAgentPromptOptions> = {}
) {
  try {
    // If agent is a string, treat it as the agent type
    const agentType = typeof agent === 'string' ? agent : agent.type;
    
    // Extract options with defaults
    const { 
      expectCode = false, 
      model = 'anthropic/claude-3-5-sonnet',
      task = '',
      images = [],
      useVectorContext = false,
      context = '',
      ignoreStatus = false
    } = options;

    // Get project context
    let projectContext = project;
    if (!projectContext) {
      projectContext = getProjectContextFromUrl();
    }
    
    // If we have a project context and vector context is enabled, store the prompt
    if (projectContext && useVectorContext) {
      try {
        await VectorDatabase.storeEmbedding(
          projectContext.id,
          prompt,
          { 
            type: 'prompt',
            agent_type: agentType,
            task: task
          }
        );
        console.log('Stored prompt in vector database');
      } catch (error) {
        console.error('Failed to store prompt in vector database:', error);
      }
    }

    // Prepare the request body
    const requestBody = {
      prompt,
      agentType,
      projectContext,
      model,
      expectCode,
      task,
      images,
      useVectorContext
    };

    // Call the OpenRouter edge function
    const response = await fetch('/api/openrouter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API Error: ${errorText}`);
    }

    const data = await response.json();
    
    // Extract and return just the message content
    if (data?.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    
    return 'No response content available';
  } catch (error) {
    console.error('Error sending prompt to agent:', error);
    throw error;
  }
}

/**
 * Helper to extract project context from the URL
 */
function getProjectContextFromUrl(): Project | null {
  try {
    // Get the current path
    const path = window.location.pathname;
    
    // Check if we're on a project page
    if (path.includes('/project/')) {
      // Extract the project ID
      const projectId = path.split('/project/')[1];
      
      // Return a Project object with required properties
      return {
        id: projectId,
        name: 'Current Project',
        description: '', // Add the missing required property
        mode: 'existing' as const // Add the missing required property and cast to the correct type
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting project context from URL:', error);
    return null;
  }
}

/**
 * Sets the OpenRouter API key for future use
 */
export const setOpenRouterApiKey = (apiKey: string): boolean => {
  if (!apiKey) return false;
  
  try {
    // Save to localStorage
    localStorage.setItem('OPENROUTER_API_KEY', apiKey);
    
    // Return true to indicate success
    return true;
  } catch (error) {
    console.error('Error setting OpenRouter API key:', error);
    return false;
  }
};

/**
 * Gets the OpenRouter API key from localStorage
 */
export const getOpenRouterApiKey = (): string | null => {
  try {
    return localStorage.getItem('OPENROUTER_API_KEY');
  } catch (error) {
    console.error('Error getting OpenRouter API key:', error);
    return null;
  }
};
