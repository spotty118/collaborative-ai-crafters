
import React, { createContext, useContext, useState, useCallback } from 'react';
import { GitHubService } from '@/lib/github';
import { getGitHubService, initGitHubService, clearGitHubService, isGitHubServiceInitialized } from '@/lib/services/GitHubService';
import { GitHubConfig, GitHubFile, GitHubCommit } from '@/lib/types';
import { toast } from 'sonner';

interface GitHubContextType {
  isConnected: boolean;
  currentBranch: string;
  connect: (url: string, token: string) => void;
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
  const [isConnected, setIsConnected] = useState(false);
  const [currentBranch, setCurrentBranch] = useState('main');

  // Initialize from localStorage if available
  React.useEffect(() => {
    // Check if we already have an initialized service
    if (isGitHubServiceInitialized()) {
      setIsConnected(true);
      console.log('GitHub service was already initialized');
    }
  }, []);

  const connect = useCallback((url: string, token: string) => {
    try {
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
      initGitHubService(url, token);
      setIsConnected(true);
      toast.success('Successfully connected to GitHub repository');
    } catch (error) {
      console.error('Failed to connect to GitHub:', error);
      setIsConnected(false);
      clearGitHubService();
      toast.error('Failed to connect to GitHub: ' + (error instanceof Error ? error.message : 'Unknown error'));
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearGitHubService();
    setIsConnected(false);
    toast.info('Disconnected from GitHub repository');
  }, []);

  const createOrUpdateFile = useCallback(async (path: string, content: string, message: string) => {
    try {
      console.log(`Attempting to create/update file: ${path}`);
      if (!isConnected) {
        throw new Error('GitHub is not connected');
      }
      
      const github = getGitHubService();
      await github.createOrUpdateFile(path, content, message);
      console.log(`Successfully created/updated file: ${path}`);
    } catch (error) {
      console.error(`Failed to create/update file ${path}:`, error);
      toast.error('Failed to save file: ' + (error instanceof Error ? error.message : 'Unknown error'));
      throw error;
    }
  }, [isConnected]);

  const getFileContent = useCallback(async (path: string) => {
    try {
      if (!isConnected) {
        throw new Error('GitHub is not connected');
      }
      
      const github = getGitHubService();
      const content = await github.getFileContent(path);
      return content;
    } catch (error) {
      console.error(`Failed to get file content for ${path}:`, error);
      throw error;
    }
  }, [isConnected]);

  const deleteFile = useCallback(async (path: string, message: string) => {
    try {
      if (!isConnected) {
        throw new Error('GitHub is not connected');
      }
      
      const github = getGitHubService();
      await github.deleteFile(path, message);
      console.log(`Successfully deleted file: ${path}`);
    } catch (error) {
      console.error(`Failed to delete file ${path}:`, error);
      toast.error('Failed to delete file: ' + (error instanceof Error ? error.message : 'Unknown error'));
      throw error;
    }
  }, [isConnected]);

  const commitChanges = useCallback(async (commit: GitHubCommit) => {
    try {
      if (!isConnected) {
        throw new Error('GitHub is not connected');
      }
      
      console.log(`Committing ${commit.files.length} files with message: ${commit.message}`);
      const github = getGitHubService();
      
      for (const file of commit.files) {
        console.log(`Processing file: ${file.path}`);
        await github.createOrUpdateFile(file.path, file.content, commit.message);
      }
      
      console.log('All files committed successfully');
      toast.success(`Successfully committed ${commit.files.length} files to GitHub`);
    } catch (error) {
      console.error('Failed to commit changes:', error);
      toast.error('Failed to commit changes: ' + (error instanceof Error ? error.message : 'Unknown error'));
      throw error;
    }
  }, [isConnected]);

  const value = {
    isConnected,
    currentBranch,
    connect,
    disconnect,
    createOrUpdateFile,
    getFileContent,
    deleteFile,
    commitChanges,
  };

  return <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>;
};
