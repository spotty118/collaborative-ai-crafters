
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Agent, Project } from '@/lib/types';
import { orchestrateAgents, sendAgentPrompt, openRouterClient } from '@/lib/openrouter-client';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AgentOrchestrationProps {
  project: Project;
  agents: Agent[];
  onCompletion?: (results: any) => void;
}

const AgentOrchestration: React.FC<AgentOrchestrationProps> = ({
  project,
  agents,
  onCompletion
}) => {
  const [prompt, setPrompt] = useState('');
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [results, setResults] = useState<any>(null);
  const [orchestrationMethod, setOrchestrationMethod] = useState<'claude' | 'gpt4'>('gpt4');

  const runOrchestration = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a project description');
      return;
    }

    if (!openRouterClient.hasApiKey()) {
      toast.error('OpenRouter API key is required. Please set it in the settings.');
      return;
    }

    setIsOrchestrating(true);
    setProgress(5);
    setStage('Initializing orchestration');
    setResults(null);

    try {
      let orchestrationResults;
      let model;

      // Select model based on orchestration method
      if (orchestrationMethod === 'claude') {
        model = 'anthropic/claude-3-sonnet';
        setStage('Designing project with Architect agent using Claude');
      } else {
        model = 'openai/gpt-4o-mini';
        setStage('Designing project with Architect agent using GPT-4');
      }
      
      setProgress(10);
      
      // Verify that architect agent is available
      const architectAgent = agents.find(a => a.type === 'architect');
      if (!architectAgent) {
        throw new Error('Architect agent is required for orchestration');
      }
      
      // Start the orchestration process with the selected model
      orchestrationResults = await orchestrateAgents(project, agents, prompt);
      
      setStage('Orchestration completed');
      setProgress(100);
      setResults(orchestrationResults);
      
      if (onCompletion) {
        onCompletion(orchestrationResults);
      }
      
      toast.success('Agent orchestration completed successfully');
      
    } catch (error) {
      console.error('Orchestration error:', error);
      toast.error(`Orchestration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsOrchestrating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Agent Orchestration</CardTitle>
          <CardDescription>
            Create a project description for the Architect agent to orchestrate tasks across specialized agents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="text-sm font-medium">Model:</div>
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  size="sm" 
                  variant={orchestrationMethod === 'gpt4' ? 'default' : 'outline'}
                  onClick={() => setOrchestrationMethod('gpt4')}
                  disabled={isOrchestrating}
                >
                  GPT-4o
                </Button>
                <Button 
                  size="sm" 
                  variant={orchestrationMethod === 'claude' ? 'default' : 'outline'}
                  onClick={() => setOrchestrationMethod('claude')}
                  disabled={isOrchestrating}
                >
                  Claude 3
                </Button>
              </div>
            </div>
            <Textarea
              placeholder="Describe the project or task for the agents to work on..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-28"
              disabled={isOrchestrating}
            />
          </div>
          
          {isOrchestrating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{stage}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
          
          <Button 
            onClick={runOrchestration} 
            disabled={isOrchestrating || !prompt.trim() || !openRouterClient.hasApiKey()}
            className="w-full"
          >
            {isOrchestrating ? "Orchestrating..." : "Start Agent Orchestration"}
          </Button>
        </CardContent>
      </Card>
      
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Orchestration Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Project Plan</h3>
              <div className="bg-gray-50 p-3 rounded-md text-sm">
                <pre className="whitespace-pre-wrap">{JSON.stringify(results.projectPlan, null, 2)}</pre>
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Completed Tasks</h3>
              <ScrollArea className="h-64 w-full rounded-md border">
                <div className="p-4 space-y-4">
                  {results.results && results.results.map((task: any, index: number) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between">
                        <h4 className="font-medium">{task.description}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          task.status === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">Assigned to: {task.assignedTo}</div>
                      <div className="bg-gray-50 p-2 rounded text-sm">
                        <div className="font-medium mb-1">Result:</div>
                        <div className="whitespace-pre-wrap">{task.result}</div>
                      </div>
                      {index < results.results.length - 1 && <Separator className="my-2" />}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Evaluation</h3>
              <div className="bg-gray-50 p-3 rounded-md text-sm whitespace-pre-wrap">
                {results.evaluation}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AgentOrchestration;
