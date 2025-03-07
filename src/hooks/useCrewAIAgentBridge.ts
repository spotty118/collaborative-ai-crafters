import { useState, useCallback, useEffect } from 'react';
import { useCrewAIApi } from './useCrewAIApi';
import { Agent, Project, Task } from '@/lib/types';
import { toast } from 'sonner';
import { createAgents, updateAgent, createMessage } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Bridge between the existing agent system and the external CrewAI API
 */
export function useCrewAIAgentBridge(projectId: string, project?: Project | null) {
  const [initialized, setInitialized] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  
  // Initialize CrewAI API hook
  const {
    isLoading,
    taskId,
    taskStatus,
    taskResult,
    requiredInputs,
    startCrew,
    checkTaskStatus,
  } = useCrewAIApi({
    onSuccess: (data) => {
      console.log('CrewAI operation successful:', data);
    },
    onError: (error) => {
      console.error('CrewAI operation failed:', error);
      toast.error(`CrewAI operation failed: ${error.message}`);
    },
  });

  /**
   * Initialize CrewAI for this project
   */
  const initializeCrewAI = useCallback(async () => {
    try {
      console.log(`Initializing CrewAI for project ${projectId}`);
      // Create required agents if needed
      await createAgents(projectId);
      
      // Mark as initialized
      setInitialized(true);
      
      return true;
    } catch (error) {
      console.error('Error initializing CrewAI:', error);
      toast.error(`Failed to initialize CrewAI: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }, [projectId]);

  /**
   * Start a CrewAI agent
   */
  const startAgent = useCallback(async (agentId: string) => {
    if (!project) {
      toast.error('Project information is required');
      return null;
    }
    
    try {
      // Update agent status to working
      await updateAgent(agentId, { status: 'working', progress: 5 });
      
      // Set this as the active agent
      setActiveAgent(agentId);
      
      // Prepare project data for CrewAI
      const projectData = {
        id: projectId,
        name: project.name,
        description: project.description || '',
        type: project.sourceType || 'new',
        repository: project.sourceUrl || '',
      };
      
      // Start the CrewAI task with the relevant inputs
      const result = await startCrew({
        project_data: projectData,
        agent_id: agentId,
        agent_type: 'architect', // Default to architect if not specified
      });
      
      // Create a message to show the agent has started
      await createMessage({
        project_id: projectId,
        content: 'I am now analyzing the project requirements and preparing to work with CrewAI...',
        sender: 'CrewAI Agent',
        type: 'text',
      });
      
      // Refresh agents list to show updated status
      queryClient.invalidateQueries({ queryKey: ['agents', projectId] });
      
      toast.success('CrewAI agent started successfully');
      return result;
    } catch (error) {
      console.error('Error starting CrewAI agent:', error);
      
      // Reset agent status on error
      await updateAgent(agentId, { status: 'idle', progress: 0 });
      
      toast.error(`Failed to start CrewAI agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }, [project, projectId, startCrew, queryClient]);

  /**
   * Stop a CrewAI agent
   */
  const stopAgent = useCallback(async (agentId: string) => {
    try {
      // Update agent status to idle
      await updateAgent(agentId, { status: 'idle', progress: 0 });
      
      // Reset active agent if this is the active one
      if (activeAgent === agentId) {
        setActiveAgent(null);
      }
      
      // Create a message to show the agent has stopped
      await createMessage({
        project_id: projectId,
        content: 'I have stopped my CrewAI processes as requested.',
        sender: 'CrewAI Agent',
        type: 'text',
      });
      
      // Refresh agents list to show updated status
      queryClient.invalidateQueries({ queryKey: ['agents', projectId] });
      
      toast.success('CrewAI agent stopped successfully');
      return true;
    } catch (error) {
      console.error('Error stopping CrewAI agent:', error);
      toast.error(`Failed to stop CrewAI agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }, [activeAgent, projectId, queryClient]);

  /**
   * Execute a specific task with CrewAI
   */
  const executeTask = useCallback(async (taskId: string, agentId: string, task: Task) => {
    if (!project) {
      toast.error('Project information is required');
      return null;
    }
    
    try {
      // Update agent status to working
      await updateAgent(agentId, { status: 'working', progress: 10 });
      
      // Set this as the active agent
      setActiveAgent(agentId);
      
      // Prepare task data for CrewAI
      const taskData = {
        id: taskId,
        title: task.title,
        description: task.description,
        priority: task.priority,
      };
      
      // Prepare project data for CrewAI
      const projectData = {
        id: projectId,
        name: project.name,
        description: project.description || '',
        type: project.sourceType || 'new',
        repository: project.sourceUrl || '',
      };
      
      // Start the CrewAI task with the relevant inputs
      const result = await startCrew({
        project_data: projectData,
        agent_id: agentId,
        task_data: taskData,
      });
      
      // Create a message to show the task execution has started
      await createMessage({
        project_id: projectId,
        content: `I am now working on task: "${task.title}"`,
        sender: 'CrewAI Agent',
        type: 'text',
      });
      
      // Refresh agents and tasks lists
      queryClient.invalidateQueries({ queryKey: ['agents', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      
      toast.success(`CrewAI task execution started: ${task.title}`);
      return result;
    } catch (error) {
      console.error('Error executing task with CrewAI:', error);
      
      // Reset agent status on error
      await updateAgent(agentId, { status: 'idle', progress: 0 });
      
      toast.error(`Failed to execute CrewAI task: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }, [project, projectId, startCrew, queryClient]);

  /**
   * Send a message to the CrewAI agent
   */
  const sendMessageToAgent = useCallback(async (message: string, agent: Agent) => {
    try {
      // Create a user message
      await createMessage({
        project_id: projectId,
        content: message,
        sender: 'You',
        type: 'text',
      });
      
      // Start a new CrewAI task with the message context
      const result = await startCrew({
        project_id: projectId,
        agent_id: agent.id,
        message: message,
        mode: 'chat',
      });
      
      // We'll poll for the result and then show the reply
      if (!result?.task_id) {
        throw new Error('Failed to get a valid task ID from CrewAI');
      }
      
      const taskStatusCheck = setInterval(async () => {
        const status = await checkTaskStatus(result.task_id as string);
        
        if (status?.status === 'completed' && status.result) {
          // Get the response from the result and post it as a message
          const responseText = 
            typeof status.result.response === 'string' 
              ? status.result.response 
              : 'I processed your request but have no specific response.';
          
          await createMessage({
            project_id: projectId,
            content: responseText,
            sender: agent.name,
            type: 'text',
          });
          
          // Clear the interval
          clearInterval(taskStatusCheck);
        } else if (status?.status === 'failed') {
          // Post an error message
          await createMessage({
            project_id: projectId,
            content: `Sorry, I encountered an error: ${status.error || 'Unknown error'}`,
            sender: agent.name,
            type: 'text',
          });
          
          // Clear the interval
          clearInterval(taskStatusCheck);
        }
      }, 2000);
      
      // Return the CrewAI task result for reference
      return result;
    } catch (error) {
      console.error('Error sending message to CrewAI agent:', error);
      
      // Post an error message
      await createMessage({
        project_id: projectId,
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: 'CrewAI Agent',
        type: 'text',
      });
      
      toast.error(`Failed to send message to CrewAI agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }, [projectId, startCrew, checkTaskStatus]);

  // Poll for status updates when there's an active task
  useEffect(() => {
    if (taskId) {
      const statusInterval = setInterval(async () => {
        await checkTaskStatus();
        
        // If we have a completed result, update the project
        if (taskStatus?.status === 'completed' && taskResult) {
          console.log('CrewAI task completed:', taskResult);
          
          // Process any code files or tasks that were created
          if (taskResult.files) {
            // Handle created files (this would be handled by the actual CrewAI integration)
            console.log('CrewAI created files:', taskResult.files);
          }
          
          if (taskResult.tasks) {
            // Handle created tasks
            console.log('CrewAI created tasks:', taskResult.tasks);
          }
          
          // Update the agent's progress
          if (activeAgent) {
            await updateAgent(activeAgent, { progress: 100 });
            
            // Post a completion message
            await createMessage({
              project_id: projectId,
              content: 'I have completed my assigned tasks. You can review the results and assign new tasks as needed.',
              sender: 'CrewAI Agent',
              type: 'text',
            });
            
            setActiveAgent(null);
          }
          
          // Refresh relevant data
          queryClient.invalidateQueries({ queryKey: ['agents', projectId] });
          queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
          queryClient.invalidateQueries({ queryKey: ['files', projectId] });
          
          clearInterval(statusInterval);
        }
        
        // If the task failed, update the agent status
        if (taskStatus?.status === 'failed') {
          console.error('CrewAI task failed:', taskStatus.error);
          
          if (activeAgent) {
            await updateAgent(activeAgent, { status: 'failed', progress: 0 });
            
            // Post an error message
            await createMessage({
              project_id: projectId,
              content: `I encountered an error: ${taskStatus.error || 'Unknown error'}`,
              sender: 'CrewAI Agent',
              type: 'text',
            });
            
            setActiveAgent(null);
          }
          
          queryClient.invalidateQueries({ queryKey: ['agents', projectId] });
          
          clearInterval(statusInterval);
        }
      }, 5000);
      
      return () => clearInterval(statusInterval);
    }
  }, [taskId, taskStatus, taskResult, activeAgent, projectId, checkTaskStatus, queryClient]);

  return {
    isLoading,
    initialized,
    initializeCrewAI,
    startAgent,
    stopAgent,
    executeTask,
    sendMessageToAgent,
    taskId,
    taskStatus,
    taskResult,
  };
}
