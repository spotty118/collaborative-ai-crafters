import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GitHubConfig } from '@/lib/types';
import { GitHubService } from '@/lib/github';
import { toast } from 'sonner';

interface GitHubContextType {
  githubConfig: GitHubConfig | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectError: string | null;
  connect: (url: string, token: string, branch?: string) => Promise<boolean>;
  disconnect: () => void;
  testConnection: () => Promise<boolean>;
  createOrUpdateFile: (path: string, content: string, message: string) => Promise<boolean>;
  getFileContent: (path: string, ref?: string) => Promise<string>;
  deleteFile: (path: string, message: string) => Promise<void>;
  listFiles: (path?: string) => Promise<{name: string, path: string, type: string}[]>;
  currentBranch: string;
}

const GitHubContext = createContext<GitHubContextType | null>(null);

// Export the useGitHubContext hook
export const useGitHubContext = () => {
  const context = useContext(GitHubContext);
  if (!context) {
    throw new Error('useGitHubContext must be used within a GitHubProvider');
  }
  return context;
};

// Also export with an alias for backward compatibility
export const useGitHub = useGitHubContext;

export const GitHubProvider = ({ children }: { children: ReactNode }) => {
  const [githubConfig, setGithubConfig] = useState<GitHubConfig | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [service, setService] = useState<GitHubService | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string>('main');

  // Load GitHub configuration from local storage on component mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('githubConfig');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setGithubConfig(config);
        // Try to initialize service with saved config
        try {
          const newService = new GitHubService(config);
          setService(newService);
          // Test connection with saved token
          newService.testConnection()
            .then((result) => {
              setIsConnected(result);
            })
            .catch(() => {
              setIsConnected(false);
            });
        } catch (error) {
          console.error('Error initializing GitHub service:', error);
          setIsConnected(false);
        }
      } catch (error) {
        console.error('Error parsing saved GitHub config:', error);
        localStorage.removeItem('githubConfig');
      }
    }
  }, []);

  // Connect to GitHub
  const connect = async (url: string, token: string, branch: string = 'main'): Promise<boolean> => {
    setIsConnecting(true);
    setConnectError(null);
    
    try {
      // Parse GitHub URL to get owner and repo
      const { owner, repo } = GitHubService.parseGitHubUrl(url);
      const config: GitHubConfig = { token, owner, repo };
      
      // Create service
      const newService = new GitHubService(config);
      const result = await newService.testConnection();
      
      if (result) {
        setService(newService);
        setGithubConfig(config);
        setIsConnected(true);
        setCurrentBranch(branch);
        // Save to local storage
        localStorage.setItem('githubConfig', JSON.stringify(config));
        localStorage.setItem('githubBranch', branch);
        toast.success('Connected to GitHub successfully');
        return true;
      } else {
        setConnectError('Failed to connect to GitHub. Check your credentials.');
        toast.error('Failed to connect to GitHub');
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setConnectError(errorMessage);
      toast.error(`GitHub connection error: ${errorMessage}`);
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from GitHub
  const disconnect = () => {
    setGithubConfig(null);
    setService(null);
    setIsConnected(false);
    localStorage.removeItem('githubConfig');
    toast.info('Disconnected from GitHub');
  };

  // Test GitHub connection
  const testConnection = async (): Promise<boolean> => {
    if (!service) return false;

    try {
      const result = await service.testConnection();
      setIsConnected(result);
      if (result) {
        toast.success('GitHub connection is working');
      } else {
        toast.error('GitHub connection failed');
      }
      return result;
    } catch (error) {
      setIsConnected(false);
      toast.error('GitHub connection test failed');
      return false;
    }
  };

  // Create or update a file
  const createOrUpdateFile = async (path: string, content: string, message: string): Promise<boolean> => {
    if (!service) {
      toast.error('GitHub service not initialized');
      return false;
    }

    try {
      return await service.createOrUpdateFile(path, content, message);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to save file: ${errorMessage}`);
      throw error;
    }
  };

  // Get file content
  const getFileContent = async (path: string, ref = 'main'): Promise<string> => {
    if (!service) {
      toast.error('GitHub service not initialized');
      throw new Error('GitHub service not initialized');
    }

    try {
      return await service.getFileContent(path, ref);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to get file content: ${errorMessage}`);
      throw error;
    }
  };

  // Delete a file
  const deleteFile = async (path: string, message: string): Promise<void> => {
    if (!service) {
      toast.error('GitHub service not initialized');
      throw new Error('GitHub service not initialized');
    }

    try {
      await service.deleteFile(path, message);
      toast.success('File deleted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to delete file: ${errorMessage}`);
      throw error;
    }
  };

  // List files
  const listFiles = async (path = ''): Promise<{name: string, path: string, type: string}[]> => {
    if (!service) {
      toast.error('GitHub service not initialized');
      return [];
    }

    try {
      return await service.listFiles(path);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to list files: ${errorMessage}`);
      throw error;
    }
  };

  // Effect to load saved branch from localStorage
  useEffect(() => {
    const savedBranch = localStorage.getItem('githubBranch');
    if (savedBranch) {
      setCurrentBranch(savedBranch);
    }
  }, []);

  return (
    <GitHubContext.Provider
      value={{
        githubConfig,
        isConnected,
        isConnecting,
        connectError,
        connect,
        disconnect,
        testConnection,
        createOrUpdateFile,
        getFileContent,
        deleteFile,
        listFiles,
        currentBranch
      }}
    >
      {children}
    </GitHubContext.Provider>
  );
};

export default GitHubContext;
