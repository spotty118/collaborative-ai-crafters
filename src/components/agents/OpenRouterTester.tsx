
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getOpenRouterApiKey } from '@/lib/env';
import { OpenRouter } from 'openrouter-sdk';

const OpenRouterTester = () => {
  const [prompt, setPrompt] = useState('Explain how OpenRouter works with JavaScript');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendTestQuery = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const apiKey = getOpenRouterApiKey();
      
      if (!apiKey) {
        throw new Error('OpenRouter API key is required. Please add it in the settings.');
      }
      
      // Initialize the OpenRouter client with the API key
      const openRouter = new OpenRouter({ apiKey });
      
      // Call the API with the correct method
      const completion = await openRouter.generateText({
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
        throw new Error('Unexpected response format from OpenRouter');
      }
    } catch (error) {
      console.error('Error testing OpenRouter:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Test OpenRouter Integration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            className="min-h-[100px]"
          />
        </div>
        
        {error && (
          <div className="text-red-500 text-sm">
            Error: {error}
          </div>
        )}
        
        {response && (
          <div className="border p-4 rounded-md bg-gray-50 dark:bg-gray-900">
            <h3 className="font-medium mb-2">Response:</h3>
            <div className="whitespace-pre-wrap text-sm">{response}</div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={sendTestQuery} disabled={loading}>
          {loading ? 'Sending...' : 'Send Test Query'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default OpenRouterTester;
