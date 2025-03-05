
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
    // Validate token format - basic check
    if (!token.match(/^(ghp_|github_pat_)[a-zA-Z0-9_]+$/)) {
      console.warn('GitHub token format might be invalid. It should start with ghp_ or github_pat_');
    }
    
    instance = createGitHubService(url, token);
    
    // Store token in localStorage for persistence
    localStorage.setItem('github-token', token);
    localStorage.setItem('github-url', url);
    
    console.log('GitHub service initialized successfully');
    return instance;
  } catch (error) {
    console.error('Failed to initialize GitHub service:', error);
    instance = null; // Ensure instance is cleared on error
    throw error;
  }
};

export const clearGitHubService = () => {
  instance = null;
  // Clear stored values
  localStorage.removeItem('github-token');
  localStorage.removeItem('github-url');
  console.log('GitHub service cleared');
};

export const isGitHubServiceInitialized = () => {
  return instance !== null;
};

// Try to restore from localStorage on module load
try {
  const storedToken = localStorage.getItem('github-token');
  const storedUrl = localStorage.getItem('github-url');
  
  if (storedToken && storedUrl) {
    initGitHubService(storedUrl, storedToken);
  }
} catch (error) {
  console.error('Failed to restore GitHub service from localStorage:', error);
}
