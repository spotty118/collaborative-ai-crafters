
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import ProjectDeleteDialog from "@/components/ProjectDeleteDialog";
import { deleteAllCodeFiles } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Project as ProjectType } from "@/lib/types";

const Project = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectType | null>(null);
  const [codeFiles, setCodeFiles] = useState<any[]>([]);
  
  // State for the delete code files dialog
  const [deleteCodeFilesDialogOpen, setDeleteCodeFilesDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch project details
  useEffect(() => {
    if (id) {
      fetchProject();
      fetchCodeFiles();
    }
  }, [id]);

  // Function to fetch project details
  const fetchProject = async () => {
    try {
      // Mock project data for now
      // In a real app, you would fetch this from your API or Supabase
      setProject({
        id: id || "1",
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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Project: {project?.name}</h1>
      
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
