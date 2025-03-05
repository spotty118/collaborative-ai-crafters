import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/Header";
import Dashboard from "@/components/layout/Dashboard";
import ProjectSetup from "@/components/layout/ProjectSetup";
import GitHubIntegrationDialog from "@/components/github/GitHubIntegrationDialog";
import AutoGitHubSetup from "@/components/github/AutoGitHubSetup";
import { Agent, Task, Message, Project, MessageDB, TaskDB } from "@/lib/types";
import { toast } from "sonner";
import { 
  getProjects, 
  createProject, 
  createAgents,
  getAgents, 
  updateAgent, 
  getTasks, 
  getMessages, 
  createMessage,
  updateTask
} from "@/lib/api";
import { sendAgentPrompt } from "@/lib/openrouter";
import { getCurrentGithubUser } from "@/lib/github";

const Index = () => {
  const queryClient = useQueryClient();
  const [isProjectSetupOpen, setIsProjectSetupOpen] = useState(false);
  const [isGithubDialogOpen, setIsGithubDialogOpen] = useState(false);
  const [isGithubSetupOpen, setIsGithubSetupOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [isGithubConnected, setIsGithubConnected] = useState(false);

  useEffect(() => {
    checkGithubConnection();
  }, []);

  const checkGithubConnection = async () => {
    const user = await getCurrentGithubUser();
    setIsGithubConnected(!!user);
  };

  const { 
    data: projects = [],
    isLoading: loadingProjects,
    error: projectsError 
  } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects
  });

  useEffect(() => {
    if (projects.length > 0 && !activeProject) {
      setActiveProject(projects[0]);
    }
  }, [projects, activeProject]);

  const { 
    data: agents = [], 
    isLoading: loadingAgents 
  } = useQuery({
    queryKey: ['agents', activeProject?.id],
    queryFn: () => activeProject ? getAgents(activeProject.id.toString()) : Promise.resolve([]),
    enabled: !!activeProject
  });

  const { 
    data: tasks = [], 
    isLoading: loadingTasks 
  } = useQuery({
    queryKey: ['tasks', activeProject?.id],
    queryFn: () => activeProject ? getTasks(activeProject.id.toString()) : Promise.resolve([]),
    enabled: !!activeProject
  });

  const { 
    data: messages = [], 
    isLoading: loadingMessages 
  } = useQuery({
    queryKey: ['messages', activeProject?.id, activeChat],
    queryFn: () => activeProject ? getMessages(activeProject.id.toString()) : Promise.resolve([]),
    enabled: !!activeProject
  });

  const createProjectMutation = useMutation({
    mutationFn: async (projectData: {
      name: string;
      description: string;
      tech_stack: string[];
      source_type?: string;
      source_url?: string;
    }) => {
      const newProject = await createProject({
        ...projectData,
        status: 'setup',
        progress: 0
      });

      await createAgents(newProject.id);

      return newProject;
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setActiveProject(newProject);
      toast.success(`Project "${newProject.name}" has been created`);
    },
    onError: (error) => {
      console.error("Error creating project:", error);
      toast.error("Failed to create project. Please try again.");
    }
  });

  const updateAgentMutation = useMutation({
    mutationFn: (variables: { id: string } & Partial<Agent>) => {
      return updateAgent(variables.id, variables);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeProject?.id] });
    }
  });

  const createMessageMutation = useMutation({
    mutationFn: (messageData: MessageDB) => {
      return createMessage(messageData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', activeProject?.id] });
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: (variables: { id: string } & Partial<TaskDB>) => {
      return updateTask(variables.id, variables);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', activeProject?.id] });
    }
  });

  const handleStartAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || !activeProject) return;
    
    updateAgentMutation.mutate({ 
      id: agentId, 
      status: "working", 
      progress: 10 
    });
    
    toast.success(`${agent.name} started working`);

    if (activeProject.source_url && activeProject.source_url.includes('github.com')) {
      const analysisToast = toast.loading(`${agent.name} is analyzing your GitHub repository...`);
      
      import('@/lib/openrouter').then(module => {
        module.analyzeGitHubAndCreateTasks(agent, activeProject)
          .then(success => {
            toast.dismiss(analysisToast);
            
            if (success) {
              toast.success(`${agent.name} has analyzed your GitHub repo and created tasks`);
              queryClient.invalidateQueries({ queryKey: ['tasks', activeProject.id] });
            } else {
              toast.error(`${agent.name} encountered an issue analyzing your GitHub repo`);
            }
          })
          .catch(error => {
            console.error('Error during GitHub analysis:', error);
            toast.dismiss(analysisToast);
            toast.error(`Failed to analyze GitHub repository: ${error.message}`);
          });
      });
    }
    
    const agentTasks = tasks.filter(task => 
      task.assigned_to === agentId && task.status === 'pending'
    );
    
    if (agentTasks.length > 0) {
      const executionToast = toast.loading(`${agent?.name} is starting to work on ${agentTasks.length} pending tasks...`);
      
      executeAgentTasks(agent as Agent, agentTasks, executionToast);
    }
    
    let progress = 10;
    const interval = setInterval(() => {
      progress += 10;
      
      if (progress >= 100) {
        updateAgentMutation.mutate({ 
          id: agentId, 
          status: "completed", 
          progress: 100 
        });
        clearInterval(interval);
      } else {
        updateAgentMutation.mutate({ 
          id: agentId, 
          progress 
        });
      }
    }, 2000);
  };

  const executeAgentTasks = async (agent: Agent, tasks: Task[], toastId: string) => {
    if (!activeProject || tasks.length === 0) {
      toast.dismiss(toastId);
      return;
    }

    const currentTask = tasks[0];
    const remainingTasks = tasks.slice(1);
    
    updateTaskMutation.mutate({ 
      id: currentTask.id, 
      status: 'in_progress' 
    });
    
    toast.dismiss(toastId);
    const taskToast = toast.loading(`${agent.name} is working on task: ${currentTask.title}`);
    
    try {
      const taskPrompt = `Execute this task: ${currentTask.title}. ${currentTask.description || ''} Provide a detailed solution and implementation steps.`;
      
      const response = await sendAgentPrompt(agent, taskPrompt, activeProject);
      
      createMessageMutation.mutate({
        project_id: activeProject.id.toString(), // Convert to string explicitly
        content: `Completed task: ${currentTask.title}\n\n${response}`,
        sender: agent.name,
        type: "text"
      });
      
      updateTaskMutation.mutate({ 
        id: currentTask.id, 
        status: 'completed' 
      });
      
      toast.dismiss(taskToast);
      toast.success(`${agent.name} completed task: ${currentTask.title}`);
      
      if (remainingTasks.length > 0) {
        setTimeout(() => {
          executeAgentTasks(agent, remainingTasks, toast.loading(`${agent.name} is continuing with next task...`));
        }, 1000);
      }
    } catch (error) {
      console.error('Error executing task:', error);
      
      updateTaskMutation.mutate({ 
        id: currentTask.id, 
        status: 'failed' 
      });
      
      toast.dismiss(taskToast);
      toast.error(`${agent.name} failed to complete task: ${currentTask.title}`);
      
      createMessageMutation.mutate({
        project_id: activeProject.id.toString(), // Convert to string explicitly
        content: `Failed to complete task: ${currentTask.title}\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: agent.name,
        type: "text"
      });
    }
  };

  const handleStopAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    
    updateAgentMutation.mutate({ 
      id: agentId, 
      status: "idle"
    });
    
    toast.info(`${agent.name} has been paused`);
  };

  const handleChatWithAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    
    setActiveChat(agentId);
    toast.info(`Chat activated with ${agent.name}`);
  };

  const handleSendMessage = async (message: string) => {
    if (!activeProject || !message.trim() || !activeChat) return;
    
    const agent = agents.find(a => a.id === activeChat);
    if (!agent) return;
    
    createMessageMutation.mutate({
      project_id: activeProject.id.toString(), // Convert to string explicitly
      content: message,
      sender: "You",
      type: "text"
    });

    const loadingToastId = toast.loading(`${agent.name} is thinking...`);
    
    try {
      const response = await sendAgentPrompt(agent, message, activeProject);
      
      createMessageMutation.mutate({
        project_id: activeProject.id.toString(), // Convert to string explicitly
        content: response,
        sender: agent.name,
        type: "text"
      });
      
      toast.dismiss(loadingToastId);
    } catch (error) {
      console.error('Error getting response from agent:', error);
      
      createMessageMutation.mutate({
        project_id: activeProject.id.toString(), // Convert to string explicitly
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: agent.name,
        type: "text"
      });
      
      toast.dismiss(loadingToastId);
      toast.error("Failed to get response from agent.");
    }
  };

  const handleCreateProject = (projectData: {
    name: string;
    description: string;
    mode: string;
    techStack: {
      frontend: string;
      backend: string;
      database: string;
      deployment: string;
    };
    repoUrl?: string;
  }) => {
    const tech_stack = [
      projectData.techStack.frontend,
      projectData.techStack.backend,
      projectData.techStack.database,
      projectData.techStack.deployment
    ];
    
    createProjectMutation.mutate({
      name: projectData.name,
      description: projectData.description,
      tech_stack,
      source_type: projectData.mode === 'existing' ? 'git' : undefined,
      source_url: projectData.repoUrl
    });
    
    setIsProjectSetupOpen(false);
  };

  const handleOpenGithubDialog = () => {
    setIsGithubDialogOpen(true);
  };

  if (loadingProjects && !projectsError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 border-4 border-t-primary rounded-full animate-spin mb-4"></div>
          <p>Loading your projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header
        onNewProject={() => setIsProjectSetupOpen(true)}
        onImportProject={() => setIsProjectSetupOpen(true)}
        onGithubPush={activeProject ? handleOpenGithubDialog : undefined}
        hasActiveProject={!!activeProject}
      />
      
      {activeProject ? (
        <Dashboard
          agents={agents}
          tasks={tasks}
          messages={messages}
          onStartAgent={handleStartAgent}
          onStopAgent={handleStopAgent}
          onChatWithAgent={handleChatWithAgent}
          onSendMessage={handleSendMessage}
          activeChat={activeChat}
          project={{
            name: activeProject.name,
            description: activeProject.description,
            mode: activeProject.source_type ? 'existing' : 'new'
          }}
          isLoading={{
            agents: loadingAgents,
            tasks: loadingTasks,
            messages: loadingMessages
          }}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center p-8 bg-gray-50 rounded-lg border">
            <h2 className="text-xl font-semibold mb-4">Welcome to the Agentic Development Platform</h2>
            <p className="mb-6 text-gray-600">
              Get started by creating a new project or importing an existing one.
            </p>
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => setIsProjectSetupOpen(true)}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                Create New Project
              </button>
            </div>
          </div>
        </div>
      )}
      
      <ProjectSetup
        isOpen={isProjectSetupOpen}
        onClose={() => setIsProjectSetupOpen(false)}
        onCreateProject={handleCreateProject}
      />
      
      <GitHubIntegrationDialog
        isOpen={isGithubDialogOpen}
        onClose={() => setIsGithubDialogOpen(false)}
        project={activeProject}
      />
    </div>
  );
};

export default Index;
