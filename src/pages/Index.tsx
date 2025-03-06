
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getProjects, createProject, deleteProject } from "@/lib/api";
import Header from "@/components/layout/Header";
import { ProjectCard } from "@/components/ProjectCard";
import ProjectSetup from "@/components/layout/ProjectSetup";
import ProjectDeleteDialog from "@/components/ProjectDeleteDialog";
import { Project } from "@/lib/types";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const Index: React.FC = () => {
  const navigate = useNavigate();
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { 
    data: projects = [], 
    isLoading, 
    error,
    refetch
  } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects
  });

  const handleCreateProject = async (project: any) => {
    try {
      const newProject = await createProject({
        name: project.name,
        description: project.description,
        status: "setup",
        progress: 0,
        tech_stack: [
          project.techStack.frontend,
          project.techStack.backend,
          project.techStack.database,
          project.techStack.deployment
        ],
        source_type: project.mode === 'existing' ? 'github' : undefined,
        source_url: project.mode === 'existing' ? project.repositoryUrl : undefined,
        requirements: project.requirements
      });
      
      toast.success("Project created successfully!");
      setShowNewProject(false);
      navigate(`/project/${newProject.id}`);
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error("Failed to create project: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setProjectToDelete(project);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      toast.success(`Project "${projectToDelete.name}" deleted successfully`);
      refetch();
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsDeleting(false);
      setProjectToDelete(null);
    }
  };

  const closeDeleteDialog = () => {
    setProjectToDelete(null);
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        onNewProject={() => setShowNewProject(true)}
        onImportProject={() => setShowNewProject(true)}
      />
      
      <main className="container mx-auto px-4 py-8">
        {showNewProject ? (
          <ProjectSetup 
            isOpen={true}
            onClose={() => setShowNewProject(false)}
            onCreateProject={handleCreateProject}
          />
        ) : (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl font-bold">Your Projects</h1>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="h-8 w-8 border-4 border-t-primary rounded-full animate-spin"></div>
              </div>
            ) : error ? (
              <div className="text-center py-20 text-red-500">
                <p>Error loading projects. Please try again.</p>
                <button 
                  onClick={() => refetch()} 
                  className="mt-4 px-4 py-2 bg-primary text-white rounded"
                >
                  Retry
                </button>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-lg text-gray-600 mb-4">You don't have any projects yet.</p>
                <button 
                  onClick={() => setShowNewProject(true)} 
                  className="px-4 py-2 bg-primary text-white rounded"
                >
                  Create Your First Project
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                  <div key={project.id} className="relative group">
                    <ProjectCard 
                      project={project} 
                      onClick={() => navigate(`/project/${project.id}`)}
                    />
                    <button
                      onClick={(e) => handleDeleteClick(e, project)}
                      className="absolute top-2 right-2 bg-white p-2 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-50"
                      aria-label={`Delete project ${project.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <ProjectDeleteDialog 
          isOpen={!!projectToDelete}
          projectName={projectToDelete?.name || ''}
          onClose={closeDeleteDialog}
          onConfirm={handleDeleteConfirm}
          isDeleting={isDeleting}
        />
      </main>
    </div>
  );
};

export default Index;
