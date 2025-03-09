
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { OpenRouter } from 'openrouter-sdk';
import { hasOpenRouterApiKey, getEnvVariable } from '@/lib/env';
import { OpenRouterKeyForm } from './OpenRouterKeyForm';
import { setOpenRouterApiKey } from '@/lib/openrouter';
import { useToast } from '@/hooks/use-toast';

export function OpenRouterTester() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [hasKey, setHasKey] = useState(hasOpenRouterApiKey());

  const handleKeySubmit = (key: string) => {
    const client = setOpenRouterApiKey(key);
    if (client) {
      setHasKey(true);
      toast({
        title: "API Key Set",
        description: "Your OpenRouter API key has been saved successfully.",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to set OpenRouter API key.",
        variant: "destructive",
      });
    }
  };

  const handleSendPrompt = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const apiKey = getEnvVariable('OPENROUTER_API_KEY');
      
      if (!apiKey) {
        setError('OpenRouter API key not found. Please enter your API key.');
        setLoading(false);
        return;
      }
      
      const openrouter = new OpenRouter({
        apiKey,
      });
      
      const completion = await openrouter.chat.completions.create({
        model: 'anthropic/claude-3-5-sonnet:thinking',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });
      
      if (completion.choices && completion.choices[0] && completion.choices[0].message) {
        setResponse(completion.choices[0].message.content);
      } else {
        setError('Received an unexpected response format from OpenRouter');
      }
    } catch (err) {
      console.error('Error calling OpenRouter:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!hasKey ? (
        <OpenRouterKeyForm onKeySubmit={handleKeySubmit} />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>OpenRouter SDK Tester</CardTitle>
              <CardDescription>
                Test the OpenRouter SDK directly from the browser
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Prompt</p>
                  <Textarea
                    placeholder="Enter your prompt..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                  />
                </div>
                
                {error && (
                  <div className="p-3 text-sm bg-red-50 text-red-700 rounded-md">
                    {error}
                  </div>
                )}
                
                {response && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Response</p>
                    <div className="p-3 bg-gray-50 rounded-md whitespace-pre-wrap">
                      {response}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setHasKey(false)}
              >
                Change API Key
              </Button>
              <Button 
                onClick={handleSendPrompt} 
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Prompt'}
              </Button>
            </CardFooter>
          </Card>
        </>
      )}
    </div>
  );
}
