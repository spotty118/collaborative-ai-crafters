
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KeyIcon } from "lucide-react";
import { getOpenRouterApiKey, setLocalEnvVariable, removeLocalEnvVariable } from "@/lib/env";
import { useToast } from "@/hooks/use-toast";

export function OpenRouterKeyInput() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  
  // On component mount, check if an API key is already stored
  useEffect(() => {
    const storedKey = getOpenRouterApiKey();
    if (storedKey) {
      setHasKey(true);
      setApiKey(storedKey);
    }
  }, []);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      // Save to localStorage using the env function
      setLocalEnvVariable('OPENROUTER_API_KEY', apiKey.trim());
      setHasKey(true);
      toast({
        title: "API Key Saved",
        description: "Your OpenRouter API key has been saved to local storage.",
      });
    }
  };
  
  const handleRemove = () => {
    removeLocalEnvVariable('OPENROUTER_API_KEY');
    setApiKey("");
    setHasKey(false);
    toast({
      title: "API Key Removed",
      description: "Your OpenRouter API key has been removed from local storage.",
      variant: "destructive",
    });
  };
  
  return (
    <Card className="w-full max-w-md mb-6">
      <CardHeader>
        <CardTitle className="flex items-center">
          <KeyIcon className="mr-2 h-5 w-5" />
          OpenRouter API Key
        </CardTitle>
        <CardDescription>
          Enter your OpenRouter API key to enable agent communication
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent>
          <div className="flex flex-col space-y-2">
            <Input
              type="password"
              placeholder="Enter your OpenRouter API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1"
            />
            {hasKey && (
              <p className="text-sm text-green-600">
                API key is currently set
              </p>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button 
            type="submit" 
            disabled={!apiKey.trim()}
          >
            {hasKey ? "Update Key" : "Save Key"}
          </Button>
          
          {hasKey && (
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleRemove}
            >
              Remove Key
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
