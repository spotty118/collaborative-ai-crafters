
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { GithubRepo, getUserRepositories, getGithubToken } from "@/lib/github";
import { GitBranch, Loader2 } from "lucide-react";

interface GitHubRepoSelectorProps {
  onRepoSelect: (repo: GithubRepo) => void;
}

const GitHubRepoSelector: React.FC<GitHubRepoSelectorProps> = ({ onRepoSelect }) => {
  const [repositories, setRepositories] = useState<GithubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    const token = getGithubToken();
    
    if (!token) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const repos = await getUserRepositories();
      setRepositories(repos);
    } catch (error) {
      console.error("Error fetching repositories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepoChange = (value: string) => {
    setSelectedRepo(value);
    const repo = repositories.find(r => r.full_name === value);
    
    if (repo) {
      onRepoSelect(repo);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch size={20} />
          Select Repository
        </CardTitle>
        <CardDescription>
          Choose a GitHub repository to push your project to
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repo-select">Repository</Label>
            
            {isLoading ? (
              <div className="flex items-center justify-center h-10 border rounded-md border-input bg-background">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <Select value={selectedRepo} onValueChange={handleRepoChange}>
                <SelectTrigger id="repo-select">
                  <SelectValue placeholder="Select a repository" />
                </SelectTrigger>
                <SelectContent>
                  {repositories.map((repo) => (
                    <SelectItem key={repo.id} value={repo.full_name}>
                      {repo.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardContent>
      
      <CardFooter>
        <Button
          variant="outline"
          onClick={fetchRepositories}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            "Refresh Repositories"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default GitHubRepoSelector;
