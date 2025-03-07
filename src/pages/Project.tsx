
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import ProjectDeleteDialog from "@/components/ProjectDeleteDialog";
import { deleteAllCodeFiles, getProject } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Project as ProjectType } from "@/lib/types";
import { useProjectCrewAI } from "@/hooks/useProjectCrewAI";
import AgentSection from "@/components/agents/AgentSection";

const Project = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectType | null>(null);
  const [codeFiles, setCodeFiles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'files'>('overview');
  
  // State for the delete code files dialog
  const [deleteCodeFilesDialogOpen, setDeleteCodeFilesDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Initialize CrewAI
  const { 
    agents, 
    isLoading: isAgentsLoading,
    initializeAgents,
    startAgentTask,
    startTeamCollaboration
  } = useProjectCrewAI({
    projectId: id,
    onComplete: (result) => {
      console.log("CrewAI task completed:", result);
      toast({
        title: "Success",
        description: "Agents completed their tasks successfully.",
      });
      // Refresh code files or other data as needed
      fetchCodeFiles();
    }
  });

  // Fetch project details
  useEffect(() => {
    if (id) {
      fetchProject();
      fetchCodeFiles();
    }
  }, [id]);

  // Initialize CrewAI agents when project is loaded
  useEffect(() => {
    if (project && id) {
      initializeAgents(project);
    }
  }, [project, id, initializeAgents]);

  // Function to fetch project details
  const fetchProject = async () => {
    try {
      if (!id) return;
      
      // Try to fetch from API first
      try {
        const projectData = await getProject(id);
        if (projectData) {
          setProject(projectData);
          return;
        }
      } catch (apiError) {
        console.error("Failed to fetch project from API:", apiError);
        // Fall back to mock data
      }
      
      // Mock project data if API fails
      setProject({
        id: id,
        name: "Sample Project",
        description: "This is a sample project",
        mode: "existing",
        techStack: {
          frontend: "React",
          backend: "Node.js",
          database: "PostgreSQL",
          deployment: "Vercel"
        }
      });
    } catch (error) {
      console.error("Failed to fetch project:", error);
      toast({
        title: "Error",
        description: "Failed to fetch project details.",
        variant: "destructive",
      });
    }
  };

  // Function to fetch code files
  const fetchCodeFiles = async () => {
    try {
      // Mock code files data for now
      // In a real app, you would fetch this from your API or Supabase
      setCodeFiles([
        { id: "1", name: "index.js", path: "/src", content: "// Code here" },
        { id: "2", name: "App.js", path: "/src", content: "// App code here" }
      ]);
    } catch (error) {
      console.error("Failed to fetch code files:", error);
      toast({
        title: "Error",
        description: "Failed to fetch code files.",
        variant: "destructive",
      });
    }
  };

  // Function to handle deleting all code files
  const confirmDeleteAllCodeFiles = async () => {
    if (!project?.id) return;
    
    setIsDeleting(true);
    try {
      await deleteAllCodeFiles(project.id);
      toast({
        title: "Success",
        description: "All code files have been deleted.",
      });
      // Refresh code files list
      fetchCodeFiles();
    } catch (error) {
      console.error("Failed to delete code files:", error);
      toast({
        title: "Error",
        description: "Failed to delete all code files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteCodeFilesDialogOpen(false);
    }
  };

  // Function to start all agents
  const startAllAgents = async () => {
    if (!project) return;
    
    toast({
      title: "Starting Agents",
      description: "CrewAI agents are now working on your project...",
    });
    
    await startTeamCollaboration(agents, `Build a ${project.description} application using ${project.techStack.frontend} and ${project.techStack.backend}`);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Project: {project?.name}</h1>
      
      {/* Tabs */}
      <div className="flex border-b mb-4">
        <button 
          className={`px-4 py-2 ${activeTab === 'overview' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`px-4 py-2 ${activeTab === 'agents' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
          onClick={() => setActiveTab('agents')}
        >
          Agents
        </button>
        <button 
          className={`px-4 py-2 ${activeTab === 'files' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          Files
        </button>
      </div>
      
      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          <div className="bg-slate-50 p-4 rounded mb-4">
            <h2 className="text-xl mb-2">Project Details</h2>
            <p><strong>Description:</strong> {project?.description}</p>
            <p><strong>Tech Stack:</strong> {project?.techStack.frontend}, {project?.techStack.backend}, {project?.techStack.database}</p>
          </div>
          
          <Button
            onClick={startAllAgents}
            disabled={isAgentsLoading}
            className="mb-4"
          >
            {isAgentsLoading ? 'Starting Agents...' : 'Start Project Generation with CrewAI'}
          </Button>
        </div>
      )}
      
      {/* Agents Tab */}
      {activeTab === 'agents' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl">CrewAI Agents</h2>
            <Button
              onClick={startAllAgents}
              disabled={isAgentsLoading}
            >
              {isAgentsLoading ? 'Starting Agents...' : 'Start All Agents'}
            </Button>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map(agent => (
              <div key={agent.id} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-medium">{agent.name}</h3>
                  <span className="text-2xl">{agent.avatar}</span>
                </div>
                <p className="text-gray-600 mb-2">{agent.description}</p>
                <div className="mb-2">
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                    agent.status === 'working' ? 'bg-blue-100 text-blue-800' :
                    agent.status === 'completed' ? 'bg-green-100 text-green-800' :
                    agent.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                  </span>
                </div>
                {agent.progress > 0 && (
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                    <div 
                      className={`h-2.5 rounded-full ${
                        agent.status === 'completed' ? 'bg-green-500' :
                        agent.status === 'failed' ? 'bg-red-500' :
                        'bg-blue-500'
                      }`}
                      style={{ width: `${agent.progress}%` }}
                    ></div>
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startAgentTask(
                    agent.type, 
                    `Work on the ${agent.type} part of the ${project?.description} project using ${project?.techStack.frontend} and ${project?.techStack.backend}`
                  )}
                  disabled={agent.status === 'working' || isAgentsLoading}
                >
                  Start Task
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Files Tab */}
      {activeTab === 'files' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl">Code Files</h2>
            {project && (
              <Button 
                variant="destructive" 
                onClick={() => setDeleteCodeFilesDialogOpen(true)}
                className="ml-2"
              >
                Delete All Code Files
              </Button>
            )}
          </div>
          
          {/* Display code files list */}
          <div className="grid gap-4">
            {codeFiles.map(file => (
              <div key={file.id} className="p-4 border rounded">
                <p>{file.path}/{file.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <ProjectDeleteDialog
        isOpen={deleteCodeFilesDialogOpen}
        projectName={project?.name || ""}
        onClose={() => setDeleteCodeFilesDialogOpen(false)}
        onConfirm={confirmDeleteAllCodeFiles}
        isDeleting={isDeleting}
        title="Delete All Code Files"
        description={`Are you sure you want to delete all code files from "${project?.name || ""}"? This action cannot be undone.`}
        confirmButtonText="Delete All Files"
      />
    </div>
  );
};

export default Project;
