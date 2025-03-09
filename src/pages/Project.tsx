import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Dashboard from '@/components/layout/Dashboard';
import DashboardUI from '@/components/dashboard/DashboardUI';
import { useToast } from '@/hooks/use-toast';
import { getOpenRouterApiKey } from '@/lib/env';
import { sendAgentPrompt } from '@/lib/openrouter';
import { getGitHubService, isGitHubServiceInitialized } from '@/lib/services/GitHubService';
import { Agent, Message, Task, ProjectMode } from '@/lib/types';
import { useOpenRouterModels } from '@/hooks/useOpenRouterModels';

const ProjectPage: React.FC = () => {
  const { toast } = useToast();
  const { projectId } = useParams<{ projectId: string }>();
  
  // State for the Dashboard component
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [useLegacyDashboard, setUseLegacyDashboard] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState({
    agents: false,
    tasks: false,
    messages: false
  });

  // Get OpenRouter models
  const { models, isLoading: isLoadingModels } = useOpenRouterModels();

  // Load initial data
  useEffect(() => {
    if (!projectId) return;
    
    // Sample agent data for testing
    setAgents([
      {
        id: 'architect',
        name: 'Architect',
        type: 'architect',
        status: 'idle',
        progress: 0,
        description: 'Designs the system architecture and components'
      },
      {
        id: 'frontend',
        name: 'Frontend Developer',
        type: 'frontend',
        status: 'idle',
        progress: 0,
        description: 'Builds user interfaces and components'
      },
      {
        id: 'backend',
        name: 'Backend Developer', 
        type: 'backend',
        status: 'idle',
        progress: 0,
        description: 'Implements server-side logic and APIs'
      }
    ]);
    
    // Sample task data
    setTasks([
      {
        id: 'task-1',
        title: 'Initialize project structure',
        description: 'Set up initial project structure and configuration',
        agent_id: 'architect',
        status: 'completed',
        project_id: projectId,
        created_at: new Date().toISOString()
      },
      {
        id: 'task-2',
        title: 'Design component system',
        description: 'Create reusable component library',
        agent_id: 'frontend',
        status: 'in_progress',
        project_id: projectId,
        created_at: new Date().toISOString()
      }
    ]);
  }, [projectId]);

  const handleAgentPrompt = async () => {
    try {
      if (!projectId) {
        toast({
          title: 'Error',
          description: 'Project ID is missing. Please ensure you are on a valid project page.',
          variant: 'destructive',
        });
        return;
      }

      if (!getOpenRouterApiKey()) {
        toast({
          title: 'OpenRouter API Key Required',
          description: 'Please set your OpenRouter API key in the settings.',
          variant: 'destructive',
        });
        return;
      }

      if (!isGitHubServiceInitialized()) {
        toast({
          title: 'GitHub Service Not Initialized',
          description: 'Please connect to GitHub in the settings.',
          variant: 'destructive',
        });
        return;
      }

      setIsLoading(prev => ({ ...prev, messages: true }));
      
      try {
        const gitHubService = getGitHubService();
        const readmeContent = await gitHubService.getFileContent('README.md');
        
        const agentResponse = await sendAgentPrompt(
          {
            id: 'architect',
            name: 'Architect',
            type: 'architect',
            status: 'working'
          },
          `Analyze the following README content and provide a summary:\n${readmeContent}`,
          {
            id: projectId,
            name: 'Current Project',
            description: 'Test Project',
            mode: 'existing' as ProjectMode
          }
        );

        // Add the message to our messages array
        const newMessage: Message = {
          project_id: projectId,
          content: agentResponse || 'No response from agent.',
          sender: 'Architect',
          type: 'message',
          created_at: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, newMessage]);

        toast({
          title: 'Agent Response',
          description: 'Agent has analyzed the README and provided a response.',
        });
      } catch (error: any) {
        console.error('Error sending agent prompt:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to send agent prompt.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(prev => ({ ...prev, messages: false }));
      }
    } catch (error: any) {
      console.error('Error sending agent prompt:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send agent prompt.',
        variant: 'destructive',
      });
      setIsLoading(prev => ({ ...prev, messages: false }));
    }
  };

  const handleStartAgent = (agentId: string) => {
    console.log(`Starting agent: ${agentId}`);
    // Implementation would go here
    setAgents(agents.map(agent => 
      agent.id === agentId ? { ...agent, status: 'working' } : agent
    ));
    toast({
      title: 'Agent Started',
      description: `Agent ${agents.find(a => a.id === agentId)?.name} is now working.`,
    });
  };
  
  const handleStopAgent = (agentId: string) => {
    console.log(`Stopping agent: ${agentId}`);
    // Implementation would go here
    setAgents(agents.map(agent => 
      agent.id === agentId ? { ...agent, status: 'idle' } : agent
    ));
    toast({
      title: 'Agent Stopped',
      description: `Agent ${agents.find(a => a.id === agentId)?.name} is now idle.`,
    });
  };
  
  const handleRestartAgent = (agentId: string) => {
    console.log(`Restarting agent: ${agentId}`);
    // Implementation would go here
    setAgents(agents.map(agent => 
      agent.id === agentId ? { ...agent, status: 'working' } : agent
    ));
    toast({
      title: 'Agent Restarted',
      description: `Agent ${agents.find(a => a.id === agentId)?.name} has been restarted.`,
    });
  };
  
  const handleChatWithAgent = (agentId: string) => {
    setActiveChat(agentId);
    toast({
      title: 'Editing Agent',
      description: `Now editing ${agents.find(a => a.id === agentId)?.name}.`,
    });
  };
  
  const handleSendMessage = (message: string) => {
    if (!projectId || !activeChat) return;
    
    // Add user message
    const userMessage: Message = {
      project_id: projectId,
      content: message,
      sender: 'You',
      type: 'message',
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Simulate agent response
    setTimeout(() => {
      const agentMessage: Message = {
        project_id: projectId,
        content: `I received your message: "${message}"`,
        sender: agents.find(a => a.id === activeChat)?.name || 'Agent',
        type: 'message',
        created_at: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, agentMessage]);
    }, 1000);
  };
  
  const handleExecuteTask = (taskId: string, agentId: string) => {
    console.log(`Executing task ${taskId} with agent ${agentId}`);
    
    // Implementation would go here
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, status: 'in_progress' } : task
    ));
    
    toast({
      title: 'Task Execution Started',
      description: `Task ${tasks.find(t => t.id === taskId)?.title} is now being executed by ${agents.find(a => a.id === agentId)?.name}.`,
    });
    
    // Simulate task completion after 3 seconds
    setTimeout(() => {
      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, status: 'completed' } : task
      ));
      
      toast({
        title: 'Task Completed',
        description: `Task ${tasks.find(t => t.id === taskId)?.title} has been completed.`,
      });
    }, 3000);
  };

  const toggleDashboard = () => {
    setUseLegacyDashboard(!useLegacyDashboard);
  };

  if (!projectId) {
    return (
      <Card className="m-4">
        <CardHeader>
          <CardTitle>Error: Missing Project ID</CardTitle>
        </CardHeader>
        <CardContent>
          <p>No project ID was provided. Please navigate to a valid project page.</p>
        </CardContent>
      </Card>
    );
  }

  // Use the new DashboardUI by default, with option to toggle to legacy view
  return (
    <>
      <div className="p-2 bg-gray-100 border-b flex justify-end">
        <Button variant="outline" onClick={toggleDashboard}>
          {useLegacyDashboard ? "Switch to Modern UI" : "Switch to Legacy UI"}
        </Button>
      </div>
      
      {useLegacyDashboard ? (
        <Dashboard
          agents={agents}
          tasks={tasks}
          messages={messages}
          activeChat={activeChat}
          onStartAgent={handleStartAgent}
          onStopAgent={handleStopAgent}
          onRestartAgent={handleRestartAgent}
          onChatWithAgent={handleChatWithAgent}
          onSendMessage={handleSendMessage}
          onExecuteTask={handleExecuteTask}
          project={{
            id: projectId,
            name: `Project: ${projectId}`,
            description: 'This is a project page',
            mode: 'existing' as ProjectMode
          }}
          isLoading={isLoading}
        >
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Project: {projectId}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={handleAgentPrompt}>Send Agent Prompt</Button>
            </CardContent>
          </Card>
        </Dashboard>
      ) : (
        <DashboardUI 
          agents={agents}
          tasks={tasks}
          onStartAgent={handleStartAgent}
          onEditAgent={handleChatWithAgent}
          onExecuteTask={handleExecuteTask}
        />
      )}
    </>
  );
};

export default ProjectPage;
