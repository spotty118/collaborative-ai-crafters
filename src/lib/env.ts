
/**
 * Utility for managing environment variables
 * This is used to safely access environment variables in both client and server contexts
 */

// LocalStorage keys
const OPENROUTER_API_KEY_STORAGE = 'lovable_openrouter_api_key';

export const getEnvVariable = (key: string): string | undefined => {
  // For browser environment
  if (typeof window !== 'undefined') {
    // First check localStorage for user-provided API keys
    if (key === 'OPENROUTER_API_KEY') {
      const storedKey = localStorage.getItem(OPENROUTER_API_KEY_STORAGE);
      if (storedKey) return storedKey;
    }
    
    // Then check window.__ENV__ for server-provided variables
    return (window as any).__ENV__?.[key];
  }
  
  // For Node.js environment
  return process.env[key];
};

export const setLocalEnvVariable = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;
  
  if (key === 'OPENROUTER_API_KEY') {
    localStorage.setItem(OPENROUTER_API_KEY_STORAGE, value);
  }
};

export const removeLocalEnvVariable = (key: string): void => {
  if (typeof window === 'undefined') return;
  
  if (key === 'OPENROUTER_API_KEY') {
    localStorage.removeItem(OPENROUTER_API_KEY_STORAGE);
  }
};

// Export the OpenRouter API key getter
export const getOpenRouterApiKey = (): string | undefined => {
  return getEnvVariable('OPENROUTER_API_KEY');
};

// Helper function to check if OpenRouter API key is available
export const hasOpenRouterApiKey = (): boolean => {
  return !!getEnvVariable('OPENROUTER_API_KEY');
};
