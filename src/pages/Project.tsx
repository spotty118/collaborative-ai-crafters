import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProject, getAgents, getTasks, getCodeFiles, createMessage, getMessages, updateAgent, createAgents } from "@/lib/api";
import Header from "@/components/layout/Header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Dashboard from "@/components/layout/Dashboard";
import { sendAgentPrompt, analyzeGitHubAndCreateTasks } from "@/lib/openrouter";
import { CodeFile, Message, Project as ProjectType, Agent, Task } from "@/lib/types";
import { useGitHub } from "@/contexts/GitHubContext";
import { FileEditor } from "@/components/FileEditor";
import { toast } from "sonner";
import { GitHubTester } from '@/components/GitHubTester';
import { isGitHubServiceInitialized } from "@/lib/services/GitHubService";

const Project: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<CodeFile | null>(null);
  const [githubToken, setGithubToken] = useState("");
  const [githubBranch, setGithubBranch] = useState("main");

  const github = useGitHub();
  const queryClient = useQueryClient();

  const { 
    data: project,
    isLoading: loadingProject,
    error: projectError 
  } = useQuery<ProjectType>({
    queryKey: ['project', id],
    queryFn: () => id ? getProject(id) : Promise.resolve(null),
    enabled: !!id
  });

  const { 
    data: agents = [], 
    isLoading: loadingAgents,
    isError: agentsError,
    refetch: refetchAgents
  } = useQuery<Agent[]>({
    queryKey: ['agents', id],
    queryFn: () => id ? getAgents(id) : Promise.resolve([]),
    enabled: !!id
  });

  useEffect(() => {
    const initializeAgents = async () => {
      if (id && agents && agents.length === 0 && !loadingAgents && !agentsError) {
        console.log("No agents found, creating default agents");
        try {
          const newAgents = await createAgents(id);
          console.log("Created agents:", newAgents);
          refetchAgents();
        } catch (error) {
          console.error("Error creating agents:", error);
          toast.error("Failed to create agents");
        }
      }
    };
    
    initializeAgents();
  }, [id, agents, loadingAgents, agentsError, refetchAgents]);

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
    queryKey: ['messages', id],
    queryFn: () => id ? getMessages(id) : Promise.resolve([]),
    enabled: !!id
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

  const updateAgentMutation = useMutation({
    mutationFn: ({ agentId, updates }: { agentId: string, updates: Partial<Agent> }) => 
      updateAgent(agentId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', id] });
    }
  });

  useEffect(() => {
    const connectToGitHub = async () => {
      if (project?.sourceUrl && githubToken && !github.isConnected) {
        console.log('Attempting to connect to GitHub with:', {
          url: project.sourceUrl,
          tokenLength: githubToken.length,
          branch: githubBranch
        });
        
        try {
          const success = await github.connect(project.sourceUrl, githubToken, githubBranch);
          if (success) {
            console.log('Successfully connected to GitHub');
          } else {
            console.error('Failed to connect to GitHub');
          }
        } catch (error) {
          console.error('Error connecting to GitHub:', error);
          toast.error('Failed to connect to GitHub: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
      }
    };
    
    connectToGitHub();
  }, [project?.sourceUrl, githubToken, githubBranch, github]);

  useEffect(() => {
    if (github.isConnected && githubToken && id) {
      localStorage.setItem(`github-token-${id}`, githubToken);
      console.log('Saved GitHub token to localStorage');
    }
  }, [github.isConnected, githubToken, id]);

  useEffect(() => {
    if (id) {
      const savedToken = localStorage.getItem(`github-token-${id}`);
      if (savedToken) {
        console.log('Loaded GitHub token from localStorage');
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

    if (!isGitHubServiceInitialized()) {
      toast.error('GitHub service is not properly initialized. Please reconnect in project settings.');
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
      await github.connect(project.sourceUrl, githubToken, githubBranch);
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

  const handleStartAgent = async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || !project || !id) return;

    if (agent.status === 'working') {
      toast.info(`${agent.name} is already running`);
      return;
    }

    updateAgentMutation.mutate({
      agentId,
      updates: { status: 'working', progress: 10 }
    });

    createMessageMutation.mutate({
      project_id: id,
      content: `I'm now analyzing the project and will help improve it. This might take a moment...`,
      sender: agent.name,
      type: "text"
    });

    try {
      if (project.sourceUrl && project.sourceUrl.includes('github.com')) {
        const success = await analyzeGitHubAndCreateTasks(agent, project);
        
        if (success) {
          updateAgentMutation.mutate({
            agentId,
            updates: { status: 'completed', progress: 100 }
          });
          
          queryClient.invalidateQueries({ queryKey: ['tasks', id] });
          
          createMessageMutation.mutate({
            project_id: id,
            content: `I've analyzed the GitHub repository and created tasks for improvements. Check the task list for details.`,
            sender: agent.name,
            type: "text"
          });
          
          toast.success(`${agent.name} has created tasks for the project`);
        } else {
          throw new Error('Failed to analyze GitHub repository');
        }
      } else {
        setTimeout(() => {
          updateAgentMutation.mutate({
            agentId,
            updates: { status: 'completed', progress: 100 }
          });
          
          createMessageMutation.mutate({
            project_id: id,
            content: `I've completed my analysis of the project. Let me know if you need any specific help!`,
            sender: agent.name,
            type: "text"
          });
        }, 3000);
      }
    } catch (error) {
      console.error(`Error starting agent ${agent.name}:`, error);
      
      updateAgentMutation.mutate({
        agentId,
        updates: { status: 'failed', progress: 0 }
      });
      
      createMessageMutation.mutate({
        project_id: id,
        content: `I encountered an error while analyzing the project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sender: agent.name,
        type: "text"
      });
      
      toast.error(`${agent.name} encountered an error`);
    }
  };

  const handleStopAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || !id) return;
    
    updateAgentMutation.mutate({
      agentId,
      updates: { status: 'idle', progress: agent.progress }
    });
    
    createMessageMutation.mutate({
      project_id: id,
      content: `I've paused my work. You can restart me at any time.`,
      sender: agent.name,
      type: "text"
    });
    
    toast.info(`${agent.name} has been paused`);
  };

  const handleSendMessage = async (message: string) => {
    if (!id || !message.trim() || !activeChat || !project) return;
    
    const agent = agents.find(a => a.id === activeChat);
    if (!agent) return;
    
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
      
      <div className="bg-white border-b px-4 py-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="code">Code Files</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="flex-1 mt-0">
            <Dashboard
              agents={agents}
              tasks={tasks}
              messages={messages}
              activeChat={activeChat}
              onStartAgent={handleStartAgent}
              onStopAgent={handleStopAgent}
              onChatWithAgent={handleChatWithAgent}
              onSendMessage={handleSendMessage}
              project={{
                name: project?.name || '',
                description: project?.description || '',
                mode: project?.sourceType ? 'existing' : 'new'
              }}
              isLoading={{
                agents: loadingAgents,
                tasks: loadingTasks,
                messages: loadingMessages
              }}
            />
          </TabsContent>
          
          <TabsContent value="code" className="flex-1 p-4">
            <div className="bg-white rounded-lg border h-full">
              <div className="border-b px-4 py-3 flex justify-between items-center">
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
                <div className="grid md:grid-cols-2 gap-4 p-4">
                  {files.map(file => (
                    <div
                      key={file.id}
                      className="border rounded-md p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleFileClick(file)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium">{file.name}</h3>
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

          <TabsContent value="settings" className="flex-1 p-4">
            <div className="bg-white rounded-lg border p-6 max-w-2xl mx-auto">
              <h2 className="text-xl font-semibold mb-6">Project Settings</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-medium mb-2">Project Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="font-medium w-32">Name:</span>
                      <span>{project?.name}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="font-medium w-32">Description:</span>
                      <span>{project?.description || 'No description'}</span>
                    </div>
                  </div>
                </div>
                
                {project?.sourceUrl && (
                  <div>
                    <h3 className="text-base font-medium mb-4">GitHub Integration</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>Connection Status:</span>
                        <span className={`px-2 py-1 rounded text-sm ${github.isConnected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {github.isConnected ? 'Connected' : 'Not Connected'}
                        </span>
                      </div>

                      <div className="flex items-start">
                        <span className="font-medium w-32">Repository:</span>
                        <a 
                          href={project.sourceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate max-w-md"
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
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="github-branch">GitHub Branch</Label>
                        <Input
                          id="github-branch"
                          value={githubBranch}
                          onChange={(e) => setGithubBranch(e.target.value)}
                          placeholder="main"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Specify the branch to use for this repository (defaults to main)
                        </p>
                      </div>
                      
                      <Button onClick={handleConnectGitHub} className="mt-2">
                        {github.isConnected ? 'Reconnect GitHub' : 'Connect GitHub'}
                      </Button>
                      
                      {github.isConnected && (
                        <div className="mt-2 text-sm text-gray-500">
                          Currently using branch: <span className="font-medium">{github.currentBranch}</span>
                        </div>
                      )}

                      {github.isConnected && (
                        <div className="mt-6">
                          <h3 className="text-base font-medium mb-4">GitHub Test</h3>
                          <GitHubTester />
                        </div>
                      )}
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
