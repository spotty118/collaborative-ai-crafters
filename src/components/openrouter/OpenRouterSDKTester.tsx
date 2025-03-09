
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { SDKService } from '@/services/openRouterSDK';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Agent, AgentType } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useOpenRouterSDK } from '@/hooks/useOpenRouterSDK';

interface ModelOption {
  id: string;
  name: string;
}

const OpenRouterSDKTester: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('architect');
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4o-mini');
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const { sdkService, isApiKeySet, isChecking } = useOpenRouterSDK();
  
  useEffect(() => {
    if (isApiKeySet) {
      fetchModels();
    }
  }, [isApiKeySet]);
  
  const fetchModels = async () => {
    try {
      setIsLoadingModels(true);
      const openRouterModels = await sdkService.getModels();
      
      const formattedModels = openRouterModels.map((model: any) => ({
        id: model.id,
        name: `${model.name} (${model.context_length} tokens)`
      }));
      
      setModels(formattedModels);
      
      // If no model is selected yet, select the first one
      if (formattedModels.length > 0 && !selectedModel) {
        setSelectedModel(formattedModels[0].id);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      toast.error('Failed to fetch models: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoadingModels(false);
    }
  };
  
  const handleSendPrompt = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    
    if (!isApiKeySet) {
      toast.error('API key is not set. Please configure your settings first.');
      return;
    }
    
    setIsLoading(true);
    setResult('');
    
    try {
      // Create a temporary agent with the selected type
      const agent: Agent = {
        id: `temp-${Date.now()}`,
        name: `Temporary ${selectedAgent.charAt(0).toUpperCase() + selectedAgent.slice(1)}`,
        type: selectedAgent,
        status: 'idle'
      };
      
      // Override the model in localStorage temporarily
      const originalModel = localStorage.getItem('OPENROUTER_DEFAULT_MODEL');
      localStorage.setItem('OPENROUTER_DEFAULT_MODEL', selectedModel);
      
      // Execute the agent
      const response = await SDKService.executeAgent(agent, prompt);
      
      // Restore the original model
      if (originalModel) {
        localStorage.setItem('OPENROUTER_DEFAULT_MODEL', originalModel);
      } else {
        localStorage.removeItem('OPENROUTER_DEFAULT_MODEL');
      }
      
      setResult(response);
      
    } catch (error) {
      console.error('Error executing agent:', error);
      toast.error('Failed to execute agent: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClear = () => {
    setPrompt('');
    setResult('');
  };
  
  const handleRefreshModels = () => {
    fetchModels();
  };
  
  if (isChecking) {
    return (
      <Card className="w-full h-full">
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Checking API key...</span>
        </CardContent>
      </Card>
    );
  }
  
  if (!isApiKeySet) {
    return (
      <Card className="w-full h-full">
        <CardHeader>
          <CardTitle>OpenRouter SDK Tester</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-64 space-y-4">
          <p className="text-center text-gray-600">
            API key is not set. Please configure your settings first.
          </p>
          <Button onClick={() => window.location.href = '/sdk/settings'}>
            Go to Settings
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle>OpenRouter SDK Tester</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="agent">
          <TabsList className="mb-4">
            <TabsTrigger value="agent">Agent</TabsTrigger>
            <TabsTrigger value="model">Model</TabsTrigger>
          </TabsList>
          
          <TabsContent value="agent" className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agent Type</label>
              <Select 
                value={selectedAgent} 
                onValueChange={(value) => setSelectedAgent(value as AgentType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select agent type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="architect">Architect</SelectItem>
                  <SelectItem value="frontend">Frontend Developer</SelectItem>
                  <SelectItem value="backend">Backend Developer</SelectItem>
                  <SelectItem value="testing">Testing Engineer</SelectItem>
                  <SelectItem value="devops">DevOps Engineer</SelectItem>
                  <SelectItem value="custom">Custom Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
          
          <TabsContent value="model" className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Model</label>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleRefreshModels}
                  disabled={isLoadingModels}
                  className="h-8 px-2"
                >
                  {isLoadingModels ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="flex items-center text-xs">Refresh Models</span>
                  )}
                </Button>
              </div>
              <Select 
                value={selectedModel} 
                onValueChange={setSelectedModel}
                disabled={isLoadingModels}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingModels ? "Loading models..." : "Select a model"} />
                </SelectTrigger>
                <SelectContent>
                  {models.length > 0 ? (
                    models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="loading" disabled>
                      {isLoadingModels ? "Loading models..." : "No models available"}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {models.length === 0 && !isLoadingModels && (
                <p className="text-sm text-amber-600 mt-1">
                  No models loaded. Click refresh to load available models.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Prompt</label>
          <Textarea
            placeholder="Enter your prompt..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[120px]"
            disabled={isLoading}
          />
        </div>
        
        {result && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Result</label>
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 min-h-[120px] max-h-[300px] overflow-y-auto whitespace-pre-wrap">
              {result}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleClear} disabled={isLoading}>
          Clear
        </Button>
        <Button onClick={handleSendPrompt} disabled={isLoading || !prompt.trim()}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Send Prompt'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default OpenRouterSDKTester;
