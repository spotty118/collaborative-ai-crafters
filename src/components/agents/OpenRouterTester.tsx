
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hasOpenRouterApiKey, setOpenRouterApiKey } from '@/lib/env';
import { toast } from 'sonner';
import { OpenRouter } from 'openrouter-sdk';

const OpenRouterTester: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasKey, setHasKey] = useState(hasOpenRouterApiKey());

  const handleSaveKey = () => {
    if (!apiKey) {
      toast.error('Please enter an API key');
      return;
    }
    
    setOpenRouterApiKey(apiKey);
    setHasKey(true);
    toast.success('API key saved successfully');
  };

  const handleSendPrompt = async () => {
    if (!hasKey) {
      toast.error('Please save your API key first');
      return;
    }

    if (!prompt) {
      toast.error('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setResponse('');

    try {
      const openRouter = new OpenRouter({ apiKey });
      
      const completion = await openRouter.createChatCompletion({
        model: 'anthropic/claude-3-5-sonnet:thinking',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
      });

      // Check if content is an array or a string and handle accordingly
      if (completion.choices && completion.choices[0] && completion.choices[0].message) {
        const content = completion.choices[0].message.content;
        
        // Convert to string if it's not already
        const responseText = typeof content === 'string' ? content : JSON.stringify(content);
        setResponse(responseText);
      } else {
        toast.error('Unexpected response format from OpenRouter');
      }
    } catch (error) {
      console.error('Error calling OpenRouter:', error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>OpenRouter API Tester</CardTitle>
        <CardDescription>Test your OpenRouter API integration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="api-key">OpenRouter API Key</Label>
          <div className="flex gap-2">
            <Input 
              id="api-key" 
              type="password" 
              placeholder="sk-or-..." 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)} 
              disabled={isLoading}
            />
            <Button onClick={handleSaveKey} disabled={isLoading || !apiKey}>Save Key</Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="prompt">Prompt</Label>
          <Textarea 
            id="prompt" 
            placeholder="Enter your prompt here..." 
            value={prompt} 
            onChange={(e) => setPrompt(e.target.value)} 
            disabled={isLoading || !hasKey}
            className="min-h-[100px]"
          />
        </div>
        
        {response && (
          <div className="space-y-2">
            <Label>Response</Label>
            <div className="bg-gray-100 p-4 rounded-md whitespace-pre-wrap">
              {response}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleSendPrompt} 
          disabled={isLoading || !hasKey || !prompt}
          className="w-full"
        >
          {isLoading ? "Sending..." : "Send Prompt"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default OpenRouterTester;
