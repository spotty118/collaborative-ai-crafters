
import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface OpenRouterKeyFormProps {
  onKeySubmit: (key: string) => void;
  apiKey?: string;
}

export function OpenRouterKeyForm({ onKeySubmit, apiKey }: OpenRouterKeyFormProps) {
  const [key, setKey] = useState(apiKey || '');
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter a valid OpenRouter API key",
        variant: "destructive",
      });
      return;
    }

    onKeySubmit(key.trim());
    toast({
      title: "API Key Updated",
      description: "Your OpenRouter API key has been set successfully",
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>OpenRouter API Key</CardTitle>
        <CardDescription>
          Enter your OpenRouter API key to enable AI agent functionality
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                id="apiKey"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter your OpenRouter API key"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Your API key is stored locally in your browser and is never sent to our servers.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full">
            Save API Key
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
