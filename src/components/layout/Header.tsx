
import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, GitBranch, Cpu, Github } from "lucide-react";

interface HeaderProps {
  onNewProject: () => void;
  onImportProject: () => void;
  onGithubPush?: () => void;
  hasActiveProject?: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  onNewProject, 
  onImportProject, 
  onGithubPush,
  hasActiveProject = false
}) => {
  return (
    <header className="border-b bg-white">
      <div className="container py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Cpu className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Agentic Development Platform</h1>
        </div>
        <div className="flex items-center space-x-3">
          {hasActiveProject && onGithubPush && (
            <Button
              variant="outline"
              size="sm"
              className="flex items-center"
              onClick={onGithubPush}
            >
              <Github className="mr-2 h-4 w-4" />
              Push to GitHub
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex items-center"
            onClick={onImportProject}
          >
            <GitBranch className="mr-2 h-4 w-4" />
            Import Project
          </Button>
          <Button
            size="sm"
            className="flex items-center"
            onClick={onNewProject}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
