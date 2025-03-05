
import { GitHubService as BaseGitHubService, createGitHubService } from '../github';

let instance: BaseGitHubService | null = null;

export const getGitHubService = () => {
  if (!instance) {
    throw new Error('GitHub service not initialized');
  }
  return instance;
};

export const initGitHubService = (url: string, token: string) => {
  if (!url.trim() || !token.trim()) {
    throw new Error('GitHub URL and token are required');
  }
  
  try {
    instance = createGitHubService(url, token);
    console.log('GitHub service initialized successfully');
    return instance;
  } catch (error) {
    console.error('Failed to initialize GitHub service:', error);
    throw error;
  }
};

export const clearGitHubService = () => {
  instance = null;
  console.log('GitHub service cleared');
};

export const isGitHubServiceInitialized = () => {
  return instance !== null;
};
