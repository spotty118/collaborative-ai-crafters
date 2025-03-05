import React, { createContext, useContext, useState, useCallback } from 'react';
import { GitHubService, createGitHubService } from '@/lib/github';
import { GitHubConfig, GitHubFile, GitHubCommit } from '@/lib/types';

interface GitHubContextType {
  isConnected: boolean;
  service: GitHubService | null;
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
  const [service, setService] = useState<GitHubService | null>(null);

  const connect = useCallback((url: string, token: string) => {
    try {
      const githubService = createGitHubService(url, token);
      setService(githubService);
    } catch (error) {
      console.error('Failed to connect to GitHub:', error);
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    setService(null);
  }, []);

  const createOrUpdateFile = useCallback(
    async (path: string, content: string, message: string) => {
      if (!service) throw new Error('GitHub service not connected');
      await service.createOrUpdateFile(path, content, message);
    },
    [service]
  );

  const getFileContent = useCallback(
    async (path: string) => {
      if (!service) throw new Error('GitHub service not connected');
      return service.getFileContent(path);
    },
    [service]
  );

  const deleteFile = useCallback(
    async (path: string, message: string) => {
      if (!service) throw new Error('GitHub service not connected');
      await service.deleteFile(path, message);
    },
    [service]
  );

  const commitChanges = useCallback(
    async (commit: GitHubCommit) => {
      if (!service) throw new Error('GitHub service not connected');
      
      // Process all files in the commit
      await Promise.all(
        commit.files.map(file => 
          service.createOrUpdateFile(file.path, file.content, commit.message)
        )
      );
    },
    [service]
  );

  const value = {
    isConnected: !!service,
    service,
    connect,
    disconnect,
    createOrUpdateFile,
    getFileContent,
    deleteFile,
    commitChanges,
  };

  return <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>;
};