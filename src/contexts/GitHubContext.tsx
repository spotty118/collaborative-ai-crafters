
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { GitHubService } from '@/lib/github';
import { 
  getGitHubService, 
  initGitHubService, 
  clearGitHubService, 
  isGitHubServiceInitialized,
  getCurrentBranch,
  setCurrentBranch,
  getRepositoryInfo,
  reinitializeGitHubService
} from '@/lib/services/GitHubService';
import { GitHubConfig, GitHubFile, GitHubCommit } from '@/lib/types';
import { toast } from 'sonner';

interface GitHubContextType {
  isConnected: boolean;
  currentBranch: string;
  availableBranches: string[];
  connect: (url: string, token: string, branch?: string) => Promise<boolean>;
  disconnect: () => void;
  createOrUpdateFile: (path: string, content: string, message: string) => Promise<void>;
  getFileContent: (path: string) => Promise<string>;
  deleteFile: (path: string, message: string) => Promise<void>;
  commitChanges: (commit: GitHubCommit) => Promise<void>;
  setBranch: (branch: string) => void;
  refreshConnection: () => Promise<boolean>;
  listFiles: (path?: string) => Promise<{name: string, path: string, type: string}[]>;
  listBranches: () => Promise<string[]>;
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
  const [currentBranch, setCurrentBranchState] = useState('main');
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  // Check GitHub service initialization status on mount
  useEffect(() => {
    const checkInitialization = async () => {
      try {
        if (isGitHubServiceInitialized()) {
          setIsConnected(true);
          setCurrentBranchState(getCurrentBranch());
          console.log('GitHub service was already initialized');
          
          // Fetch available branches
          try {
            const github = getGitHubService();
            const branches = await github.listBranches();
            setAvailableBranches(branches);
            console.log('Available branches:', branches);
          } catch (error) {
            console.error('Failed to fetch branches:', error);
          }
        }
      } catch (error) {
        console.error('Error checking GitHub initialization:', error);
      } finally {
        setIsInitializing(false);
      }
    };
    
    checkInitialization();
  }, []);

  const connect = useCallback(async (url: string, token: string, branch?: string): Promise<boolean> => {
    try {
      setIsInitializing(true);
      
      if (!url || !token) {
        throw new Error('GitHub URL and token are required');
      }

      console.log(`Connecting to GitHub repo: ${url}`);
      const service = initGitHubService(url, token, branch);
      
      // Test the connection
      const connectionSuccessful = await service.testConnection();
      if (!connectionSuccessful) {
        throw new Error('Could not connect to GitHub repository. Please check your URL and token.');
      }
      
      // Fetch available branches
      const branches = await service.listBranches();
      setAvailableBranches(branches);
      
      // Set the branch state to the current branch
      const branchToUse = branch || 'main';
      setCurrentBranchState(branchToUse);
      
      setIsConnected(true);
      toast.success('Successfully connected to GitHub repository');
      
      return true;
    } catch (error) {
      console.error('Failed to connect to GitHub:', error);
      setIsConnected(false);
      clearGitHubService();
      toast.error('Failed to connect to GitHub: ' + (error instanceof Error ? error.message : 'Unknown error'));
      
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    clearGitHubService();
    setIsConnected(false);
    setCurrentBranchState('main');
    setAvailableBranches([]);
    toast.info('Disconnected from GitHub repository');
  }, []);

  const refreshConnection = useCallback(async (): Promise<boolean> => {
    try {
      setIsInitializing(true);
      
      if (!isGitHubServiceInitialized()) {
        console.log('GitHub service not initialized, cannot refresh');
        return false;
      }
      
      const info = getRepositoryInfo();
      console.log('Refreshing GitHub connection with:', info);
      
      const service = reinitializeGitHubService();
      if (!service) {
        console.error('Failed to reinitialize GitHub service');
        return false;
      }
      
      // Test the connection
      const connectionSuccessful = await service.testConnection();
      if (!connectionSuccessful) {
        throw new Error('Could not connect to GitHub repository during refresh');
      }
      
      // Refresh available branches
      const branches = await service.listBranches();
      setAvailableBranches(branches);
      
      setIsConnected(true);
      toast.success('Successfully refreshed GitHub connection');
      
      return true;
    } catch (error) {
      console.error('Failed to refresh GitHub connection:', error);
      setIsConnected(false);
      toast.error('Failed to refresh GitHub connection: ' + (error instanceof Error ? error.message : 'Unknown error'));
      
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const setBranch = useCallback((branch: string) => {
    try {
      setCurrentBranch(branch);
      setCurrentBranchState(branch);
      toast.success(`Switched to branch: ${branch}`);
    } catch (error) {
      toast.error('Failed to switch branch: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, []);

  const createOrUpdateFile = useCallback(async (path: string, content: string, message: string) => {
    try {
      console.log(`Attempting to create/update file: ${path} on branch: ${currentBranch}`);
      if (!isConnected) {
        throw new Error('GitHub is not connected');
      }
      
      // Double-check that the service is initialized
      if (!isGitHubServiceInitialized()) {
        throw new Error('GitHub service is not properly initialized');
      }
      
      const github = getGitHubService();
      await github.createOrUpdateFile(path, content, message, currentBranch);
      console.log(`Successfully created/updated file: ${path} on branch: ${currentBranch}`);
    } catch (error) {
      console.error(`Failed to create/update file ${path}:`, error);
      toast.error('Failed to save file: ' + (error instanceof Error ? error.message : 'Unknown error'));
      throw error;
    }
  }, [isConnected, currentBranch]);

  const getFileContent = useCallback(async (path: string) => {
    try {
      if (!isConnected) {
        throw new Error('GitHub is not connected');
      }
      
      const github = getGitHubService();
      const content = await github.getFileContent(path, currentBranch);
      return content;
    } catch (error) {
      console.error(`Failed to get file content for ${path}:`, error);
      throw error;
    }
  }, [isConnected, currentBranch]);

  const deleteFile = useCallback(async (path: string, message: string) => {
    try {
      if (!isConnected) {
        throw new Error('GitHub is not connected');
      }
      
      const github = getGitHubService();
      await github.deleteFile(path, message, currentBranch);
      console.log(`Successfully deleted file: ${path} from branch: ${currentBranch}`);
    } catch (error) {
      console.error(`Failed to delete file ${path}:`, error);
      toast.error('Failed to delete file: ' + (error instanceof Error ? error.message : 'Unknown error'));
      throw error;
    }
  }, [isConnected, currentBranch]);

  const commitChanges = useCallback(async (commit: GitHubCommit) => {
    try {
      if (!isConnected) {
        throw new Error('GitHub is not connected');
      }
      
      console.log(`Committing ${commit.files.length} files with message: ${commit.message} to branch: ${currentBranch}`);
      const github = getGitHubService();
      
      for (const file of commit.files) {
        console.log(`Processing file: ${file.path}`);
        await github.createOrUpdateFile(file.path, file.content, commit.message, currentBranch);
      }
      
      console.log('All files committed successfully');
      toast.success(`Successfully committed ${commit.files.length} files to GitHub`);
    } catch (error) {
      console.error('Failed to commit changes:', error);
      toast.error('Failed to commit changes: ' + (error instanceof Error ? error.message : 'Unknown error'));
      throw error;
    }
  }, [isConnected, currentBranch]);

  const listFiles = useCallback(async (path?: string) => {
    try {
      if (!isConnected) {
        throw new Error('GitHub is not connected');
      }
      
      // Double-check that the service is initialized
      if (!isGitHubServiceInitialized()) {
        throw new Error('GitHub service is not properly initialized');
      }
      
      const github = getGitHubService();
      return await github.listFiles(path, currentBranch);
    } catch (error) {
      console.error(`Failed to list files in ${path || 'root'}:`, error);
      toast.error('Failed to list files: ' + (error instanceof Error ? error.message : 'Unknown error'));
      throw error;
    }
  }, [isConnected, currentBranch]);

  const listBranches = useCallback(async () => {
    try {
      if (!isConnected) {
        throw new Error('GitHub is not connected');
      }
      
      // Double-check that the service is initialized
      if (!isGitHubServiceInitialized()) {
        throw new Error('GitHub service is not properly initialized');
      }
      
      const github = getGitHubService();
      const branches = await github.listBranches();
      setAvailableBranches(branches);
      return branches;
    } catch (error) {
      console.error('Failed to list branches:', error);
      toast.error('Failed to list branches: ' + (error instanceof Error ? error.message : 'Unknown error'));
      throw error;
    }
  }, [isConnected]);

  const value = {
    isConnected,
    currentBranch,
    availableBranches,
    connect,
    disconnect,
    createOrUpdateFile,
    getFileContent,
    deleteFile,
    commitChanges,
    setBranch,
    refreshConnection,
    listFiles,
    listBranches
  };

  if (isInitializing) {
    return (
      <GitHubContext.Provider value={value}>
        {children}
      </GitHubContext.Provider>
    );
  }

  return <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>;
};
