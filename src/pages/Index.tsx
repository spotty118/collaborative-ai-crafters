import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/Header";
import { useNavigate } from "react-router-dom";
import { createProject, getProjects, deleteProject } from "@/lib/api";
import ProjectSetup from "@/components/layout/ProjectSetup";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash, Eye, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Project, Agent, AgentType } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { sendAgentPrompt } from "@/lib/openrouter";
import { createMessage } from "@/lib/api";

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDelete }) => {
  const navigate = useNavigate();

  return (
    <Card className="bg-white shadow-md rounded-lg overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{project.name}</CardTitle>
        <CardDescription className="text-gray-500">
          {project.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">
            {project.sourceType ? "Existing Repo" : "New Project"}
          </Badge>
          {project.tech_stack && (
            <Badge className="bg-blue-100 text-blue-800">
              {project.tech_stack.join(", ")}
            </Badge>
          )}
        </div>
        <div className="mt-2 text-sm text-gray-600">
          Updated{" "}
          {project.updated_at &&
            formatDistanceToNow(new Date(project.updated_at), {
              addSuffix: true,
            })}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center p-4">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/project/${project.id}`)}
          >
            <Eye className="h-4 w-4 mr-2" />
            View
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              // Logic to edit project
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your
                project and remove all of its data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  onDelete(project.id);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
};

const Index: React.FC = () => {
  const [isProjectSetupOpen, setIsProjectSetupOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentType | null>(null);
  const [chatMessages, setChatMessages] = useState<
    { sender: string; content: string }[]
  >([]);
  const [messageInput, setMessageInput] = useState("");
  const [activeTab, setActiveTab] = useState("projects");
  const navigate = useNavigate();

  const queryClient = useQueryClient();

  // Fetch projects
  const {
    data: projects,
    isLoading,
    error,
  } = useQuery<Project[]>("projects", getProjects);

  // Mutation for creating a project
  const createProjectMutation = useMutation(createProject, {
    onSuccess: () => {
      queryClient.invalidateQueries("projects");
      setIsProjectSetupOpen(false);
      toast.success("Project created successfully!");
    },
    onError: (error: any) => {
      toast.error(`Failed to create project: ${error.message}`);
    },
  });

  // Mutation for deleting a project
  const deleteProjectMutation = useMutation(deleteProject, {
    onSuccess: () => {
      queryClient.invalidateQueries("projects");
      toast.success("Project deleted successfully!");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete project: ${error.message}`);
    },
  });

  // Function to handle project creation
  const handleCreateProject = async (projectData: Omit<Project, "id">) => {
    createProjectMutation.mutate(projectData);
  };

  // Function to handle project deletion
  const handleDeleteProject = async (id: string) => {
    deleteProjectMutation.mutate(id);
  };

  // Function to handle tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // Function to execute a set of tasks for the selected agent
  const executeAgentTasks = async (
    agent: AgentType,
    activeProject: Project
  ) => {
    if (!activeProject) return;

    // Initial message from agent
    createMessage({
      project_id: activeProject.id.toString(),
      sender: `${agent.charAt(0).toUpperCase() + agent.slice(1)} Agent`,
      content: "I'm now analyzing the project and will help improve it. This might take a moment...",
      type: "text",
    });

    const loadingToastId = toast.loading(`${agent} agent is analyzing the project...`);

    try {
      // Get agent response
      const response = await sendAgentPrompt(
        {
          id: `${agent}-agent`,
          name: `${agent.charAt(0).toUpperCase() + agent.slice(1)} Agent`,
          type: agent,
        },
        "Analyze this project and create tasks for improvements",
        activeProject
      );

      // Create completion message
      createMessage({
        project_id: activeProject.id.toString(),
        sender: `${agent.charAt(0).toUpperCase() + agent.slice(1)} Agent`,
        content: "I've analyzed the GitHub repository and created tasks for improvements. Check the task list for details.",
        type: "text",
      });

      toast.dismiss(loadingToastId);
      toast.success(`${agent.charAt(0).toUpperCase() + agent.slice(1)} agent completed analysis`);
    } catch (error) {
      toast.dismiss(loadingToastId);
      toast.error(`Error with ${agent} agent: ${error instanceof Error ? error.message : "Unknown error"}`);
      console.error(`Error with ${agent} agent:`, error);
    }
  };

  // Handle agent selection
  const handleAgentSelect = (agent: AgentType) => {
    setSelectedAgent(agent);
    if (activeProject) {
      executeAgentTasks(agent, activeProject);
    }
  };

  // Handle sending a message to an agent
  const handleSendMessage = async (message: string) => {
    if (!activeProject || !selectedAgent) return;
    
    // Add user message to the chat
    createMessage({
      project_id: activeProject.id.toString(),
      sender: "You",
      content: message,
      type: "text",
    });
    
    const agentName = `${selectedAgent.charAt(0).toUpperCase() + selectedAgent.slice(1)} Agent`;
    const loadingToastId = toast.loading(`${agentName} is thinking...`);
    
    try {
      // Get agent response
      const response = await sendAgentPrompt(
        {
          id: `${selectedAgent}-agent`,
          name: agentName,
          type: selectedAgent as AgentType,
        },
        message,
        activeProject
      );
      
      // Add agent response to the chat
      createMessage({
        project_id: activeProject.id.toString(),
        sender: agentName,
        content: response || "I couldn't generate a response at this time.",
        type: "text",
      });
      
      toast.dismiss(loadingToastId);
    } catch (error) {
      toast.dismiss(loadingToastId);
      toast.error(`Error getting response: ${error instanceof Error ? error.message : "Unknown error"}`);
      console.error("Error getting agent response:", error);
      
      // Add error message to the chat
      createMessage({
        project_id: activeProject.id.toString(),
        sender: agentName,
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
        type: "text",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header
        onNewProject={() => setIsProjectSetupOpen(true)}
        onImportProject={() => setIsProjectSetupOpen(true)}
      />

      <ProjectSetup
        open={isProjectSetupOpen}
        onClose={() => setIsProjectSetupOpen(false)}
        onCreate={handleCreateProject}
      />

      <div className="container mx-auto mt-8">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-white rounded-md shadow-sm p-2">
            <TabsTrigger value="projects" className="data-[state=active]:bg-gray-200">
              Projects
            </TabsTrigger>
            <TabsTrigger value="agents" className="data-[state=active]:bg-gray-200">
              Agents
            </TabsTrigger>
          </TabsList>
          <TabsContent value="projects" className="mt-4">
            {isLoading ? (
              <div className="text-center">Loading projects...</div>
            ) : error ? (
              <div className="text-center text-red-500">
                Error: {error.message}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects?.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDelete={handleDeleteProject}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="agents" className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {["architect", "frontend", "backend", "testing"].map(
                (agent) => (
                  <Card
                    key={agent}
                    className="cursor-pointer hover:shadow-md transition-shadow duration-300 ease-in-out"
                    onClick={() => handleAgentSelect(agent as AgentType)}
                  >
                    <CardHeader>
                      <CardTitle>
                        {agent.charAt(0).toUpperCase() + agent.slice(1)} Agent
                      </CardTitle>
                      <CardDescription>
                        {`The ${agent} agent is responsible for ${agent} tasks.`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-500">
                        Click to activate this agent.
                      </p>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
