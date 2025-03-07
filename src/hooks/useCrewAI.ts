
import { useState, useCallback } from 'react';
import { Project, Agent } from '@/lib/types';
import { toast } from 'sonner';
import { 
  initializeCrewAI, 
  updateCrewAIOrchestration,
  handleCrewTaskCompletion 
} from '@/lib/agent/orchestrator';

interface UseCrewAIOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useCrewAI(options?: UseCrewAIOptions) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const initializeCrew = useCallback(async (project: Project) => {
    if (!project.id) {
      toast.error('Cannot initialize CrewAI without a valid project');
      return false;
    }
    
    setIsInitializing(true);
    try {
      // Pass project.id instead of the whole project object
      const result = await initializeCrewAI(project.id);
      if (result) {
        toast.success('CrewAI orchestration initialized successfully');
        options?.onSuccess?.();
      } else {
        toast.error('Failed to initialize CrewAI orchestration');
      }
      return result;
    } catch (error) {
      console.error('Error initializing CrewAI:', error);
      toast.error('Error initializing CrewAI orchestration');
      options?.onError?.(error as Error);
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [options]);
  
  const updateCrew = useCallback(async (project: Project, updates: any) => {
    if (!project.id) {
      toast.error('Cannot update CrewAI without a valid project');
      return false;
    }
    
    setIsUpdating(true);
    try {
      // Pass project.id and updates as separate parameters
      const result = await updateCrewAIOrchestration(project.id, updates);
      if (result) {
        toast.success('CrewAI orchestration updated successfully');
        options?.onSuccess?.();
      } else {
        toast.error('Failed to update CrewAI orchestration');
      }
      return result;
    } catch (error) {
      console.error('Error updating CrewAI:', error);
      toast.error('Error updating CrewAI orchestration');
      options?.onError?.(error as Error);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [options]);
  
  const completeTask = useCallback(async (agent: Agent, taskId: string) => {
    if (!agent.id || !agent.project_id || !taskId) {
      toast.error('Missing required information to complete task');
      return false;
    }
    
    try {
      // Pass project_id and taskId to handleCrewTaskCompletion
      const result = await handleCrewTaskCompletion(agent.project_id, taskId);
      if (result) {
        toast.success(`Task completed by ${agent.name}`);
      } else {
        toast.error(`Failed to complete task by ${agent.name}`);
      }
      return result;
    } catch (error) {
      console.error('Error completing task with CrewAI:', error);
      toast.error('Error completing task');
      options?.onError?.(error as Error);
      return false;
    }
  }, [options]);
  
  return {
    initializeCrew,
    updateCrew,
    completeTask,
    isInitializing,
    isUpdating
  };
}
