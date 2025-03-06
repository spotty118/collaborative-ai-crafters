import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProject, getAgents, getTasks, getCodeFiles, createMessage, getMessages } from "@/lib/api";
import Header from "@/components/layout/Header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Dashboard from "@/components/layout/Dashboard";
import { sendAgentPrompt } from "@/lib/openrouter";
import { CodeFile, Message, Project as ProjectType, Agent, Task } from "@/lib/types";
import { useGitHubContext } from "@/contexts/GitHubContext";
import { FileEditor } from "@/components/FileEditor";
import { toast } from "sonner";

interface DashboardProps {
  project: {
    name: string;
    description: string;
    mode: 'new' | 'existing';
  };
  agents: Agent[];
  tasks: Task[];
  messages: Message[];
  activeChat: string | null;
  onStartAgent: (agentId: string) => void;
  onStopAgent: (agentId: string) => void;
  onChatWithAgent: (agentId: string) => void;
  onSendMessage: (message: string) => void;
  isLoading: {
    agents: boolean;
    tasks: boolean;
    messages: boolean;
  };
}

const Project: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"dashboard" | "code" | "settings">("dashboard");
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<CodeFile | null>(null);
  const [githubToken, setGithubToken] = useState<string>("");
  const [chatMessage, setChatMessage] = useState<string>("");

  const github = useGitHubContext();
  const queryClient = useQueryClient();

  const { 
    data: project,
    isLoading: loadingProject,
    error: projectError 
  } = useQuery<ProjectType>({
    queryKey: ['project', id],
    queryFn: () => id ? getProject(id) : Promise.resolve(null) as unknown as ProjectType,
    enabled: !!id
  });

  const { 
    data: agents = [], 
    isLoading: loadingAgents 
  } = useQuery<Agent[]>({
    queryKey: ['agents', id],
    queryFn: () => id ? getAgents(id) : Promise.resolve([]),
    enabled: !!id
  });

  const { 
    data: tasks = [], 
    isLoading: loadingTasks 
  } = useQuery<Task[]>({
    queryKey: ['tasks', id],
    queryFn: () => id ? getTasks(id) : Promise.resolve([]),
    enabled: !!id
  });

  const {
    data: messages = [],
    isLoading: loadingMessages
  } = useQuery<Message[]>({
    queryKey: ['messages', id, activeChat],
    queryFn: () => id ? getMessages(id) : Promise.resolve([]),
    enabled: !!id && !!activeChat
  });

  const { 
    data: files = [], 
    isLoading: loadingFiles 
  } = useQuery<CodeFile[]>({
    queryKey: ['files', id],
    queryFn: () => id ? getCodeFiles(id) : Promise.resolve([]),
    enabled: !!id && activeTab === "code"
  });

  const createMessageMutation = useMutation({
    mutationFn: (messageData: Message) => createMessage(messageData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', id] });
    }
  });

  useEffect(() => {
    if (project?.sourceUrl && githubToken && !github.isConnected) {
      try {
        github.connect(project.sourceUrl, githubToken);
      } catch (error) {
        console.error('Failed to connect to GitHub:', error);
        toast.error('Failed to connect to GitHub: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  }, [project?.sourceUrl, githubToken, github]);

  useEffect(() => {
    if (github.isConnected && githubToken) {
      localStorage.setItem(`github-token-${id}`, githubToken);
    }
  }, [github.isConnected, githubToken, id]);

  useEffect(() => {
    if (id) {
      const savedToken = localStorage.getItem(`github-token-${id}`);
      if (savedToken) {
        setGithubToken(savedToken);
      }
    }
  }, [id]);

  const handleFileClick = async (file: CodeFile) => {
    if (!github.isConnected) {
      toast.error('GitHub is not connected. Please configure GitHub access in project settings.');
      setActiveTab('settings');
      return;
    }

    try {
      const content = await github.getFileContent(file.path);
      setSelectedFile({
        ...file,
        content
      });
    } catch (error) {
      toast.error('Failed to load file content: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handlePushToGitHub = async () => {
    if (!github.isConnected) {
      toast.error('GitHub is not connected. Please configure GitHub access in project settings.');
      setActiveTab('settings');
      return;
    }

    const loadingToastId = toast.loading('Pushing changes to GitHub...');

    try {
      for (const file of files) {
        if (file.content) {
          await github.createOrUpdateFile(file.path, file.content, `chore: sync ${file.path}`);
        }
      }
      toast.dismiss(loadingToastId);
      toast.success('Successfully pushed changes to GitHub');
    } catch (error) {
      toast.dismiss(loadingToastId);
      toast.error('Failed to push to GitHub: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleConnectGitHub = async () => {
    if (!project?.sourceUrl) {
      toast.error('No GitHub repository URL configured');
      return;
    }

    if (!githubToken) {
      toast.error('Please enter a GitHub token');
      return;
    }

    try {
      await github.connect(project.sourceUrl, githubToken);
      toast.success('Successfully connected to GitHub');
    } catch (error) {
      toast.error('Failed to connect to GitHub: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleChatWithAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    
    setActiveChat(agentId);
    toast.info(`Chat activated with ${agent.name}`);
  };

  const handleSendMessage = async (message: string) => {
    if (!id || !message.trim() || !activeChat || !project) return;
    
    const agent = agents.find(a => a.id === activeChat);
    if (!agent) return;
    
    setChatMessage("");
    
    createMessageMutation.mutate({
      project_id: id,
      content: message,
      sender: "You",
      type: "text"
    });

    const loadingToastId = toast.loading(`${agent.name} is thinking...`);
    
    try {
      const response = await sendAgentPrompt(agent, message, project);
      
      createMessageMutation.mutate({
        project_id: id,
        content: response,
        sender: agent.name,
        type: "text"
      });
      
      toast.dismiss(loadingToastId);
    } catch (error) {
      console.error('Error getting response from agent:', error);
      
      createMessageMutation.mutate({
        project_id: id,
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: agent.name,
        type: "text"
      });
      
      toast.dismiss(loadingToastId);
      toast.error("Failed to get response from agent.");
    }
  };

  if (!id || loadingProject || projectError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 border-4 border-t-primary rounded-full animate-spin mb-4"></div>
          <p>{projectError ? "Error loading project" : "Loading project..."}</p>
          {projectError && (
            <button 
              className="mt-4 px-4 py-2 bg-primary text-white rounded" 
              onClick={() => navigate("/")}
            >
              Back to Projects
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Project Not Found</h2>
          <p className="mb-4">The project you're looking for doesn't exist.</p>
          <button 
            className="px-4 py-2 bg-primary text-white rounded" 
            onClick={() => navigate("/")}
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header
        onNewProject={() => navigate("/")}
        onImportProject={() => navigate("/")}
      />
      
      <div className="bg-white border-b px-2 sm:px-4 py-3">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "dashboard" | "code" | "settings")} className="w-full">
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="code">Code Files</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-0">
            <Dashboard
              agents={agents}
              tasks={tasks}
              messages={messages}
              activeChat={activeChat}
              onStartAgent={() => {}}
              onStopAgent={() => {}}
              onChatWithAgent={handleChatWithAgent}
              onSendMessage={handleSendMessage}
              project={{
                name: project.name,
                description: project.description,
                mode: project.sourceType ? 'existing' : 'new'
              }}
              isLoading={{
                agents: loadingAgents,
                tasks: loadingTasks,
                messages: loadingMessages
              }}
            />
          </TabsContent>

          <TabsContent value="code" className="p-2 sm:p-4">
            <div className="bg-white rounded-lg border h-full">
              <div className="border-b px-3 py-3 flex justify-between items-center flex-wrap gap-2">
                <h2 className="font-semibold">Code Files</h2>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handlePushToGitHub}
                    disabled={!github.isConnected || files.length === 0}
                  >
                    {github.isConnected ? 'Push to GitHub' : 'Connect GitHub to Push'}
                  </Button>
                </div>
              </div>
              
              {loadingFiles ? (
                <div className="flex items-center justify-center h-64">
                  <div className="h-8 w-8 border-4 border-t-primary rounded-full animate-spin"></div>
                </div>
              ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                  <p className="text-gray-500 mb-4">No code files have been generated yet.</p>
                  <p className="text-sm text-gray-400">Files will appear here as the agents generate code.</p>
                </div>
              ) : selectedFile ? (
                <FileEditor
                  file={selectedFile}
                  onClose={() => setSelectedFile(null)}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 sm:p-4">
                  {files.map(file => (
                    <div
                      key={file.id}
                      className="border rounded-md p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleFileClick(file)}
                    >
                      <div className="flex justify-between items-start mb-2 flex-wrap gap-1">
                        <h3 className="font-medium truncate max-w-[calc(100%-70px)]">{file.name}</h3>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">{file.language || 'Unknown'}</span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{file.path}</p>
                      <div className="mt-2 flex justify-between items-center text-xs text-gray-500">
                        Created by: {file.created_by}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="p-2 sm:p-4">
            <div className="bg-white rounded-lg border p-4 sm:p-6 max-w-2xl mx-auto">
              <h2 className="text-xl font-semibold mb-6">Project Settings</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-medium mb-2">Project Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center flex-wrap">
                      <span className="font-medium w-32">Name:</span>
                      <span className="break-words">{project.name}</span>
                    </div>
                    <div className="flex items-start flex-wrap">
                      <span className="font-medium w-32">Description:</span>
                      <span className="break-words">{project.description || 'No description'}</span>
                    </div>
                  </div>
                </div>
                
                {project.sourceUrl && (
                  <div>
                    <h3 className="text-base font-medium mb-4">GitHub Integration</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span>Connection Status:</span>
                        <span className={`px-2 py-1 rounded text-sm ${github.isConnected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {github.isConnected ? 'Connected' : 'Not Connected'}
                        </span>
                      </div>

                      <div className="flex items-start flex-wrap">
                        <span className="font-medium w-32">Repository:</span>
                        <a 
                          href={project.sourceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate max-w-full break-all"
                        >
                          {project.sourceUrl}
                        </a>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="github-token">GitHub Personal Access Token</Label>
                        <Input
                          id="github-token"
                          type="password"
                          value={githubToken}
                          onChange={(e) => setGithubToken(e.target.value)}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Create a personal access token with 'repo' scope at{" "}
                          <a
                            href="https://github.com/settings/tokens"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            GitHub Settings
                          </a>
                        </p>
                        <Button onClick={handleConnectGitHub} className="mt-2 w-full sm:w-auto">
                          {github.isConnected ? 'Reconnect GitHub' : 'Connect GitHub'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Project;
