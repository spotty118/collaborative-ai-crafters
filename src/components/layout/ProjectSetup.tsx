
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectMode } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProjectSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectData: {
    name: string;
    description: string;
    mode: ProjectMode;
    techStack: {
      frontend: string;
      backend: string;
      database: string;
      deployment: string;
    };
    repoUrl?: string;
  }) => void;
}

const ProjectSetup: React.FC<ProjectSetupProps> = ({
  isOpen,
  onClose,
  onCreateProject,
}) => {
  const [projectMode, setProjectMode] = useState<ProjectMode>("new");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [frontend, setFrontend] = useState("react");
  const [backend, setBackend] = useState("node");
  const [database, setDatabase] = useState("supabase");
  const [deployment, setDeployment] = useState("vercel");
  const [validationError, setValidationError] = useState("");

  const validateGithubUrl = (url: string): boolean => {
    // Simple GitHub URL validation
    const githubRegex = /^https:\/\/github\.com\/[\w-]+\/[\w-]+/;
    return githubRegex.test(url);
  };

  const handleCreateProject = () => {
    if (!name) return;
    
    // Validate GitHub URL when in existing project mode
    if (projectMode === "existing" && repoUrl) {
      if (!validateGithubUrl(repoUrl)) {
        setValidationError("Please enter a valid GitHub repository URL (https://github.com/username/repository)");
        return;
      }
    }
    
    setValidationError("");
    
    onCreateProject({
      name,
      description,
      mode: projectMode,
      techStack: {
        frontend,
        backend,
        database,
        deployment,
      },
      repoUrl: projectMode === "existing" ? repoUrl : undefined,
    });
    
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setRepoUrl("");
    setProjectMode("new");
    setFrontend("react");
    setBackend("node");
    setDatabase("supabase");
    setDeployment("vercel");
    setValidationError("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Create a new project</DialogTitle>
          <DialogDescription>
            Configure your project details and preferences
          </DialogDescription>
        </DialogHeader>

        {validationError && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        <Tabs value={projectMode} onValueChange={(v) => setProjectMode(v as ProjectMode)} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">New Project</TabsTrigger>
            <TabsTrigger value="existing">Existing Project</TabsTrigger>
          </TabsList>
          
          <TabsContent value="new" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                placeholder="My Awesome Project"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                placeholder="A brief description of your project"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="frontend">Frontend</Label>
                <Select value={frontend} onValueChange={setFrontend}>
                  <SelectTrigger id="frontend">
                    <SelectValue placeholder="Select frontend" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="react">React</SelectItem>
                    <SelectItem value="vue">Vue</SelectItem>
                    <SelectItem value="angular">Angular</SelectItem>
                    <SelectItem value="svelte">Svelte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="backend">Backend</Label>
                <Select value={backend} onValueChange={setBackend}>
                  <SelectTrigger id="backend">
                    <SelectValue placeholder="Select backend" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="node">Node.js</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                    <SelectItem value="go">Go</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="database">Database</Label>
                <Select value={database} onValueChange={setDatabase}>
                  <SelectTrigger id="database">
                    <SelectValue placeholder="Select database" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supabase">Supabase</SelectItem>
                    <SelectItem value="mongodb">MongoDB</SelectItem>
                    <SelectItem value="postgres">PostgreSQL</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="deployment">Deployment</Label>
                <Select value={deployment} onValueChange={setDeployment}>
                  <SelectTrigger id="deployment">
                    <SelectValue placeholder="Select deployment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vercel">Vercel</SelectItem>
                    <SelectItem value="netlify">Netlify</SelectItem>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="gcp">Google Cloud</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="existing" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name-existing">Project Name</Label>
              <Input
                id="project-name-existing"
                placeholder="My Existing Project"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="project-description-existing">Description</Label>
              <Textarea
                id="project-description-existing"
                placeholder="A brief description of your existing project"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="repo-url">GitHub Repository URL</Label>
              <Input
                id="repo-url"
                placeholder="https://github.com/username/repository"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Our agents will analyze your GitHub repository and suggest improvements
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreateProject} disabled={!name}>
            {projectMode === "new" ? "Create Project" : "Import Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectSetup;
