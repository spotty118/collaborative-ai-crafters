
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Dashboard from '@/components/layout/Dashboard';
import { useToast } from '@/hooks/use-toast';
import { getOpenRouterApiKey } from '@/lib/env';
import { sendAgentPrompt } from '@/lib/openrouter';
import { getGitHubService, isGitHubServiceInitialized } from '@/lib/services/GitHubService';
import { Agent, Message, Task, ProjectMode } from '@/lib/types';

const ProjectPage: React.FC = () => {
  const { toast } = useToast();
  const { projectId } = useParams<{ projectId: string }>();
  
  // Initialize state for the Dashboard component
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState({
    agents: false,
    tasks: false,
    messages: false
  });

  // Load initial data
  useEffect(() => {
    if (!projectId) return;
    
    // Sample agent data for testing
    setAgents([
      {
        id: 'architect',
        name: 'Architect',
        type: 'architect',
        status: 'idle'
      },
      {
        id: 'frontend',
        name: 'Frontend Developer',
        type: 'frontend',
        status: 'idle'
      },
      {
        id: 'backend',
        name: 'Backend Developer', 
        type: 'backend',
        status: 'idle'
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
            status: 'working'  // Changed from 'active' to 'working'
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

  // Handlers for Dashboard props
  const handleStartAgent = (agentId: string) => {
    console.log(`Starting agent: ${agentId}`);
    // Implementation would go here
    setAgents(agents.map(agent => 
      agent.id === agentId ? { ...agent, status: 'working' } : agent  // Changed from 'active' to 'working'
    ));
  };
  
  const handleStopAgent = (agentId: string) => {
    console.log(`Stopping agent: ${agentId}`);
    // Implementation would go here
    setAgents(agents.map(agent => 
      agent.id === agentId ? { ...agent, status: 'idle' } : agent
    ));
  };
  
  const handleRestartAgent = (agentId: string) => {
    console.log(`Restarting agent: ${agentId}`);
    // Implementation would go here
    setAgents(agents.map(agent => 
      agent.id === agentId ? { ...agent, status: 'working' } : agent  // Changed from 'active' to 'working'
    ));
  };
  
  const handleChatWithAgent = (agentId: string) => {
    setActiveChat(agentId);
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

  return (
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
  );
};

export default ProjectPage;
