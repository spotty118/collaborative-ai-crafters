
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Github, ExternalLink, CheckCircle2 } from "lucide-react";
import { initiateGithubAuth, getCurrentGithubUser, GithubUser } from "@/lib/github";
import { toast } from "sonner";

interface GitHubSetupWizardProps {
  onComplete?: (user: GithubUser) => void;
  onCancel?: () => void;
}

const GitHubSetupWizard: React.FC<GitHubSetupWizardProps> = ({ 
  onComplete, 
  onCancel 
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [clientId, setClientId] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");
  
  // Check for OAuth callback on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    
    if (code) {
      setCurrentStep(3);
      handleOAuthCallback(code);
    }
  }, []);
  
  const handleOAuthCallback = async (code: string) => {
    setIsChecking(true);
    setError("");
    
    // Remove the code from the URL to prevent issues on refresh
    const newUrl = window.location.pathname + 
      (window.location.search ? window.location.search.replace(/[?&]code=[^&]+/, "") : "") + 
      window.location.hash;
    
    window.history.replaceState({}, document.title, newUrl);
    
    try {
      const success = await import("@/lib/github").then(module => 
        module.handleGithubCallback(code)
      );
      
      if (success) {
        const user = await getCurrentGithubUser();
        if (user && onComplete) {
          setCurrentStep(4);
          onComplete(user);
        } else {
          setError("Failed to get user information after authentication");
          setCurrentStep(1);
        }
      } else {
        setError("Authentication failed. Please try again.");
        setCurrentStep(1);
      }
    } catch (error) {
      setError(`Error during authentication: ${error instanceof Error ? error.message : "Unknown error"}`);
      setCurrentStep(1);
    } finally {
      setIsChecking(false);
    }
  };
  
  const handleStartSetup = () => {
    setCurrentStep(2);
  };
  
  const handleConnect = () => {
    if (!clientId.trim()) {
      setError("Please enter your GitHub OAuth client ID");
      return;
    }
    
    setError("");
    initiateGithubAuth(clientId);
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
          <Step value={1}>
            <StepTitle>Get Started</StepTitle>
            <StepDescription>Begin GitHub setup</StepDescription>
          </Step>
          <Step value={2}>
            <StepTitle>Client ID</StepTitle>
            <StepDescription>Enter GitHub OAuth ID</StepDescription>
          </Step>
          <Step value={3}>
            <StepTitle>Authorization</StepTitle>
            <StepDescription>Authorize the application</StepDescription>
          </Step>
          <Step value={4}>
            <StepTitle>Complete</StepTitle>
            <StepDescription>Setup finished</StepDescription>
          </Step>
        </Stepper>
        
        {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="font-medium text-lg">Welcome to GitHub Integration</h3>
            <p className="text-gray-600">
              This wizard will guide you through connecting your application to GitHub.
              You'll need to create a GitHub OAuth application to continue.
            </p>
            <div className="bg-gray-50 p-4 rounded-md border">
              <h4 className="font-medium mb-2">Before you begin:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Go to GitHub Developer Settings</li>
                <li>Create a new OAuth application</li>
                <li>Set the Homepage URL to: <code className="bg-gray-100 px-2 py-1 rounded">{window.location.origin}</code></li>
                <li>Set the Authorization callback URL to: <code className="bg-gray-100 px-2 py-1 rounded">{window.location.origin}</code></li>
                <li>Copy the Client ID (you'll need it in the next step)</li>
              </ol>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => window.open("https://github.com/settings/developers", "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open GitHub Settings
              </Button>
            </div>
          </div>
        )}
        
        {currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="font-medium text-lg">Enter GitHub OAuth Details</h3>
            <div className="space-y-2">
              <Label htmlFor="github-client-id">GitHub OAuth Client ID</Label>
              <Input
                id="github-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g., 1a2b3c4d5e6f7g8h9i0j"
              />
              <p className="text-xs text-gray-500">
                This is the Client ID from your GitHub OAuth application.
                Make sure you've set the correct Homepage URL and Authorization callback URL in your GitHub OAuth app settings.
              </p>
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
            <Button onClick={handleConnect} disabled={!clientId.trim()}>
              Connect to GitHub
            </Button>
          </>
        )}
        
        {currentStep === 3 && (
          <Button variant="outline" onClick={() => setCurrentStep(1)} disabled={isChecking}>
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
