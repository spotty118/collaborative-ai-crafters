
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/Header";
import Dashboard from "@/components/layout/Dashboard";
import ProjectSetup from "@/components/layout/ProjectSetup";
import { Agent, Task, Message, Project } from "@/lib/types";
import { toast } from "sonner";
import { 
  getProjects, 
  createProject, 
  createAgents,
  getAgents, 
  updateAgent, 
  getTasks, 
  getMessages, 
  createMessage 
} from "@/lib/api";

const Index = () => {
  const queryClient = useQueryClient();
  const [isProjectSetupOpen, setIsProjectSetupOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeChat, setActiveChat] = useState<string | null>(null);

  // Fetch all projects
  const { 
    data: projects = [],
    isLoading: loadingProjects,
    error: projectsError 
  } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects
  });

  // Set first project as active when projects are loaded
  useEffect(() => {
    if (projects.length > 0 && !activeProject) {
      setActiveProject(projects[0]);
    }
  }, [projects, activeProject]);

  // Fetch project data
  const { 
    data: agents = [], 
    isLoading: loadingAgents 
  } = useQuery({
    queryKey: ['agents', activeProject?.id],
    queryFn: () => activeProject ? getAgents(activeProject.id) : Promise.resolve([]),
    enabled: !!activeProject
  });

  const { 
    data: tasks = [], 
    isLoading: loadingTasks 
  } = useQuery({
    queryKey: ['tasks', activeProject?.id],
    queryFn: () => activeProject ? getTasks(activeProject.id) : Promise.resolve([]),
    enabled: !!activeProject
  });

  const { 
    data: messages = [], 
    isLoading: loadingMessages 
  } = useQuery({
    queryKey: ['messages', activeProject?.id, activeChat],
    queryFn: () => activeProject ? getMessages(activeProject.id) : Promise.resolve([]),
    enabled: !!activeProject
  });

  // Mutations
  const createProjectMutation = useMutation({
    mutationFn: async (projectData: {
      name: string;
      description: string;
      tech_stack: string[];
      source_type?: string;
      source_url?: string;
    }) => {
      // Create the project
      const newProject = await createProject({
        ...projectData,
        status: 'setup',
        progress: 0,
        created_at: new Date(),
        updated_at: new Date()
      });

      // Create default agents for the project
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
    mutationFn: updateAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeProject?.id] });
    }
  });

  const createMessageMutation = useMutation({
    mutationFn: createMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', activeProject?.id] });
    }
  });

  // Handler functions
  const handleStartAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    
    updateAgentMutation.mutate({ 
      id: agentId, 
      status: "working", 
      progress: 10 
    });
    
    toast.success(`${agent.name} started working`);
    
    // For demo: simulate progress updates
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

  const handleSendMessage = (message: string) => {
    if (!activeProject || !message.trim() || !activeChat) return;
    
    const agent = agents.find(a => a.id === activeChat);
    if (!agent) return;
    
    // Send user message
    createMessageMutation.mutate({
      project_id: activeProject.id,
      content: message,
      sender: "You",
      type: "text",
      created_at: new Date()
    });
    
    // Simulate agent response after a short delay
    setTimeout(() => {
      createMessageMutation.mutate({
        project_id: activeProject.id,
        content: `I'm analyzing your request: "${message}"...`,
        sender: agent.name,
        type: "text",
        created_at: new Date()
      });
    }, 1000);
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
    </div>
  );
};

export default Index;
