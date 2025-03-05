
import { GitHubService as BaseGitHubService, createGitHubService } from '../github';

let instance: BaseGitHubService | null = null;

export const getGitHubService = () => {
  if (!instance) {
    throw new Error('GitHub service not initialized');
  }
  return instance;
};

export const initGitHubService = async (url: string, token: string) => {
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
        setTimeout(() => reject(new Error('GitHub connection verification timed out')), 15000)
      );
      
      await Promise.race([
        verifyGitHubConnection(instance),
        timeoutPromise
      ]);
      
      console.log('GitHub connection verified successfully');
      return instance;
    } catch (error) {
      console.error('Failed to verify GitHub connection:', error);
      // Don't clear the instance here as the repo might just be empty
      throw error; // Propagate error up to caller
    }
  } catch (error) {
    console.error('Failed to initialize GitHub service:', error);
    instance = null; // Ensure instance is cleared on error
    throw error;
  }
};

// Separate function to verify GitHub connection with multiple fallbacks
async function verifyGitHubConnection(github: BaseGitHubService) {
  try {
    // Try common files first
    const commonFiles = ['.gitignore', 'README.md', 'package.json', 'src/index.js', 'src/index.ts'];
    
    for (const file of commonFiles) {
      try {
        await github.getFileContent(file);
        console.log(`GitHub connection verified through file: ${file}`);
        return true;
      } catch (error) {
        // Just try the next file
        console.log(`File ${file} not found, trying next...`);
      }
    }
    
    // If no files found, try listing repository contents
    const contents = await github.octokit.repos.getContent({
      owner: github.owner,
      repo: github.repo,
      path: '',
    });
    
    if (contents.status === 200) {
      console.log('Repository exists and is accessible');
      return true;
    }
    
    throw new Error('Could not verify repository content');
  } catch (error) {
    console.error('All verification methods failed:', error);
    throw new Error('Unable to access repository. Please check your token and repository URL.');
  }
}

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
    console.log('Attempting to restore GitHub service from localStorage');
    try {
      initGitHubService(storedUrl, storedToken).catch(error => {
        console.error('Failed to restore GitHub service:', error);
      });
    } catch (error) {
      console.error('Failed to restore GitHub service from localStorage:', error);
    }
  }
} catch (error) {
  console.error('Failed to access localStorage:', error);
}
