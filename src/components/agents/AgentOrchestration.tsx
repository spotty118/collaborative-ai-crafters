import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Agent, Project } from '@/lib/types';
import { orchestrateAgents, sendAgentPrompt } from '@/lib/openrouter';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { hasOpenRouterApiKey } from '@/lib/env';
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
  const [orchestrationMethod, setOrchestrationMethod] = useState<'sdk' | 'integrated'>('integrated');

  const runOrchestration = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a project description');
      return;
    }

    setIsOrchestrating(true);
    setProgress(5);
    setStage('Initializing orchestration');
    setResults(null);

    try {
      let orchestrationResults;

      // Client-side orchestration using the integrated function
      if (orchestrationMethod === 'integrated') {
        setStage('Designing project with Architect agent');
        setProgress(10);
        
        // Verify that all agents are available
        const architectAgent = agents.find(a => a.type === 'architect');
        if (!architectAgent) {
          throw new Error('Architect agent is required for orchestration');
        }
        
        // Start the orchestration process
        orchestrationResults = await orchestrateAgents(project, agents, prompt);
        
      // Direct SDK orchestration with OpenRouter SDK
      } else if (orchestrationMethod === 'sdk') {
        if (!hasOpenRouterApiKey()) {
          throw new Error('OpenRouter API key is required for SDK orchestration');
        }
        
        setStage('Starting SDK orchestration with OpenRouter');
        setProgress(10);
        
        // Verify architect agent is available
        const architectAgent = agents.find(a => a.type === 'architect');
        if (!architectAgent) {
          throw new Error('Architect agent is required for orchestration');
        }
        
        // Get project design from architect agent using SDK directly
        setStage('Designing project with Architect agent using OpenRouter SDK');
        setProgress(20);
        
        const designResponse = await sendAgentPrompt(
          architectAgent,
          `Design a comprehensive project plan for: ${prompt}`,
          project,
          { model: 'anthropic/claude-3.5-sonnet:thinking', ignoreStatus: true }
        );
        
        // Parse the design and create mock results for demonstration
        setStage('Analyzing architect design');
        setProgress(50);
        
        // Process design and mock task execution
        orchestrationResults = {
          projectPlan: {
            name: "Project Plan from OpenRouter SDK",
            description: prompt,
            design: designResponse.substring(0, 500) + "..." // truncate for display
          },
          results: [
            { id: "sdk-1", description: "Project design", assignedTo: "architect", status: "completed", result: designResponse }
          ],
          evaluation: "Project plan created using the OpenRouter SDK. To execute tasks, use the integrated orchestration method."
        };
      }
      
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
              <div className="text-sm font-medium">Orchestration Method:</div>
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  size="sm" 
                  variant={orchestrationMethod === 'integrated' ? 'default' : 'outline'}
                  onClick={() => setOrchestrationMethod('integrated')}
                  disabled={isOrchestrating}
                >
                  Integrated
                </Button>
                <Button 
                  size="sm" 
                  variant={orchestrationMethod === 'sdk' ? 'default' : 'outline'}
                  onClick={() => setOrchestrationMethod('sdk')}
                  disabled={isOrchestrating || !hasOpenRouterApiKey()}
                  title={!hasOpenRouterApiKey() ? "OpenRouter API key not available" : ""}
                >
                  OpenRouter SDK
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
            disabled={isOrchestrating || !prompt.trim() || (orchestrationMethod === 'sdk' && !hasOpenRouterApiKey())}
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
