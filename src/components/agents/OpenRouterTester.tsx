
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getOpenRouterApiKey } from '@/lib/env';
import { OpenRouter } from 'openrouter-sdk';

export const OpenRouterTester: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>(getOpenRouterApiKey() || '');
  const [prompt, setPrompt] = useState<string>('What are the best practices for React development?');
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleTest = async () => {
    if (!apiKey) {
      setResponse('Please enter an OpenRouter API key first.');
      return;
    }

    setLoading(true);
    setResponse('Loading...');

    try {
      console.log('Testing OpenRouter API with key:', apiKey.substring(0, 5) + '...');
      
      // Initialize OpenRouter client
      const openRouter = new OpenRouter({ apiKey });
      
      // Call the API with the SDK
      const completion = await openRouter.createCompletion({
        model: 'anthropic/claude-3-opus:thinking',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1024,
      });

      if (completion.choices && completion.choices[0] && completion.choices[0].message) {
        setResponse(completion.choices[0].message.content);
      } else {
        setResponse('Received response but in unexpected format.');
      }

    } catch (error) {
      console.error('OpenRouter test error:', error);
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Test OpenRouter API</CardTitle>
        <CardDescription>
          Test your OpenRouter API key by sending a simple prompt
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="api-key">OpenRouter API Key</Label>
          <Input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="or-..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prompt">Prompt</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <Label>Response</Label>
          <div className="border rounded-md p-4 min-h-[100px] bg-gray-50 whitespace-pre-wrap">
            {response}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleTest} disabled={loading}>
          {loading ? 'Testing...' : 'Test OpenRouter API'}
        </Button>
      </CardFooter>
    </Card>
  );
};
