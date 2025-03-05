
import React, { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Stepper, 
  Step, 
  StepDescription, 
  StepTitle 
} from "@/components/ui/stepper";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Github, ExternalLink, CheckCircle2 } from "lucide-react";
import { initiateGithubAuth, getCurrentGithubUser, GithubUser } from "@/lib/github";
import { useToast } from "@/hooks/use-toast";

interface GitHubSetupWizardProps {
  onComplete?: (user: GithubUser) => void;
  onCancel?: () => void;
}

const GitHubSetupWizard: React.FC<GitHubSetupWizardProps> = ({ 
  onComplete, 
  onCancel 
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  
  // Check for OAuth callback on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    
    if (code && state) {
      setCurrentStep(3);
      handleOAuthCallback(code, state);
    }
  }, []);
  
  const handleOAuthCallback = async (code: string, state: string) => {
    setIsChecking(true);
    setError("");
    
    // Remove the code from the URL to prevent issues on refresh
    const newUrl = window.location.pathname + 
      (window.location.search ? window.location.search.replace(/[?&]code=[^&]+/, "").replace(/[?&]state=[^&]+/, "") : "") + 
      window.location.hash;
    
    window.history.replaceState({}, document.title, newUrl);
    
    try {
      console.log("Processing GitHub OAuth callback...");
      const success = await import("@/lib/github").then(module => 
        module.handleGithubCallback(code, state)
      );
      
      if (success) {
        const user = await getCurrentGithubUser();
        if (user && onComplete) {
          setCurrentStep(4);
          onComplete(user);
          toast({
            title: "GitHub Connected",
            description: "Successfully connected your GitHub account",
          });
        } else {
          setError("Failed to get user information after authentication");
          setCurrentStep(1);
          toast({
            title: "Connection Failed",
            description: "Could not retrieve GitHub user information",
            variant: "destructive",
          });
        }
      } else {
        setError("Authentication failed");
        setCurrentStep(1);
        toast({
          title: "Authentication Failed",
          description: "GitHub authentication was unsuccessful",
          variant: "destructive",
        });
      }
    } catch (error) {
      setError(`Error during authentication: ${error instanceof Error ? error.message : "Unknown error"}`);
      setCurrentStep(1);
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };
  
  const handleStartSetup = () => {
    setCurrentStep(2);
  };
  
  const handleConnect = () => {
    setError("");
    initiateGithubAuth();
  };
  
  return (
    <Card className="w-full max-w-xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Github size={20} />
          GitHub Integration Setup
        </CardTitle>
        <CardDescription>
          Follow these steps to connect your project with GitHub
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <Stepper value={currentStep} className="mb-6">
          <Step>
            <StepTitle>Get Started</StepTitle>
            <StepDescription>Begin GitHub setup</StepDescription>
          </Step>
          <Step>
            <StepTitle>Connect</StepTitle>
            <StepDescription>Connect to GitHub</StepDescription>
          </Step>
          <Step>
            <StepTitle>Authorization</StepTitle>
            <StepDescription>Authorize the application</StepDescription>
          </Step>
          <Step>
            <StepTitle>Complete</StepTitle>
            <StepDescription>Setup finished</StepDescription>
          </Step>
        </Stepper>
        
        {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="font-medium text-lg">Welcome to GitHub Integration</h3>
            <p className="text-gray-600">
              This wizard will guide you through connecting your application to GitHub.
              You'll need a GitHub account to continue.
            </p>
            <div className="bg-gray-50 p-4 rounded-md border">
              <h4 className="font-medium mb-2">Before you begin:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Make sure you have a GitHub account</li>
                <li>Ensure you have permissions to create repositories</li>
                <li>Be prepared to authorize this application to access your GitHub account</li>
              </ol>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => window.open("https://github.com", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open GitHub
              </Button>
            </div>
          </div>
        )}
        
        {currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="font-medium text-lg">Connect to GitHub</h3>
            <p className="text-gray-600">
              Click the button below to connect to GitHub. You'll be redirected to GitHub's website
              to authorize this application.
            </p>
            <div className="bg-gray-50 p-4 rounded-md border">
              <p className="text-sm">
                This application will request:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                <li>Read/write access to your repositories</li>
                <li>Basic profile information</li>
              </ul>
            </div>
          </div>
        )}
        
        {currentStep === 3 && (
          <div className="space-y-4 text-center">
            <div className="inline-block h-8 w-8 border-4 border-t-primary rounded-full animate-spin mx-auto"></div>
            <h3 className="font-medium text-lg">Authorizing with GitHub</h3>
            <p className="text-gray-600">
              Please wait while we complete the GitHub authorization process...
            </p>
          </div>
        )}
        
        {currentStep === 4 && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h3 className="font-medium text-lg">Setup Complete!</h3>
            <p className="text-gray-600">
              Your application is now successfully connected to GitHub.
              You can now push your projects directly to GitHub repositories.
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        {currentStep === 1 && (
          <>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleStartSetup}>
              Start Setup
            </Button>
          </>
        )}
        
        {currentStep === 2 && (
          <>
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              Back
            </Button>
            <Button onClick={handleConnect}>
              Connect to GitHub
            </Button>
          </>
        )}
        
        {currentStep === 3 && (
          <Button variant="outline" onClick={() => setCurrentStep(1)} disabled={isChecking} className="ml-auto">
            Cancel
          </Button>
        )}
        
        {currentStep === 4 && (
          <Button onClick={onCancel} className="ml-auto">
            Close
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default GitHubSetupWizard;
