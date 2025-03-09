
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { SendAgentPromptOptions } from '@/lib/types';
import { OpenRouter } from 'openrouter-sdk';
import { OPENROUTER_API_KEY } from '@/lib/env';

const OpenRouterTester: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("anthropic/claude-3.5-sonnet:thinking");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful AI assistant.");

  const availableModels = [
    { id: "anthropic/claude-3.5-sonnet:thinking", name: "Claude 3.5 Sonnet (Thinking)" },
    { id: "anthropic/claude-3-opus", name: "Claude 3 Opus" },
    { id: "anthropic/claude-3-sonnet", name: "Claude 3 Sonnet" },
    { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku" },
    { id: "google/gemini-1.5-pro-latest", name: "Gemini 1.5 Pro" },
    { id: "meta-llama/llama-3-70b-instruct", name: "Llama 3 70B" },
    { id: "meta-llama/llama-3-8b-instruct", name: "Llama 3 8B" },
    { id: "mistralai/mistral-large-latest", name: "Mistral Large" },
    { id: "mistralai/mistral-medium-latest", name: "Mistral Medium" }
  ];

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    if (!OPENROUTER_API_KEY) {
      toast.error("OpenRouter API key is not configured");
      return;
    }

    setIsLoading(true);
    setResponse("");

    try {
      // Initialize the OpenRouter SDK
      const openrouter = new OpenRouter({
        apiKey: OPENROUTER_API_KEY,
        baseUrl: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://lovable.ai',
          'X-Title': 'Lovable AI OpenRouter Tester',
        }
      });
      
      // Prepare messages
      const messages = [];
      
      // Add system prompt if provided
      if (systemPrompt.trim()) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      
      // Add user prompt
      messages.push({ role: 'user', content: prompt });
      
      // Make the API call
      const completion = await openrouter.chat.completions.create({
        model: model,
        messages: messages,
        temperature: 0.3,
        max_tokens: 1024,
      });
      
      // Process response
      if (completion.choices && completion.choices[0] && completion.choices[0].message) {
        setResponse(completion.choices[0].message.content);
      } else {
        throw new Error("Unexpected response format from OpenRouter");
      }
      
      toast.success("Request completed successfully");
    } catch (error) {
      console.error("Error sending prompt to OpenRouter:", error);
      toast.error(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      setResponse(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>OpenRouter SDK Tester</CardTitle>
          <CardDescription>
            Test the OpenRouter SDK directly with different models
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Model</label>
              <Select value={model} onValueChange={setModel} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">System Prompt</label>
              <Textarea
                placeholder="System prompt (optional)..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={2}
                disabled={isLoading}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Prompt</label>
              <Textarea
                placeholder="Enter your prompt here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                disabled={isLoading}
              />
            </div>
            
            <Button 
              onClick={handleSubmit} 
              disabled={isLoading || !prompt.trim() || !OPENROUTER_API_KEY}
              className="w-full"
            >
              {isLoading ? "Sending..." : "Send to OpenRouter"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {response && (
        <Card>
          <CardHeader>
            <CardTitle>Response</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full rounded-md border p-4">
              <div className="whitespace-pre-wrap">{response}</div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OpenRouterTester;
