
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, GitBranch, Cpu, Download, Menu, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useParams, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface HeaderProps {
  onNewProject: () => void;
  onImportProject: () => void;
  activeProjectId?: string;
}

const Header: React.FC<HeaderProps> = ({ 
  onNewProject, 
  onImportProject,
  activeProjectId 
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { id: routeProjectId } = useParams<{ id?: string }>();
  const location = useLocation();
  
  // Use the activeProjectId from props when on index page, otherwise use the route param
  const projectId = location.pathname === "/" ? activeProjectId : routeProjectId;

  const handleDownloadProject = async () => {
    if (!projectId) {
      toast.info("Please select a project to download it.");
      return;
    }

    setIsDownloading(true);
    const toastId = toast.loading("Preparing project files for download...");
    
    try {
      // Call the Supabase Edge Function to generate the zip file
      const { data, error } = await supabase.functions.invoke('download-project', {
        body: { projectId },
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (!data || !data.dataURI) {
        throw new Error('Failed to generate project download.');
      }
      
      // Create a download link from the data URI
      const a = document.createElement('a');
      a.href = data.dataURI;
      a.download = data.filename || 'project.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      toast.dismiss(toastId);
      toast.success("Project downloaded successfully!");
    } catch (error) {
      console.error("Download error:", error);
      toast.dismiss(toastId);
      toast.error(`Failed to download project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <header className="border-b bg-white">
      <div className="py-3 px-3 sm:px-6 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Cpu className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          <h1 className="text-lg sm:text-xl font-semibold hidden sm:block">Agentic Development Platform</h1>
          <h1 className="text-lg font-semibold sm:hidden">ADP</h1>
        </div>
        
        {/* Mobile menu */}
        <div className="md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 py-2 bg-white rounded shadow-xl z-20 border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start px-4 py-2 text-left"
                onClick={handleDownloadProject}
                disabled={isDownloading || !projectId}
              >
                <Download className="mr-2 h-4 w-4" />
                {isDownloading ? "Preparing..." : "Download"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start px-4 py-2 text-left"
                onClick={onImportProject}
              >
                <GitBranch className="mr-2 h-4 w-4" />
                Import Project
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start px-4 py-2 text-left"
                onClick={onNewProject}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
              <Link 
                to="/external-crewai" 
                className="flex items-center px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                External CrewAI
              </Link>
            </div>
          )}
        </div>
        
        {/* Desktop buttons */}
        <div className="hidden md:flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center"
            onClick={handleDownloadProject}
            disabled={isDownloading || !projectId}
          >
            <Download className="mr-2 h-4 w-4" />
            {isDownloading ? "Preparing..." : "Download Project"}
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
          <Link 
            to="/external-crewai" 
            className="flex items-center text-sm text-gray-700 hover:text-gray-900"
          >
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              External CrewAI
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
