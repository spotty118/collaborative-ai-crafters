import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GitHubIntegrationDialog } from "@/components/github/GitHubIntegrationDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Stepper, Step, StepTitle, StepDescription } from "@/components/ui/stepper";
import { useToast } from "@/hooks/use-toast"
import { createProject, createAgents, getAgents, updateAgent } from "@/lib/api";
import { ProjectDB, Agent } from "@/lib/types";

const Index = () => {
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectRequirements, setProjectRequirements] = useState('');
  const [techStack, setTechStack] = useState<string[]>([]);
  const [sourceType, setSourceType] = useState<'new' | 'existing'>('new');
  const [sourceUrl, setSourceUrl] = useState('');
  const [projectCreated, setProjectCreated] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [isGitHubDialogOpen, setIsGitHubDialogOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();
  const { toast } = useToast()

  const handleTechStackChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value);
    setTechStack(selectedOptions);
  };

  const handleCreateProject = async () => {
    if (!projectName) {
      toast({
        title: "Error",
        description: "Project name is required.",
        variant: "destructive",
      });
      return;
    }

    const newProject: ProjectDB = {
      name: projectName,
      description: projectDescription,
      requirements: projectRequirements,
      tech_stack: techStack,
      source_type: sourceType === 'existing' ? 'github' : null,
      source_url: sourceType === 'existing' ? sourceUrl : null,
      status: 'pending',
      progress: 0,
    };

    try {
      const project = await createProject(newProject);
      setProjectId(project.id);
      setProjectCreated(true);
      setCurrentStep(2);

      // Create default agents for the project
      await createAgents(project.id);

      toast({
        title: "Project Created",
        description: "Your project has been created successfully.",
      });
    } catch (error: any) {
      console.error("Error creating project:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create project.",
        variant: "destructive",
      });
    }
  };

  const executeAgentTasks = async (project_id: string) => {
    // Make sure we're using the API updateAgent function, not a local undefined variable
    const agents = await getAgents(project_id);
    
    // Update the architect agent to working state
    if (agents.length > 0) {
      const architectAgent = agents.find(agent => agent.type === 'architect');
      if (architectAgent) {
        await updateAgent(architectAgent.id, {
          status: 'working',
          progress: 10
        });
      }
    }

    toast({
      title: "Generating Tasks",
      description: "AI agents are now generating tasks for your project.",
    });

    // Optimistically update the UI
    // setAgents(prevAgents => {
    //   return prevAgents.map(agent => {
    //     if (agent.type === 'architect') {
    //       return { ...agent, status: 'working', progress: 10 };
    //     }
    //     return agent;
    //   });
    // });

    try {
      // const response = await fetch('/functions/v1/openrouter', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     prompt: `Based on the project requirements, tech stack, and source code (if available), list the tasks that need to be done to build this project.`,
      //     agentType: 'architect',
      //     projectContext: {
      //       requirements: projectRequirements,
      //       tech_stack: techStack,
      //       source_url: sourceUrl
      //     }
      //   }),
      // });

      // if (!response.ok) {
      //   const errorData = await response.text();
      //   console.error('OpenRouter API error:', errorData);
      //   toast({
      //     title: "Error",
      //     description: `OpenRouter API error: ${errorData}`,
      //     variant: "destructive",
      //   });
      //   return;
      // }

      // const data = await response.json();
      // console.log('OpenRouter response:', data);

      // toast({
      //   title: "Tasks Generated",
      //   description: "AI agents have generated tasks for your project.",
      // });
    } catch (error: any) {
      console.error("Error generating tasks:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate tasks.",
        variant: "destructive",
      });
    } finally {
      // setAgents(prevAgents => {
      //   return prevAgents.map(agent => {
      //     if (agent.type === 'architect') {
      //       return { ...agent, status: 'idle', progress: 100 };
      //     }
      //     return agent;
      //   });
      // });
    }
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Create a New Project</CardTitle>
          <CardDescription>
            Let's get started by setting up your project details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Stepper value={currentStep}>
            <Step index={1} active={currentStep === 1} completed={currentStep > 1}>
              <StepTitle>Project Details</StepTitle>
              <StepDescription>Basic information about your project</StepDescription>
            </Step>
            <Step index={2} active={currentStep === 2} completed={currentStep > 2}>
              <StepTitle>AI Configuration</StepTitle>
              <StepDescription>Configure AI agents for your project</StepDescription>
            </Step>
            <Step index={3} active={currentStep === 3} completed={currentStep > 3}>
              <StepTitle>Review & Launch</StepTitle>
              <StepDescription>Finalize and launch your project</StepDescription>
            </Step>
          </Stepper>

          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  placeholder="My Awesome Project"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="description">Project Description</Label>
                <Textarea
                  id="description"
                  placeholder="A brief description of your project"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="requirements">Project Requirements</Label>
                <Textarea
                  id="requirements"
                  placeholder="List the detailed requirements for your project"
                  value={projectRequirements}
                  onChange={(e) => setProjectRequirements(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="techStack">Tech Stack</Label>
                <Select multiple onValueChange={(value) => setTechStack(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select tech stack" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="react">React</SelectItem>
                    <SelectItem value="typescript">TypeScript</SelectItem>
                    <SelectItem value="nodejs">Node.js</SelectItem>
                    <SelectItem value="express">Express</SelectItem>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                    <SelectItem value="mongodb">MongoDB</SelectItem>
                    <SelectItem value="tailwindcss">Tailwind CSS</SelectItem>
                    <SelectItem value="nextjs">Next.js</SelectItem>
                    <SelectItem value="vuejs">Vue.js</SelectItem>
                    <SelectItem value="angular">Angular</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="django">Django</SelectItem>
                    <SelectItem value="flask">Flask</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                    <SelectItem value="spring">Spring</SelectItem>
                    <SelectItem value="docker">Docker</SelectItem>
                    <SelectItem value="kubernetes">Kubernetes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source Type</Label>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <Input
                      type="radio"
                      id="new"
                      name="sourceType"
                      value="new"
                      checked={sourceType === 'new'}
                      onChange={() => setSourceType('new')}
                      className="mr-2"
                    />
                    <Label htmlFor="new">New Project</Label>
                  </div>
                  <div className="flex items-center">
                    <Input
                      type="radio"
                      id="existing"
                      name="sourceType"
                      value="existing"
                      checked={sourceType === 'existing'}
                      onChange={() => setSourceType('existing')}
                      className="mr-2"
                    />
                    <Label htmlFor="existing">Existing Repository</Label>
                  </div>
                </div>
              </div>
              {sourceType === 'existing' && (
                <div>
                  <Label htmlFor="sourceUrl">Repository URL</Label>
                  <Input
                    id="sourceUrl"
                    placeholder="https://github.com/username/repo"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                  />
                </div>
              )}
              <Button onClick={handleCreateProject}>
                Create Project
              </Button>
            </div>
          )}

          {projectCreated && (
            <div className="mt-8 p-6 bg-white rounded-lg shadow-md dark:bg-gray-900">
              <h2 className="text-2xl font-bold mb-4">Project Created Successfully!</h2>
              <p className="mb-4">Your project has been set up. Here's what happens next:</p>
              <ol className="list-decimal pl-5 space-y-2 mb-6">
                <li>
                  <strong>Initial Analysis:</strong> Our AI agents are analyzing your project requirements and, if provided, your existing repository.
                </li>
                <li>
                  <strong>Task Generation:</strong> Based on the analysis, the AI agents will generate a list of tasks to be completed.
                </li>
                <li>
                  <strong>Task Assignment:</strong> Tasks will be assigned to the appropriate AI agents based on their expertise.
                </li>
                <li>
                  <strong>Development:</strong> The AI agents will start working on the tasks, generating code and making changes to your project.
                </li>
                <li>
                  <strong>Testing:</strong> The AI agents will run tests to ensure the quality of the code.
                </li>
                <li>
                  <strong>Deployment:</strong> Once all tasks are completed and tested, your project will be deployed.
                </li>
              </ol>
              <div className="flex space-x-4">
                <Button onClick={() => navigate(`/project/${projectId.toString()}`)}>
                  View Project Dashboard
                </Button>
                <Button
                  variant="outline"
                  onClick={() => executeAgentTasks(projectId.toString())}
                >
                  Generate Tasks with AI
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" onClick={() => setIsGitHubDialogOpen(true)}>
            Connect GitHub
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Connect to GitHub</AlertDialogTitle>
            <AlertDialogDescription>
              Connecting to GitHub will allow us to access your repositories and
              help you manage your projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <GitHubIntegrationDialog onClose={() => setIsGitHubDialogOpen(false)} />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsGitHubDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
