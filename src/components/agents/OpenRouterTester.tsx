
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OpenRouterKeyInput } from "./OpenRouterKeyInput";
import { getOpenRouterApiKey } from "@/lib/env";
import OpenRouter from "openrouter-sdk";

export function OpenRouterTester() {
  const [prompt, setPrompt] = useState("What is your name?");
  const [model, setModel] = useState("anthropic/claude-3.5-sonnet:thinking");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const apiKey = getOpenRouterApiKey();
      
      if (!apiKey) {
        throw new Error("OpenRouter API key is missing. Please add your API key first.");
      }
      
      const openrouter = new OpenRouter({
        apiKey: apiKey
      });
      
      // Make the API call using the SDK's generateText method
      const result = await openrouter.generateText({
        model: model,
        messages: [
          { role: "user", content: prompt }
        ],
      });
      
      // Extract and display the response
      if (result.choices && result.choices[0] && result.choices[0].message) {
        setResponse(result.choices[0].message.content);
      } else {
        throw new Error("Unexpected response format from OpenRouter");
      }
    } catch (err) {
      console.error("OpenRouter test error:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <OpenRouterKeyInput />
      
      <Card>
        <CardHeader>
          <CardTitle>Test OpenRouter Integration</CardTitle>
          <CardDescription>
            Send a test message to verify your OpenRouter connection
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Enter the model identifier"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt"
                rows={3}
              />
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                {error}
              </div>
            )}
            
            {response && (
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-md">
                <Label>Response:</Label>
                <div className="mt-2 whitespace-pre-wrap">{response}</div>
              </div>
            )}
          </CardContent>
          
          <CardFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Sending..." : "Test OpenRouter"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
