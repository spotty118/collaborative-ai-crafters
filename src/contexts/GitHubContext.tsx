
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GitHubConfig } from '@/lib/types';
import { connectGitHub, testGitHubConnection } from '@/lib/github';
import { toast } from 'sonner';

interface GitHubContextType {
  githubConfig: GitHubConfig | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectError: string | null;
  connect: (token: string, owner: string, repo: string) => Promise<boolean>;
  disconnect: () => void;
  testConnection: () => Promise<boolean>;
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

export const GitHubProvider = ({ children }: { children: ReactNode }) => {
  const [githubConfig, setGithubConfig] = useState<GitHubConfig | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Load GitHub configuration from local storage on component mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('githubConfig');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setGithubConfig(config);
        // Test connection with saved token
        testGitHubConnection(config)
          .then((result) => {
            setIsConnected(result);
          })
          .catch(() => {
            setIsConnected(false);
          });
      } catch (error) {
        console.error('Error parsing saved GitHub config:', error);
        localStorage.removeItem('githubConfig');
      }
    }
  }, []);

  // Connect to GitHub
  const connect = async (token: string, owner: string, repo: string): Promise<boolean> => {
    setIsConnecting(true);
    setConnectError(null);
    
    try {
      const config: GitHubConfig = { token, owner, repo };
      const result = await connectGitHub(config);
      
      if (result) {
        setGithubConfig(config);
        setIsConnected(true);
        // Save to local storage
        localStorage.setItem('githubConfig', JSON.stringify(config));
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
    setIsConnected(false);
    localStorage.removeItem('githubConfig');
    toast.info('Disconnected from GitHub');
  };

  // Test GitHub connection
  const testConnection = async (): Promise<boolean> => {
    if (!githubConfig) return false;

    try {
      const result = await testGitHubConnection(githubConfig);
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

  return (
    <GitHubContext.Provider
      value={{
        githubConfig,
        isConnected,
        isConnecting,
        connectError,
        connect,
        disconnect,
        testConnection
      }}
    >
      {children}
    </GitHubContext.Provider>
  );
};

export default GitHubContext;
