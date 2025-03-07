import React, { useState } from "react";
import ProjectDeleteDialog from "@/components/ProjectDeleteDialog";
import { deleteAllCodeFiles } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";

      {/* Dialog for confirming code files deletion */}
      

const Project = () => {
  // State for the delete code files dialog
  const [deleteCodeFilesDialogOpen, setDeleteCodeFilesDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  

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
      // Refresh code files list if you have one
      // This depends on how you're managing code files state
      if (typeof fetchCodeFiles === 'function') {
        fetchCodeFiles();
      }
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
    <div>
      

      {/* Add the Delete All Code Files button in the appropriate tab or section */}
      {/* This would typically be in the Code Files section */}
      {/* Code Files tab might have a button like this: */}
      {project && (
        <Button 
          variant="destructive" 
          onClick={() => setDeleteCodeFilesDialogOpen(true)}
          className="ml-2"
        >
          Delete All Code Files
        </Button>
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
