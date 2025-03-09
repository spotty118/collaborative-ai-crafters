import React from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Dashboard from '@/components/layout/Dashboard';
import { useToast } from '@/hooks/use-toast';
import { getOpenRouterApiKey } from '@/lib/env';
import { sendAgentPrompt } from '@/lib/openrouter';
import { getGitHubService, isGitHubServiceInitialized } from '@/lib/services/GitHubService';

// Remove the non-existent import for analyzeGitHubAndCreateTasks, as it doesn't exist
const ProjectPage: React.FC = () => {
  const { toast } = useToast();
  const { projectId } = useParams<{ projectId: string }>();

  const handleAgentPrompt = async () => {
    try {
      if (!projectId) {
        throw new Error('Project ID is missing.');
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

      const gitHubService = getGitHubService();
      const readmeContent = await gitHubService.getFileContent('README.md');

      const agentResponse = await sendAgentPrompt(
        {
          id: 'test-agent',
          name: 'Test Agent',
          type: 'architect',
        },
        `Analyze the following README content and provide a summary:\n${readmeContent}`,
        {
          id: projectId,
          name: 'Current Project',
          description: 'Test Project',
        }
      );

      toast({
        title: 'Agent Response',
        description: agentResponse || 'No response from agent.',
      });
    } catch (error: any) {
      console.error('Error sending agent prompt:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send agent prompt.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dashboard>
      <Card>
        <h1>Project: {projectId}</h1>
        <Button onClick={handleAgentPrompt}>Send Agent Prompt</Button>
      </Card>
    </Dashboard>
  );
};

export default ProjectPage;
