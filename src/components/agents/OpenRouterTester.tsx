
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OpenRouter } from "openrouter-sdk";
import { toast } from "sonner";
import { getOpenRouterApiKey } from '@/lib/env';

const OpenRouterTester: React.FC = () => {
  const [prompt, setPrompt] = useState('Tell me about the OpenRouter API in 2 sentences.');
  const [model, setModel] = useState('anthropic/claude-3.5-sonnet:thinking');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const testOpenRouter = async () => {
    setLoading(true);
    setResponse('');
    
    try {
      const apiKey = getOpenRouterApiKey();
      
      if (!apiKey) {
        toast.error('OpenRouter API key is not set. Please add it in the settings.');
        setLoading(false);
        return;
      }
      
      const openRouter = new OpenRouter({ apiKey });
      
      const completion = await openRouter.createChatCompletion({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that provides concise and accurate information.' },
          { role: 'user', content: prompt }
        ],
      });
      
      if (completion.choices && completion.choices[0] && completion.choices[0].message) {
        setResponse(completion.choices[0].message.content);
      } else {
        setResponse('Received an unexpected response format from OpenRouter.');
      }
    } catch (error) {
      console.error('Error testing OpenRouter:', error);
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast.error('Failed to get response from OpenRouter');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Test OpenRouter Connection</CardTitle>
        <CardDescription>
          Send a test prompt to OpenRouter to verify your API key is working
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Model</label>
          <Input 
            placeholder="OpenRouter model ID" 
            value={model} 
            onChange={(e) => setModel(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Prompt</label>
          <Textarea 
            placeholder="Enter your prompt" 
            rows={3}
            value={prompt} 
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        <Button 
          onClick={testOpenRouter} 
          disabled={loading || !prompt.trim()}
          className="w-full"
        >
          {loading ? "Testing..." : "Test Connection"}
        </Button>
        
        {response && (
          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium">Response</label>
            <div className="p-3 bg-gray-50 rounded-md text-sm whitespace-pre-wrap">
              {response}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OpenRouterTester;
