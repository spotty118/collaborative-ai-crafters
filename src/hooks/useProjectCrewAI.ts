
import { useState, useCallback, useEffect } from 'react';
import { useCrewAIApi } from './useCrewAIApi';
import { Agent, AgentType, Project } from '@/lib/types';
import { toast } from 'sonner';

interface UseProjectCrewAIOptions {
  projectId?: string;
  onComplete?: (result: any) => void;
}

export function useProjectCrewAI({ projectId, onComplete }: UseProjectCrewAIOptions = {}) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  
  const {
    isLoading,
    taskId,
    taskStatus,
    taskResult,
    getRequiredInputs,
    startCrew,
    checkTaskStatus
  } = useCrewAIApi({
    onSuccess: (data) => {
      if (taskResult && onComplete) {
        onComplete(taskResult);
      }
    },
    onError: (error) => {
      console.error('CrewAI API error:', error);
      toast.error('Failed to execute CrewAI operation');
    }
  });

  // Initialize agents with CrewAI capabilities
  const initializeAgents = useCallback(async (project: Project) => {
    if (!projectId || isInitializing) return;
    
    setIsInitializing(true);
    try {
      // Generate default agents with CrewAI capabilities
      const defaultAgents: Agent[] = [
        {
          id: `architect-${projectId}`,
          type: 'architect',
          name: 'Architect Agent',
          status: 'idle',
          progress: 0,
          description: 'Designs system architecture and project structure',
          project_id: projectId,
          avatar: '👨‍💻'
        },
        {
          id: `frontend-${projectId}`,
          type: 'frontend',
          name: 'Frontend Agent',
          status: 'idle',
          progress: 0,
          description: 'Builds UI components and client-side functionality',
          project_id: projectId,
          avatar: '🎨'
        },
        {
          id: `backend-${projectId}`,
          type: 'backend',
          name: 'Backend Agent',
          status: 'idle',
          progress: 0,
          description: 'Develops APIs and database models',
          project_id: projectId,
          avatar: '🔧'
        },
        {
          id: `testing-${projectId}`,
          type: 'testing',
          name: 'Testing Agent',
          status: 'idle',
          progress: 0,
          description: 'Creates tests and ensures quality',
          project_id: projectId,
          avatar: '🧪'
        },
        {
          id: `devops-${projectId}`,
          type: 'devops',
          name: 'DevOps Agent',
          status: 'idle',
          progress: 0,
          description: 'Handles deployment and CI/CD setup',
          project_id: projectId,
          avatar: '🚀'
        }
      ];
      
      setAgents(defaultAgents);
      
      // Initialize with project requirements
      await startCrew({
        projectId,
        action: 'initialize',
        projectName: project.name,
        description: project.description,
        techStack: project.techStack
      });
      
      toast.success('CrewAI agents initialized successfully');
    } catch (error) {
      console.error('Error initializing CrewAI agents:', error);
      toast.error('Failed to initialize CrewAI agents');
    } finally {
      setIsInitializing(false);
    }
  }, [projectId, isInitializing, startCrew]);

  // Start a specific agent task
  const startAgentTask = useCallback(async (agentType: AgentType, task: string) => {
    if (!projectId) return;
    
    const agent = agents.find(a => a.type === agentType);
    if (!agent) {
      toast.error(`Agent not found: ${agentType}`);
      return;
    }
    
    try {
      // Update agent status
      setAgents(current => 
        current.map(a => 
          a.id === agent.id 
            ? { ...a, status: 'working', progress: 10 } 
            : a
        )
      );
      
      // Start the CrewAI task for this agent
      await startCrew({
        projectId,
        agentId: agent.id,
        action: 'start',
        task,
        agentType
      });
      
      // Poll for status updates
      const intervalId = setInterval(async () => {
        const status = await checkTaskStatus();
        
        // Update agent status based on task status
        if (status) {
          const progress = status.progress || 
            (status.status === 'in_progress' ? 50 : 
             status.status === 'completed' ? 100 : 0);
          
          setAgents(current => 
            current.map(a => 
              a.id === agent.id 
                ? { 
                    ...a, 
                    status: status.status === 'completed' ? 'completed' : 
                            status.status === 'failed' ? 'failed' : 'working',
                    progress 
                  } 
                : a
            )
          );
          
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(intervalId);
          }
        }
      }, 5000);
      
      return () => clearInterval(intervalId);
    } catch (error) {
      console.error(`Error starting ${agentType} agent:`, error);
      toast.error(`Failed to start ${agentType} agent`);
      
      // Set agent to failed state
      setAgents(current => 
        current.map(a => 
          a.id === agent.id 
            ? { ...a, status: 'failed', progress: 0 } 
            : a
        )
      );
    }
  }, [projectId, agents, startCrew, checkTaskStatus]);

  // Start a team collaboration between multiple agents
  const startTeamCollaboration = useCallback(async (teamAgents: Agent[], task: string) => {
    if (!projectId || teamAgents.length === 0) return;
    
    try {
      // Update all involved agents to working status
      setAgents(current => 
        current.map(a => 
          teamAgents.some(ta => ta.id === a.id)
            ? { ...a, status: 'working', progress: 10 } 
            : a
        )
      );
      
      // Start the CrewAI team task
      await startCrew({
        projectId,
        action: 'team_collaborate',
        agents: teamAgents,
        task,
        verbose: true
      });
      
      // Poll for status updates
      const intervalId = setInterval(async () => {
        const status = await checkTaskStatus();
        
        if (status) {
          const progress = status.progress || 
            (status.status === 'in_progress' ? 50 : 
             status.status === 'completed' ? 100 : 0);
          
          // Update all team agents
          setAgents(current => 
            current.map(a => 
              teamAgents.some(ta => ta.id === a.id)
                ? { 
                    ...a, 
                    status: status.status === 'completed' ? 'completed' : 
                            status.status === 'failed' ? 'failed' : 'working',
                    progress 
                  } 
                : a
            )
          );
          
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(intervalId);
          }
        }
      }, 5000);
      
      return () => clearInterval(intervalId);
    } catch (error) {
      console.error('Error starting team collaboration:', error);
      toast.error('Failed to start team collaboration');
      
      // Set all team agents to failed state
      setAgents(current => 
        current.map(a => 
          teamAgents.some(ta => ta.id === a.id)
            ? { ...a, status: 'failed', progress: 0 } 
            : a
        )
      );
    }
  }, [projectId, startCrew, checkTaskStatus]);

  return {
    agents,
    isLoading: isLoading || isInitializing,
    taskStatus,
    taskResult,
    initializeAgents,
    startAgentTask,
    startTeamCollaboration
  };
}
