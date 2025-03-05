
import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, GitBranch, Cpu, Download } from "lucide-react";
import { toast } from "sonner";

interface HeaderProps {
  onNewProject: () => void;
  onImportProject: () => void;
}

const Header: React.FC<HeaderProps> = ({ onNewProject, onImportProject }) => {
  const handleDownloadProject = () => {
    // This is a simplified example of how to download the current project files
    // In a real implementation, we would fetch all project files and package them
    
    // For demonstration, we'll just show a toast notification
    toast.info("Project download feature is coming soon!");
    
    // In a real implementation, you would:
    // 1. Fetch all project files from your backend
    // 2. Create a zip file containing these files
    // 3. Trigger a download of this zip file
    
    // Example of what a real implementation might look like:
    // fetch('/api/project/download')
    //   .then(response => response.blob())
    //   .then(blob => {
    //     const url = window.URL.createObjectURL(blob);
    //     const a = document.createElement('a');
    //     a.href = url;
    //     a.download = 'project.zip';
    //     document.body.appendChild(a);
    //     a.click();
    //     a.remove();
    //   })
    //   .catch(error => {
    //     toast.error("Failed to download project");
    //     console.error("Download error:", error);
    //   });
  };

  return (
    <header className="border-b bg-white">
      <div className="container py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Cpu className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold">Agentic Development Platform</h1>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center"
            onClick={handleDownloadProject}
          >
            <Download className="mr-2 h-4 w-4" />
            Download Project
          </Button>
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
