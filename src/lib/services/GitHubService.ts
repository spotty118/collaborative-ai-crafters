
import { GitHubService as BaseGitHubService, createGitHubService } from '../github';

let instance: BaseGitHubService | null = null;
let currentBranch: string = 'main'; // Default branch

export const getGitHubService = () => {
  if (!instance) {
    throw new Error('GitHub service not initialized');
  }
  return instance;
};

export const initGitHubService = (url: string, token: string, branch?: string) => {
  if (!url.trim() || !token.trim()) {
    throw new Error('GitHub URL and token are required');
  }
  
  try {
    instance = createGitHubService(url, token);
    // Set the branch if provided
    if (branch) {
      currentBranch = branch;
    }
    console.log(`GitHub service initialized successfully on branch: ${currentBranch}`);
    return instance;
  } catch (error) {
    console.error('Failed to initialize GitHub service:', error);
    throw error;
  }
};

export const getCurrentBranch = () => {
  return currentBranch;
};

export const setCurrentBranch = (branch: string) => {
  if (!branch.trim()) {
    throw new Error('Branch name cannot be empty');
  }
  currentBranch = branch;
  console.log(`GitHub service branch set to: ${currentBranch}`);
};

export const clearGitHubService = () => {
  instance = null;
  currentBranch = 'main'; // Reset to default
  console.log('GitHub service cleared');
};

export const isGitHubServiceInitialized = () => {
  return instance !== null;
};
