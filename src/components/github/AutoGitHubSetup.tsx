
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import GitHubSetupWizard from "./GitHubSetupWizard";
import { GithubUser } from "@/lib/github";

interface AutoGitHubSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onSetupComplete?: (user: GithubUser) => void;
}

const AutoGitHubSetup: React.FC<AutoGitHubSetupProps> = ({
  isOpen,
  onClose,
  onSetupComplete
}) => {
  const handleSetupComplete = (user: GithubUser) => {
    if (onSetupComplete) {
      onSetupComplete(user);
    }
    
    setTimeout(() => {
      onClose();
    }, 2000); // Give user a moment to see the success message
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>GitHub Integration Setup</DialogTitle>
          <DialogDescription>
            Connect your application to GitHub with this automated setup wizard
          </DialogDescription>
        </DialogHeader>
        
        <GitHubSetupWizard
          onComplete={handleSetupComplete}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
};

export default AutoGitHubSetup;
