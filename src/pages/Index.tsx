
import React, { useState } from "react";
import Header from "@/components/layout/Header";
import Dashboard from "@/components/layout/Dashboard";
import ProjectSetup from "@/components/layout/ProjectSetup";
import { agents, tasks, project, messages } from "@/lib/data";
import { Agent, ProjectMode, Task } from "@/lib/types";
import { toast } from "sonner";

const Index = () => {
  const [agentList, setAgentList] = useState<Agent[]>(agents);
  const [taskList, setTaskList] = useState<Task[]>(tasks);
  const [messageList, setMessageList] = useState(messages);
  const [currentProject, setCurrentProject] = useState(project);
  const [isProjectSetupOpen, setIsProjectSetupOpen] = useState(false);

  const handleStartAgent = (agentId: string) => {
    setAgentList((prev) =>
      prev.map((agent) =>
        agent.id === agentId
          ? { ...agent, status: "working" as const, progress: 10 }
          : agent
      )
    );
    toast.success(`${agentList.find(a => a.id === agentId)?.name} started working`);
    
    // Simulate progress updates
    const interval = setInterval(() => {
      setAgentList((prev) => {
        const updatedAgents = prev.map((agent) => {
          if (agent.id === agentId && agent.status === "working") {
            const newProgress = agent.progress + 10;
            if (newProgress >= 100) {
              clearInterval(interval);
              return { ...agent, progress: 100, status: "completed" as const };
            }
            return { ...agent, progress: newProgress };
          }
          return agent;
        });
        return updatedAgents;
      });
    }, 2000);
  };

  const handleStopAgent = (agentId: string) => {
    setAgentList((prev) =>
      prev.map((agent) =>
        agent.id === agentId ? { ...agent, status: "idle" as const } : agent
      )
    );
    toast.info(`${agentList.find(a => a.id === agentId)?.name} has been paused`);
  };

  const handleChatWithAgent = (agentId: string) => {
    toast.info(`Chat activated with ${agentList.find(a => a.id === agentId)?.name}`);
  };

  const handleCreateProject = (projectData: {
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
  }) => {
    setCurrentProject({
      ...currentProject,
      name: projectData.name,
      description: projectData.description,
      mode: projectData.mode,
      techStack: projectData.techStack,
    });
    
    setIsProjectSetupOpen(false);
    toast.success(`Project "${projectData.name}" has been created`);
    
    // Reset agents status
    setAgentList(agents.map(agent => ({ ...agent, status: "idle", progress: 0 })));
    
    // For demo: set architect to "working" after a short delay
    setTimeout(() => {
      setAgentList((prev) =>
        prev.map((agent) =>
          agent.type === "architect"
            ? { ...agent, status: "working" as const, progress: 5 }
            : agent
        )
      );
      
      // Add a message from the architect
      const newMessage = {
        id: Date.now().toString(),
        content: `Analyzing project requirements for "${projectData.name}"...`,
        sender: "Architect Agent",
        timestamp: new Date(),
        agentId: "1",
      };
      
      setMessageList((prev) => [...prev, newMessage]);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header
        onNewProject={() => setIsProjectSetupOpen(true)}
        onImportProject={() => setIsProjectSetupOpen(true)}
      />
      
      <Dashboard
        agents={agentList}
        tasks={taskList}
        messages={messageList}
        onStartAgent={handleStartAgent}
        onStopAgent={handleStopAgent}
        onChatWithAgent={handleChatWithAgent}
        project={{
          name: currentProject.name,
          description: currentProject.description,
          mode: currentProject.mode,
        }}
      />
      
      <ProjectSetup
        isOpen={isProjectSetupOpen}
        onClose={() => setIsProjectSetupOpen(false)}
        onCreateProject={handleCreateProject}
      />
    </div>
  );
};

export default Index;
