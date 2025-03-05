
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stepper, Step, StepTitle, StepDescription } from "@/components/ui/stepper";
import { useEffect, useState } from "react";
import { initiateGitHubOAuth } from "@/lib/github";
import { extractGitHubCallbackParams, handleGitHubCallback, isGitHubAuthenticated } from "@/lib/github";
import { useToast } from "@/hooks/use-toast";

export const GitHubIntegrationDialog = ({ onClose }: { onClose: () => void }) => {
  const [isHandlingCallback, setIsHandlingCallback] = useState(false);
  const { toast } = useToast();
  
  // Check for GitHub OAuth callback when the component mounts
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const { code, state } = extractGitHubCallbackParams();
      
      if (code && state) {
        setIsHandlingCallback(true);
        
        try {
          await handleGitHubCallback(code, state);
          
          // Clear the URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
          
          toast({
            title: "GitHub connected successfully",
            description: "Your GitHub account has been connected.",
            variant: "default",
          });
        } catch (error: any) {
          console.error("Error handling GitHub callback:", error);
          
          toast({
            title: "GitHub connection failed",
            description: error.message || "An error occurred while connecting to GitHub.",
            variant: "destructive",
          });
        } finally {
          setIsHandlingCallback(false);
        }
      }
    };
    
    handleOAuthCallback();
  }, [toast]);
  
  // If user is already authenticated with GitHub, show the setup wizard
  if (isGitHubAuthenticated()) {
    return <GitHubSetupWizard onClose={onClose} />;
  }
  
  // Show loading state while handling OAuth callback
  if (isHandlingCallback) {
    return (
      <div className="flex flex-col items-center justify-center p-6 space-y-4">
        <h2 className="text-2xl font-bold">Connecting to GitHub...</h2>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p>Please wait while we complete the connection.</p>
      </div>
    );
  }
  
  // Otherwise, show the GitHub settings (login options)
  return <GitHubSettings onClose={onClose} />;
};

const GitHubSettings = ({ onClose }: { onClose: () => void }) => {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Connect to GitHub</DialogTitle>
          <DialogDescription>
            Connect your GitHub account to import repositories or create new ones.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Button onClick={initiateGitHubOAuth}>
            <svg
              className="mr-2 h-4 w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            Connect with GitHub
          </Button>
          <p className="text-sm text-gray-500 mt-2">
            We'll redirect you to GitHub to authorize this application.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const GitHubSetupWizard = ({ onClose }: { onClose: () => void }) => {
  const [step, setStep] = useState(1);
  const [repoType, setRepoType] = useState<"existing" | "new">("existing");
  const [repoName, setRepoName] = useState("");
  const [repoVisibility, setRepoVisibility] = useState<"public" | "private">("public");

  const handleNext = () => {
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleFinish = () => {
    // TODO: Implement repository setup logic
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>GitHub Repository Setup</DialogTitle>
          <DialogDescription>
            Configure your GitHub repository for this project.
          </DialogDescription>
        </DialogHeader>

        <Stepper value={step} className="mb-6">
          <Step>
            <StepTitle>Repository Type</StepTitle>
            <StepDescription>Choose repository type</StepDescription>
          </Step>
          <Step>
            <StepTitle>Repository Details</StepTitle>
            <StepDescription>Configure repository settings</StepDescription>
          </Step>
          <Step>
            <StepTitle>Confirmation</StepTitle>
            <StepDescription>Review and confirm</StepDescription>
          </Step>
        </Stepper>

        {step === 1 && (
          <div className="space-y-4">
            <Tabs
              defaultValue="existing"
              value={repoType}
              onValueChange={(value) => setRepoType(value as "existing" | "new")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing">Use Existing Repository</TabsTrigger>
                <TabsTrigger value="new">Create New Repository</TabsTrigger>
              </TabsList>
              <TabsContent value="existing" className="p-4 border rounded-md mt-2">
                <p className="text-sm text-gray-500 mb-4">
                  Select an existing repository from your GitHub account.
                </p>
                <div className="border rounded-md p-2 h-40 overflow-y-auto">
                  <p className="text-center text-gray-500 mt-12">
                    Repository list will appear here
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="new" className="p-4 border rounded-md mt-2">
                <p className="text-sm text-gray-500 mb-4">
                  Create a new repository on your GitHub account.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="repo-name">Repository Name</Label>
                    <Input
                      id="repo-name"
                      placeholder="my-awesome-project"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Visibility</Label>
                    <div className="flex space-x-4">
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="public"
                          name="visibility"
                          value="public"
                          checked={repoVisibility === "public"}
                          onChange={() => setRepoVisibility("public")}
                          className="mr-2"
                        />
                        <Label htmlFor="public">Public</Label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="private"
                          name="visibility"
                          value="private"
                          checked={repoVisibility === "private"}
                          onChange={() => setRepoVisibility("private")}
                          className="mr-2"
                        />
                        <Label htmlFor="private">Private</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            <div className="flex justify-end">
              <Button onClick={handleNext}>Next</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="border rounded-md p-4">
              <h3 className="font-medium mb-2">Repository Configuration</h3>
              <p className="text-sm text-gray-500 mb-4">
                Configure additional settings for your repository.
              </p>
              {/* Additional configuration options would go here */}
              <div className="text-center text-gray-500 py-4">
                Additional configuration options will appear here
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleNext}>Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="border rounded-md p-4">
              <h3 className="font-medium mb-2">Confirmation</h3>
              <p className="text-sm text-gray-500 mb-4">
                Review your repository settings before finalizing.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Repository Type:</span>
                  <span className="text-sm">
                    {repoType === "existing" ? "Existing Repository" : "New Repository"}
                  </span>
                </div>
                {repoType === "new" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Repository Name:</span>
                      <span className="text-sm">{repoName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Visibility:</span>
                      <span className="text-sm">
                        {repoVisibility === "public" ? "Public" : "Private"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleFinish}>Finish</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
