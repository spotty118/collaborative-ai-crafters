
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GithubUser, GithubRepo, updateFileInRepo } from "@/lib/github";
import GitHubSettings from "./GitHubSettings";
import GitHubRepoSelector from "./GitHubRepoSelector";
import { Project } from "@/lib/types";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface GitHubIntegrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

const GitHubIntegrationDialog: React.FC<GitHubIntegrationDialogProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [user, setUser] = useState<GithubUser | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const handleGitHubConnected = (connectedUser: GithubUser) => {
    setUser(connectedUser);
  };

  const handleRepoSelect = (repo: GithubRepo) => {
    setSelectedRepo(repo);
  };

  const handlePushToGitHub = async () => {
    if (!project || !selectedRepo) {
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Create a README.md with project information
      const readmeContent = `# ${project.name}
      
${project.description}

## Tech Stack
${project.tech_stack.join(', ')}

## Project Status
${project.status}

Generated with the Agentic Development Platform
`;

      const readmeSuccess = await updateFileInRepo(
        selectedRepo.full_name,
        "README.md",
        readmeContent,
        `Initial commit for ${project.name}`
      );
      
      if (readmeSuccess) {
        toast.success(`Successfully pushed project to ${selectedRepo.full_name}`);
        onClose();
      }
    } catch (error) {
      console.error("Error pushing to GitHub:", error);
      toast.error(`Failed to push to GitHub: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Push to GitHub</DialogTitle>
          <DialogDescription>
            Connect your GitHub account and push your project to a repository
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <GitHubSettings onConnected={handleGitHubConnected} />
          
          {user && (
            <GitHubRepoSelector onRepoSelect={handleRepoSelect} />
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handlePushToGitHub} 
            disabled={!user || !selectedRepo || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Pushing to GitHub...
              </>
            ) : (
              "Push to GitHub"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GitHubIntegrationDialog;
