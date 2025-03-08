
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
    // Clear any previous instance
    if (instance) {
      console.log('Clearing previous GitHub service instance');
      instance = null;
    }
    
    // Validate token format - basic check
    if (!token.match(/^(ghp_|github_pat_)[a-zA-Z0-9_]+$/)) {
      console.warn('GitHub token format might be invalid. It should start with ghp_ or github_pat_');
    }
    
    // Create a new instance
    instance = createGitHubService(url, token);
    console.log('GitHub service initialized successfully');
    
    // Store token in localStorage for persistence
    localStorage.setItem('github-token', token);
    localStorage.setItem('github-url', url);
    
    // Test the connection with a simple API call
    try {
      // We'll use a Promise.race to limit the wait time
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('GitHub connection verification timed out')), 10000)
      );
      
      Promise.race([
        instance.getFileContent('.gitignore'),
        timeoutPromise
      ])
      .then(() => console.log('GitHub connection verified successfully'))
      .catch(error => {
        console.error('Failed to verify GitHub connection:', error);
        // Don't clear the instance here as the file might just not exist
      });
    } catch (error) {
      console.error('Failed to verify GitHub connection:', error);
    }
    
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

// Create a local content cache
const localContentCache: Record<string, string> = {};

// Export functions to get and set local content
export const setLocalFileContent = (path: string, content: string) => {
  localContentCache[path] = content;
};

export const getLocalFileContent = (path: string): string | null => {
  return localContentCache[path] || null;
};

// Try to restore from localStorage on module load
try {
  const storedToken = localStorage.getItem('github-token');
  const storedUrl = localStorage.getItem('github-url');
  
  if (storedToken && storedUrl) {
    console.log('Attempting to restore GitHub service from localStorage');
    try {
      initGitHubService(storedUrl, storedToken);
    } catch (error) {
      console.error('Failed to restore GitHub service from localStorage:', error);
    }
  }
} catch (error) {
  console.error('Failed to access localStorage:', error);
}
