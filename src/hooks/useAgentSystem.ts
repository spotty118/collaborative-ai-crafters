
import { useState, useCallback } from 'react';
import { startAgentOrchestration, stopAgentOrchestration, updateAgentProgress, completeTask } from '@/lib/agent/orchestrator';
import { toast } from 'sonner';

/**
 * Hook for interacting with the agent system
 */
export const useAgentSystem = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastOperation, setLastOperation] = useState<string | null>(null);

  /**
   * Start an agent
   */
  const startAgent = useCallback(async (projectId: string, agentId: string, taskId?: string) => {
    setIsLoading(true);
    setLastOperation('start');
    
    try {
      const result = await startAgentOrchestration(projectId, agentId, taskId);
      
      if (result.success) {
        toast.success('Agent started successfully');
      } else {
        toast.error(`Failed to start agent: ${result.message}`);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error starting agent: ${errorMessage}`);
      
      return {
        success: false,
        message: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Stop an agent
   */
  const stopAgent = useCallback(async (projectId: string, agentId: string) => {
    setIsLoading(true);
    setLastOperation('stop');
    
    try {
      const result = await stopAgentOrchestration(projectId, agentId);
      
      if (result.success) {
        toast.success('Agent stopped successfully');
      } else {
        toast.error(`Failed to stop agent: ${result.message}`);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error stopping agent: ${errorMessage}`);
      
      return {
        success: false,
        message: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update agent progress
   */
  const updateProgress = useCallback(async (
    projectId: string,
    agentId: string,
    progress: number,
    status: string = 'working'
  ) => {
    setLastOperation('update');
    
    try {
      return await updateAgentProgress(projectId, agentId, progress, status);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error updating agent progress: ${errorMessage}`);
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }, []);

  /**
   * Complete a task
   */
  const finishTask = useCallback(async (projectId: string, agentId: string, taskId: string) => {
    setIsLoading(true);
    setLastOperation('complete');
    
    try {
      const result = await completeTask(projectId, agentId, taskId);
      
      if (result.success) {
        toast.success('Task completed successfully');
      } else {
        toast.error(`Failed to complete task: ${result.message}`);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error completing task: ${errorMessage}`);
      
      return {
        success: false,
        message: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    startAgent,
    stopAgent,
    updateProgress,
    finishTask,
    isLoading,
    lastOperation
  };
};
