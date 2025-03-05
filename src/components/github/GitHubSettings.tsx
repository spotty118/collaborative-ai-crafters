
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { GithubUser, getCurrentGithubUser, initiateGithubAuth, clearGithubToken } from "@/lib/github";
import { Github } from "lucide-react";

interface GitHubSettingsProps {
  onConnected?: (user: GithubUser) => void;
}

const GitHubSettings: React.FC<GitHubSettingsProps> = ({ onConnected }) => {
  const [clientId, setClientId] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [user, setUser] = useState<GithubUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check if the URL contains a code parameter (GitHub OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    
    if (code) {
      // Remove the code from the URL to prevent issues on refresh
      const newUrl = window.location.pathname + 
        (window.location.search ? window.location.search.replace(/[?&]code=[^&]+/, "").replace(/[?&]state=[^&]+/, "") : "") + 
        window.location.hash;
      
      window.history.replaceState({}, document.title, newUrl);
      
      // Handle the callback
      import("@/lib/github").then(module => {
        module.handleGithubCallback(code, state).then(success => {
          if (success) {
            checkGithubConnection();
          }
        });
      });
    } else {
      checkGithubConnection();
    }
  }, []);

  const checkGithubConnection = async () => {
    setIsLoading(true);
    const currentUser = await getCurrentGithubUser();
    
    if (currentUser) {
      setUser(currentUser);
      setIsConnected(true);
      if (onConnected) {
        onConnected(currentUser);
      }
    }
    
    setIsLoading(false);
  };

  const handleConnect = () => {
    if (!clientId.trim()) {
      return;
    }
    
    initiateGithubAuth(clientId);
  };

  const handleDisconnect = () => {
    clearGithubToken();
    setIsConnected(false);
    setUser(null);
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="inline-block h-8 w-8 border-4 border-t-primary rounded-full animate-spin"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Github size={20} />
          GitHub Integration
        </CardTitle>
        <CardDescription>
          Connect your GitHub account to push projects directly to repositories
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {!isConnected ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="github-client-id">GitHub OAuth Client ID</Label>
              <Input
                id="github-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter your GitHub OAuth client ID"
              />
              <p className="text-xs text-gray-500">
                Create a GitHub OAuth app at{" "}
                <a 
                  href="https://github.com/settings/developers" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  GitHub Developer Settings
                </a>
                {" "}and enter the client ID here.
                <br />
                Set Homepage URL and Authorization callback URL to:{" "}
                <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                  {window.location.origin}
                </code>
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {user?.avatar_url && (
                <img 
                  src={user.avatar_url} 
                  alt={user.name || user.login} 
                  className="h-12 w-12 rounded-full"
                />
              )}
              <div>
                <h3 className="font-medium">{user?.name || user?.login}</h3>
                <p className="text-sm text-gray-500">@{user?.login}</p>
              </div>
            </div>
            <p className="text-sm text-green-600">
              Successfully connected to GitHub
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        {!isConnected ? (
          <Button 
            onClick={handleConnect} 
            disabled={!clientId.trim()}
            className="w-full"
          >
            <Github className="mr-2 h-4 w-4" />
            Connect to GitHub
          </Button>
        ) : (
          <Button 
            variant="outline" 
            onClick={handleDisconnect}
            className="w-full"
          >
            Disconnect from GitHub
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default GitHubSettings;
