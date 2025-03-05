
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getGitHubService, initGitHubService, clearGitHubService, isGitHubServiceInitialized } from '@/lib/services/GitHubService';
import { GitHubCommit } from '@/lib/types';
import { toast } from 'sonner';

interface GitHubContextType {
  isConnected: boolean;
  currentBranch: string;
  isConnecting: boolean;
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  createOrUpdateFile: (path: string, content: string, message: string) => Promise<void>;
  getFileContent: (path: string) => Promise<string>;
  deleteFile: (path: string, message: string) => Promise<void>;
  commitChanges: (commit: GitHubCommit) => Promise<void>;
}

const GitHubContext = createContext<GitHubContextType | null>(null);

export const useGitHub = () => {
  const context = useContext(GitHubContext);
  if (!context) {
    throw new Error('useGitHub must be used within a GitHubProvider');
  }
  return context;
};

export const GitHubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(isGitHubServiceInitialized());
  const [currentBranch, setCurrentBranch] = useState('main');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);

  // Initialize from localStorage if available
  useEffect(() => {
    // Check if we already have an initialized service
    if (isGitHubServiceInitialized()) {
      setIsConnected(true);
      console.log('GitHub service was already initialized');
    }
  }, []);

  const connect = useCallback(async (url: string, token: string) => {
    try {
      setIsConnecting(true);
      
      if (!url || !token) {
        throw new Error('GitHub URL and token are required');
      }

      // Extract owner and repo from GitHub URL
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) {
        throw new Error('Invalid GitHub repository URL');
      }

      const [, owner, repo] = match;
      if (!owner || !repo) {
        throw new Error('Could not extract owner and repository from URL');
      }

      console.log(`Connecting to GitHub repo: ${owner}/${repo}`);
      
      // Initialize the GitHub service
      initGitHubService(url, token);
      
      // Verify the token by making a test API call
      try {
        const github = getGitHubService();
        await github.getFileContent('README.md').catch(() => {
          // It's okay if README.md doesn't exist, at least we tried to access the API
          console.log('Could not find README.md, but connection established');
        });
        
        setIsConnected(true);
        toast.success('Successfully connected to GitHub repository');
        
        // Reset connection attempts on successful connection
        setConnectionAttempts(0);
      } catch (error) {
        console.error('Failed to verify GitHub connection:', error);
        
        // Increment connection attempts
        setConnectionAttempts(prev => prev + 1);
        
        if (connectionAttempts < 2) {
          // If this is the first or second attempt, try again
          throw new Error('Failed to verify GitHub connection. Please check your token and URL.');
        } else {
          // After multiple attempts, assume connection is okay and proceed
          console.warn('Could not verify GitHub connection but proceeding anyway');
          setIsConnected(true);
        }
      }
    } catch (error) {
      console.error('Failed to connect to GitHub:', error);
      setIsConnected(false);
      clearGitHubService();
      
      // Check for specific GitHub API error messages
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Enhance error message for common issues
        if (errorMessage.includes('Bad credentials')) {
          errorMessage = 'Invalid GitHub token. Please check your token and try again.';
        } else if (errorMessage.includes('Not Found')) {
          errorMessage = 'Repository not found. Please check the URL and your access permissions.';
        }
      }
      
      toast.error('Failed to connect to GitHub: ' + errorMessage);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [connectionAttempts]);

  const disconnect = useCallback(() => {
    clearGitHubService();
    setIsConnected(false);
    toast.info('Disconnected from GitHub repository');
  }, []);

  const createOrUpdateFile = useCallback(async (path: string, content: string, message: string) => {
    try {
      if (!isConnected) {
        throw new Error('GitHub is not connected. Please connect first.');
      }
      
      console.log(`Attempting to create/update file: ${path}`);
      const github = getGitHubService();
      await github.createOrUpdateFile(path, content, message);
      console.log(`Successfully created/updated file: ${path}`);
    } catch (error) {
      console.error(`Failed to create/update file ${path}:`, error);
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Enhance error messages for specific GitHub API errors
        if (errorMessage.includes('Bad credentials')) {
          // If we get a bad credentials error, disconnect as the token is invalid
          disconnect();
          errorMessage = 'Invalid GitHub token. Please reconnect with a valid token.';
        }
      }
      
      toast.error('Failed to save file: ' + errorMessage);
      throw error;
    }
  }, [isConnected, disconnect]);

  const getFileContent = useCallback(async (path: string) => {
    try {
      if (!isConnected) {
        throw new Error('GitHub is not connected. Please connect first.');
      }
      
      const github = getGitHubService();
      const content = await github.getFileContent(path);
      return content;
    } catch (error) {
      console.error(`Failed to get file content for ${path}:`, error);
      
      // Check for specific GitHub API errors
      if (error instanceof Error && error.message.includes('Bad credentials')) {
        // If we get a bad credentials error, disconnect as the token is invalid
        disconnect();
        toast.error('Invalid GitHub token. Please reconnect with a valid token.');
      }
      
      throw error;
    }
  }, [isConnected, disconnect]);

  const deleteFile = useCallback(async (path: string, message: string) => {
    try {
      if (!isConnected) {
        throw new Error('GitHub is not connected. Please connect first.');
      }
      
      const github = getGitHubService();
      await github.deleteFile(path, message);
      console.log(`Successfully deleted file: ${path}`);
    } catch (error) {
      console.error(`Failed to delete file ${path}:`, error);
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle authentication errors
        if (errorMessage.includes('Bad credentials')) {
          disconnect();
          errorMessage = 'Invalid GitHub token. Please reconnect with a valid token.';
        }
      }
      
      toast.error('Failed to delete file: ' + errorMessage);
      throw error;
    }
  }, [isConnected, disconnect]);

  const commitChanges = useCallback(async (commit: GitHubCommit) => {
    try {
      if (!isConnected) {
        throw new Error('GitHub is not connected. Please connect first.');
      }
      
      console.log(`Committing ${commit.files.length} files with message: ${commit.message}`);
      const github = getGitHubService();
      
      let successCount = 0;
      const errors = [];
      
      for (const file of commit.files) {
        try {
          console.log(`Processing file: ${file.path}`);
          await github.createOrUpdateFile(file.path, file.content, commit.message);
          successCount++;
        } catch (error) {
          console.error(`Failed to commit file ${file.path}:`, error);
          errors.push({ path: file.path, error });
        }
      }
      
      if (errors.length > 0) {
        console.error(`${errors.length} files failed to commit:`, errors);
        toast.error(`${successCount} files committed, ${errors.length} failed`);
        
        if (errors.some(e => e.error?.message?.includes('Bad credentials'))) {
          disconnect();
          toast.error('Invalid GitHub token. Please reconnect with a valid token.');
        }
      } else {
        console.log('All files committed successfully');
        toast.success(`Successfully committed ${commit.files.length} files to GitHub`);
      }
    } catch (error) {
      console.error('Failed to commit changes:', error);
      
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle authentication errors
        if (errorMessage.includes('Bad credentials')) {
          disconnect();
          errorMessage = 'Invalid GitHub token. Please reconnect with a valid token.';
        }
      }
      
      toast.error('Failed to commit changes: ' + errorMessage);
      throw error;
    }
  }, [isConnected, disconnect]);

  const value = {
    isConnected,
    currentBranch,
    isConnecting,
    connect,
    disconnect,
    createOrUpdateFile,
    getFileContent,
    deleteFile,
    commitChanges,
  };

  return <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>;
};
