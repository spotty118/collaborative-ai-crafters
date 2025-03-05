import React, { createContext, useContext, useState, useCallback } from 'react';
import { GitHubService } from '@/lib/github';
import { getGitHubService, initGitHubService, clearGitHubService } from '@/lib/services/GitHubService';
import { GitHubConfig, GitHubFile, GitHubCommit } from '@/lib/types';
import { toast } from 'sonner';

interface GitHubContextType {
  isConnected: boolean;
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

  const connect = useCallback((url: string, token: string) => {
    try {
      // Extract owner and repo from GitHub URL
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) {
        throw new Error('Invalid GitHub repository URL');
      }

      const [, owner, repo] = match;
      if (!owner || !repo) {
        throw new Error('Could not extract owner and repository from URL');
      }

      initGitHubService(url, token);
      setIsConnected(true);
      toast.success('Successfully connected to GitHub repository');
    } catch (error) {
      console.error('Failed to connect to GitHub:', error);
      setIsConnected(false);
      clearGitHubService();
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearGitHubService();
    setIsConnected(false);
    toast.info('Disconnected from GitHub repository');
  }, []);

  const createOrUpdateFile = useCallback(async (path: string, content: string, message: string) => {
    const github = getGitHubService();
    await github.createOrUpdateFile(path, content, message);
  }, []);

  const getFileContent = useCallback(async (path: string) => {
    const github = getGitHubService();
    return github.getFileContent(path);
  }, []);

  const deleteFile = useCallback(async (path: string, message: string) => {
    const github = getGitHubService();
    await github.deleteFile(path, message);
  }, []);

  const commitChanges = useCallback(async (commit: GitHubCommit) => {
    const github = getGitHubService();
    for (const file of commit.files) {
      await github.createOrUpdateFile(file.path, file.content, commit.message);
    }
  }, []);

  const value = {
    isConnected,
    connect,
    disconnect,
    createOrUpdateFile,
    getFileContent,
    deleteFile,
    commitChanges,
  };

  return <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>;
};