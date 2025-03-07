/**
 * Client for interacting with the external CrewAI API
 */

// API configuration
const API_URL = 'https://could-you-clarify-if-this-chat-is-intended--fc133f12.crewai.com';
const BEARER_TOKEN = '8b45b95c0542';

// Define types for the API responses
export interface RequiredInput {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface TaskStatus {
  task_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  result?: Record<string, unknown>;
  error?: string;
}

/**
 * Base headers for API requests
 */
const headers = {
  'Authorization': `Bearer ${BEARER_TOKEN}`,
  'Content-Type': 'application/json'
};

/**
 * Error handling for API responses
 */
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }
  return response.json() as Promise<T>;
};

/**
 * Get required inputs for the CrewAI
 */
export const getRequiredInputs = async (): Promise<RequiredInput[]> => {
  const response = await fetch(`${API_URL}/inputs`, {
    method: 'GET',
    headers
  });
  return handleResponse<RequiredInput[]>(response);
};

/**
 * Start a new CrewAI task
 */
export const startCrew = async (inputs: Record<string, unknown>): Promise<{ task_id: string }> => {
  const response = await fetch(`${API_URL}/kickoff`, {
    method: 'POST',
    headers,
    body: JSON.stringify(inputs)
  });
  return handleResponse<{ task_id: string }>(response);
};

/**
 * Check the status of a running task
 */
export const checkTaskStatus = async (taskId: string): Promise<TaskStatus> => {
  const response = await fetch(`${API_URL}/status/${taskId}`, {
    method: 'GET',
    headers
  });
  return handleResponse<TaskStatus>(response);
};

/**
 * Poll a task until it completes
 */
export const pollTaskStatus = async (
  taskId: string, 
  intervalMs = 3000, 
  maxAttempts = 60
): Promise<TaskStatus> => {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const poll = async () => {
      try {
        const status = await checkTaskStatus(taskId);
        
        if (status.status === 'completed' || status.status === 'failed') {
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
};
