
import { GitHubService as BaseGitHubService, createGitHubService } from '../github';

// Store the service instance
let instance: BaseGitHubService | null = null;
let currentBranch: string = 'main'; // Default branch
let currentRepo: string = '';
let currentToken: string = '';

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
    // Clean up URL if needed
    const cleanUrl = url.trim();
    currentRepo = cleanUrl;
    currentToken = token;
    
    // Create a new instance
    instance = createGitHubService(cleanUrl, token);
    
    // Set the branch if provided
    if (branch && branch.trim()) {
      currentBranch = branch.trim();
    }
    
    console.log(`GitHub service initialized successfully on branch: ${currentBranch}`);
    console.log(`Repository URL: ${currentRepo}`);
    
    // Immediately test connection to verify everything is working
    instance.testConnection()
      .then(success => {
        if (success) {
          console.log('GitHub connection verified successfully');
          // Check if branch exists
          return instance?.listBranches() || [];
        } else {
          console.error('GitHub connection test failed');
          return [];
        }
      })
      .then(branches => {
        if (branches.length > 0) {
          if (branches.includes(currentBranch)) {
            console.log(`Branch '${currentBranch}' exists and is valid`);
          } else {
            console.warn(`Branch '${currentBranch}' does not exist. Available branches: ${branches.join(', ')}`);
            // Auto-select first available branch if current doesn't exist
            if (branches.length > 0) {
              console.log(`Auto-selecting branch '${branches[0]}'`);
              currentBranch = branches[0];
            }
          }
        }
      })
      .catch(err => {
        console.error('Error during GitHub connection verification:', err);
      });
    
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
  
  currentBranch = branch.trim();
  console.log(`GitHub service branch set to: ${currentBranch}`);
  
  // Verify the branch exists if we have an initialized service
  if (instance) {
    instance.listBranches()
      .then(branches => {
        if (!branches.includes(currentBranch)) {
          console.warn(`Warning: Branch '${currentBranch}' might not exist. Available branches: ${branches.join(', ')}`);
        } else {
          console.log(`Confirmed branch '${currentBranch}' exists`);
        }
      })
      .catch(err => {
        console.error('Error checking branch existence:', err);
      });
  }
};

export const clearGitHubService = () => {
  instance = null;
  currentBranch = 'main'; // Reset to default
  currentRepo = '';
  currentToken = '';
  console.log('GitHub service cleared');
};

export const isGitHubServiceInitialized = () => {
  return instance !== null;
};

export const getRepositoryInfo = () => {
  return {
    url: currentRepo,
    branch: currentBranch
  };
};

export const reinitializeGitHubService = () => {
  if (currentRepo && currentToken) {
    return initGitHubService(currentRepo, currentToken, currentBranch);
  }
  return null;
};

// Helper function to normalize file paths for GitHub API
export const normalizeFilePath = (path: string): string => {
  // Remove any leading slash or backslash
  let normalizedPath = path.replace(/^[/\\]+/, '');
  
  // Replace backslashes with forward slashes (for Windows paths)
  normalizedPath = normalizedPath.replace(/\\/g, '/');
  
  console.log(`Normalized path: ${path} → ${normalizedPath}`);
  return normalizedPath;
};
