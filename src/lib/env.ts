
/**
 * Utility for managing environment variables
 * This is used to safely access environment variables in both client and server contexts
 */

export const getEnvVariable = (key: string): string | undefined => {
  // For browser environment
  if (typeof window !== 'undefined') {
    return (window as any).__ENV__?.[key];
  }
  
  // For Node.js environment
  return process.env[key];
};

export const OPENROUTER_API_KEY = getEnvVariable('OPENROUTER_API_KEY');
