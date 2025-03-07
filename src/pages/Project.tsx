
      {/* Dialog for confirming code files deletion */}
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
