import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { mockRequiredInputs, getMockTaskStatus } from '../lib/mockCrewAIData';

// API configuration from environment
const API_URL = 'https://could-you-clarify-if-this-chat-is-intended--fc133f12.crewai.com';
const BEARER_TOKEN = '8b45b95c0542';

// Flag to enable mock mode when the API is not available
const USE_MOCK = true; // Set to false to try connecting to the real API

// Define types for the API responses
interface RequiredInput {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface TaskStatus {
  task_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  result?: Record<string, unknown>;
  error?: string;
}

interface TaskResult {
  [key: string]: unknown;
}

interface UseCrewAIApiOptions {
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for interacting with the external CrewAI API
 */
export function useCrewAIApi(options?: UseCrewAIApiOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [requiredInputs, setRequiredInputs] = useState<RequiredInput[] | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [taskResult, setTaskResult] = useState<TaskResult | null>(null);
  
  /**
   * Get required inputs for the CrewAI task
   */
  const getRequiredInputs = useCallback(async () => {
    setIsLoading(true);
    
    // Use mock data if USE_MOCK is true
    if (USE_MOCK) {
      setTimeout(() => {
        setRequiredInputs(mockRequiredInputs);
        options?.onSuccess?.(mockRequiredInputs);
        setIsLoading(false);
      }, 800); // Simulate network delay
      return mockRequiredInputs;
    }
    
    try {
      const response = await fetch(`${API_URL}/inputs`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${BEARER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json() as RequiredInput[];
      setRequiredInputs(data);
      options?.onSuccess?.(data);
      return data;
    } catch (error) {
      console.error('Error fetching required inputs:', error);
      
      // Fallback to mock data if the API call fails
      setTimeout(() => {
        toast.info('Using mock data due to API connection issues');
        setRequiredInputs(mockRequiredInputs);
        options?.onSuccess?.(mockRequiredInputs);
      }, 500);
      
      options?.onError?.(error as Error);
      return mockRequiredInputs;
    } finally {
      setIsLoading(false);
    }
  }, [options]);
  
  /**
   * Start the CrewAI task with the provided inputs
   */
  const startCrew = useCallback(async (inputs: Record<string, unknown>) => {
    setIsLoading(true);
    
    // Use mock data if USE_MOCK is true
    if (USE_MOCK) {
      // Generate a random task ID for the mock task
      const mockTaskId = `task-${Date.now().toString(36)}`;
      
      setTimeout(() => {
        setTaskId(mockTaskId);
        toast.success('CrewAI task started successfully');
        options?.onSuccess?.({ task_id: mockTaskId });
        setIsLoading(false);
        
        // Start the mock task progression
        simulateTaskProgress(mockTaskId);
      }, 1200); // Simulate network delay
      
      return { task_id: mockTaskId };
    }
    
    try {
      const response = await fetch(`${API_URL}/kickoff`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BEARER_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(inputs)
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json() as { task_id: string };
      setTaskId(data.task_id);
      toast.success('CrewAI task started successfully');
      options?.onSuccess?.(data);
      return data;
    } catch (error) {
      console.error('Error starting CrewAI task:', error);
      
      // Fallback to mock if API fails
      const mockTaskId = `task-${Date.now().toString(36)}`;
      setTimeout(() => {
        toast.info('Using mock data due to API connection issues');
        setTaskId(mockTaskId);
        options?.onSuccess?.({ task_id: mockTaskId });
        
        // Start the mock task progression
        simulateTaskProgress(mockTaskId);
      }, 500);
      
      options?.onError?.(error as Error);
      return { task_id: mockTaskId };
    } finally {
      setIsLoading(false);
    }
  }, [options]);
  
  // Helper function to simulate task progress over time
  const simulateTaskProgress = useCallback((mockTaskId: string) => {
    // First set to pending
    setTimeout(() => {
      const pendingStatus = getMockTaskStatus(mockTaskId, 'pending');
      setTaskStatus(pendingStatus);
    }, 2000);
    
    // Then to in_progress
    setTimeout(() => {
      const inProgressStatus = getMockTaskStatus(mockTaskId, 'in_progress');
      setTaskStatus(inProgressStatus);
    }, 8000);
    
    // Finally to completed
    setTimeout(() => {
      const completedStatus = getMockTaskStatus(mockTaskId, 'completed');
      setTaskStatus(completedStatus);
      if (completedStatus.result) {
        setTaskResult(completedStatus.result);
      }
    }, 15000);
  }, []);
  
  /**
   * Check the status of a running task
   */
  const checkTaskStatus = useCallback(async (id?: string) => {
    const taskIdToCheck = id || taskId;
    if (!taskIdToCheck) {
      toast.error('No task ID available');
      return null;
    }
    
    // If we're in mock mode, the task status is controlled by the simulateTaskProgress function
    // Just return the current status to avoid unnecessary API calls
    if (USE_MOCK) {
      // Only set loading briefly to show activity
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 300);
      
      return taskStatus || getMockTaskStatus(taskIdToCheck, 'pending');
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/status/${taskIdToCheck}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${BEARER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json() as TaskStatus;
      setTaskStatus(data);
      
      // If the task is complete, set the result
      if (data.status === 'completed' && data.result) {
        setTaskResult(data.result as TaskResult);
      }
      
      options?.onSuccess?.(data);
      return data;
    } catch (error) {
      console.error('Error checking task status:', error);
      
      // In case of API error, if we already have a task status, just return that
      if (taskStatus) {
        return taskStatus;
      }
      
      // Otherwise, fallback to mock status
      const mockStatus = getMockTaskStatus(taskIdToCheck, 'pending');
      setTaskStatus(mockStatus);
      
      options?.onError?.(error as Error);
      return mockStatus;
    } finally {
      setIsLoading(false);
    }
  }, [taskId, taskStatus, options]);
  
  /**
   * Poll the task status at a specified interval until completion
   */
  const pollTaskStatus = useCallback(async (id: string, intervalMs = 3000, maxAttempts = 60) => {
    return new Promise<TaskStatus | null>((resolve, reject) => {
      let attempts = 0;
      
      const poll = async () => {
        try {
          const status = await checkTaskStatus(id);
          
          if (status?.status === 'completed' || status?.status === 'failed') {
            resolve(status);
            return;
          }
          
          attempts++;
          if (attempts >= maxAttempts) {
            reject(new Error('Max polling attempts reached'));
            return;
          }
          
          setTimeout(poll, intervalMs);
        } catch (error) {
          reject(error);
        }
      };
      
      poll();
    });
  }, [checkTaskStatus]);
  
  return {
    isLoading,
    taskId,
    requiredInputs,
    taskStatus,
    taskResult,
    getRequiredInputs,
    startCrew,
    checkTaskStatus,
    pollTaskStatus
  };
}
