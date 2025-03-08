import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProject, getAgents, getTasks, getCodeFiles, createMessage, getMessages, createAgents, updateAgent, createTask, updateTask, createCodeFile } from "@/lib/api";
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

const Project: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<CodeFile | null>(null);
  const [githubToken, setGithubToken] = useState("");

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

  const updateAgentMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: Partial<Agent> }) => 
      updateAgent(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', id] });
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: Partial<Task> }) => 
      updateTask(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
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

  useEffect(() => {
    if (id && agents && agents.length === 0 && !loadingAgents) {
      console.log("No agents found, creating agents for project:", id);
      createAgents(id)
        .then((createdAgents) => {
          console.log("Agents created successfully:", createdAgents);
          queryClient.invalidateQueries({ queryKey: ['agents', id] });
        })
        .catch((error) => {
          console.error("Failed to create agents:", error);
          toast.error("Failed to create agents: " + (error instanceof Error ? error.message : 'Unknown error'));
        });
    }
  }, [id, agents, loadingAgents, queryClient]);

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

  const handleStartAgent = async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || !id || !project) return;
    
    updateAgentMutation.mutate({
      id: agentId,
      updates: { 
        status: 'working',
        progress: 5
      }
    });
    
    toast.info(`Starting ${agent.name}...`);
    
    try {
      console.log(`Agent ${agent.name} starting work`);
      
      if (agent.type === 'architect') {
        updateAgentMutation.mutate({
          id: agentId,
          updates: { 
            status: 'working',
            progress: 20
          }
        });
        toast.info(`${agent.name} is analyzing project requirements...`);
        
        const analysisPrompt = `Analyze the requirements for project: ${project.name}\n\n${project.description || ''}\n\n${project.requirements || ''}`;
        const analysisResult = await sendAgentPrompt(agent, analysisPrompt, project, { 
          ignoreStatus: true,
          expectCode: false 
        });
        
        if (!analysisResult) {
          throw new Error("Failed to analyze requirements");
        }
        
        await createMessage({
          project_id: id,
          content: analysisResult,
          sender: agent.name,
          type: "text"
        });
        
        updateAgentMutation.mutate({
          id: agentId,
          updates: { 
            status: 'working',
            progress: 50
          }
        });
        toast.info(`${agent.name} is designing system architecture...`);
        
        const designPrompt = `
Design the architecture for project: ${project.name} based on these requirements:
${project.description || ''}\n${project.requirements || ''}

Your response should include:
1. Overall system architecture
2. Key components and their responsibilities
3. Data flow between components
4. Required files to implement with their names and purposes
5. Technology choices justified by requirements

IMPORTANT: Be very specific about what code files need to be created. For each component, list the exact filename and what it should contain.`;

        const designResult = await sendAgentPrompt(agent, designPrompt, project, { 
          ignoreStatus: true,
          expectCode: false
        });
        
        if (!designResult) {
          throw new Error("Failed to design architecture");
        }
        
        await createMessage({
          project_id: id,
          content: designResult,
          sender: agent.name,
          type: "text"
        });
        
        updateAgentMutation.mutate({
          id: agentId,
          updates: { 
            status: 'working',
            progress: 80
          }
        });
        toast.info(`${agent.name} is delegating tasks to specialized agents...`);
        
        updateAgentMutation.mutate({
          id: agentId,
          updates: { 
            status: 'completed',
            progress: 100
          }
        });
        
        toast.success(`${agent.name} completed analysis and architecture design`);
        
        const otherAgents = agents.filter(a => a.type !== 'architect' && a.status === 'idle');
        
        if (otherAgents.length > 0) {
          toast.info("Architect is activating specialized agents...");
          
          if (tasks.filter(t => t.agent_id === agentId).length === 0) {
            const defaultTasks = getDefaultTasksForAgent(agent, id);
            
            for (const taskData of defaultTasks) {
              await createTask({
                project_id: id,
                agent_id: agentId,
                title: taskData.title,
                description: taskData.description,
                status: 'pending',
                priority: 'medium'
              });
            }
            
            queryClient.invalidateQueries({ queryKey: ['tasks', id] });
          }
          
          for (const [index, specializedAgent] of otherAgents.entries()) {
            updateAgentMutation.mutate({
              id: specializedAgent.id,
              updates: {
                status: 'working',
                progress: 10
              }
            });
            
            toast.info(`${specializedAgent.name} activated by Architect`);
            
            if (tasks.filter(t => t.agent_id === specializedAgent.id).length === 0) {
              const agentTasks = getCodeTasksForAgent(specializedAgent, id, project);
              
              for (const taskData of agentTasks) {
                await createTask({
                  project_id: id,
                  agent_id: specializedAgent.id,
                  title: taskData.title,
                  description: taskData.description,
                  status: 'pending',
                  priority: 'medium',
                  metadata: taskData.metadata
                });
              }
            }
            
            const setupPrompt = getSpecializedAgentPrompt(specializedAgent.type, project);
            
            try {
              const setupResult = await sendAgentPrompt(
                specializedAgent, 
                setupPrompt, 
                project, 
                { 
                  ignoreStatus: true,
                  expectCode: true
                }
              );
              
              if (setupResult) {
                await createMessage({
                  project_id: id,
                  content: setupResult,
                  sender: specializedAgent.name,
                  type: "text"
                });
                
                try {
                  const codeFiles = extractCodeFilesFromResponse(setupResult);
                  if (codeFiles.length > 0) {
                    for (const { filename, content, language } of codeFiles) {
                      await createCodeFile({
                        project_id: id,
                        name: filename.split('/').pop() || filename,
                        path: filename,
                        content: content,
                        language: language || 'unknown',
                        created_by: specializedAgent.type,
                        last_modified_by: specializedAgent.type
                      });
                    }
                  }
                } catch (codeError) {
                  console.error(`Failed to extract code from ${specializedAgent.name}'s response:`, codeError);
                }
                
                updateAgentMutation.mutate({
                  id: specializedAgent.id,
                  updates: {
                    status: 'working',
                    progress: 60
                  }
                });
                
                updateAgentMutation.mutate({
                  id: specializedAgent.id,
                  updates: {
                    status: 'completed',
                    progress: 100
                  }
                });
                
                toast.success(`${specializedAgent.name} completed initial setup`);
              } else {
                updateAgentMutation.mutate({
                  id: specializedAgent.id,
                  updates: {
                    status: 'failed',
                    progress: 0
                  }
                });
                
                toast.error(`${specializedAgent.name} failed to complete setup`);
              }
            } catch (error) {
              console.error(`Error with ${specializedAgent.name}:`, error);
              updateAgentMutation.mutate({
                id: specializedAgent.id,
                updates: {
                  status: 'failed',
                  progress: 0
                }
              });
              
              toast.error(`${specializedAgent.name} failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          queryClient.invalidateQueries({ queryKey: ['agents', id] });
          queryClient.invalidateQueries({ queryKey: ['tasks', id] });
          queryClient.invalidateQueries({ queryKey: ['messages', id] });
          queryClient.invalidateQueries({ queryKey: ['files', id] });
        }
      } else {
        updateAgentMutation.mutate({
          id: agentId,
          updates: { 
            status: 'working',
            progress: 30
          }
        });
        
        const agentPrompt = `As the ${agent.type} agent for project ${project.name}, analyze the requirements and provide your professional insights. The project description is: ${project.description || ''}`;
        const agentResult = await sendAgentPrompt(agent, agentPrompt, project, { ignoreStatus: true });
        
        if (agentResult) {
          await createMessage({
            project_id: id,
            content: agentResult,
            sender: agent.name,
            type: "text"
          });
          
          updateAgentMutation.mutate({
            id: agentId,
            updates: { 
              status: 'working',
              progress: 70
            }
          });
          
          if (tasks.filter(t => t.agent_id === agentId).length === 0) {
            const agentTasks = getCodeTasksForAgent(agent, id, project);
            
            for (const taskData of agentTasks) {
              await createTask({
                project_id: id,
                agent_id: agentId,
                title: taskData.title,
                description: taskData.description,
                status: 'pending',
                priority: 'medium'
              });
            }
            
            queryClient.invalidateQueries({ queryKey: ['tasks', id] });
          }
          
          updateAgentMutation.mutate({
            id: agentId,
            updates: { 
              status: 'completed',
              progress: 100
            }
          });
          
          toast.success(`${agent.name} completed analysis`);
        } else {
          throw new Error("Agent returned empty response");
        }
      }
    } catch (error) {
      console.error('Error starting agent:', error);
      updateAgentMutation.mutate({
        id: agentId,
        updates: { 
          status: 'failed',
          progress: 0
        }
      });
      toast.error(`${agent.name} encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRestartAgent = async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || !id) return;
    
    updateAgentMutation.mutate({
      id: agentId,
      updates: { 
        status: 'working',
        progress: 10
      }
    });
    
    toast.info(`Restarting ${agent.name}...`);
    
    try {
      console.log(`Agent ${agent.name} restarting work`);
      
      setTimeout(() => {
        updateAgentMutation.mutate({
          id: agentId,
          updates: { 
            status: 'completed',
            progress: 100
          }
        });
        
        toast.success(`${agent.name} completed analysis`);
      }, 1500);
      
    } catch (error) {
      console.error('Error restarting agent:', error);
      updateAgentMutation.mutate({
        id: agentId,
        updates: { 
          status: 'failed',
          progress: 0
        }
      });
      toast.error(`${agent.name} encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleExecuteTask = async (taskId: string, agentId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const agent = agents.find(a => a.id === agentId);
    
    if (!task || !agent || !id || !project) {
      toast.error("Could not find task, agent, or project details");
      return;
    }
    
    updateTaskMutation.mutate({
      id: taskId,
      updates: { 
        status: 'in_progress'
      }
    });
    
    updateAgentMutation.mutate({
      id: agentId,
      updates: { 
        status: 'working',
        progress: 30
      }
    });
    
    toast.info(`${agent.name} is working on: ${task.title}`);
    
    try {
      console.log(`Agent ${agent.name} executing task: ${task.title}`);
      
      updateAgentMutation.mutate({
        id: agentId,
        updates: { 
          status: 'working',
          progress: 70
        }
      });
      
      const metadata = task.metadata || {};
      const filePath = typeof metadata === 'object' && 'filePath' in metadata ? metadata.filePath : undefined;
      const codeType = typeof metadata === 'object' && 'codeType' in metadata ? metadata.codeType : undefined;
      
      let prompt = `Task: ${task.title}\n\nDescription: ${task.description}\n\n`;
      
      if (filePath) {
        prompt += `Create a complete implementation for this file: ${filePath}\n\n`;
      }
      
      prompt += `Please provide a COMPLETE implementation with ALL necessary imports and code.
Do not just provide explanations or descriptions - I need the actual code file.`;
      
      console.log(`Sending task to OpenRouter through sendAgentPrompt:`, {
        agent,
        prompt,
        project
      });
      
      try {
        const result = await sendAgentPrompt(
          agent, 
          prompt, 
          project, 
          { 
            ignoreStatus: true,
            expectCode: true,
            task: task.title
          }
        );
        
        if (!result) {
          throw new Error("Empty response from agent");
        }
        
        await createMessage({
          project_id: id,
          content: result,
          sender: agent.name,
          type: "text"
        });
        
        try {
          const codeFiles = extractCodeFilesFromResponse(result);
          if (codeFiles.length > 0) {
            for (const { filename, content, language } of codeFiles) {
              await createCodeFile({
                project_id: id,
                name: filename.split('/').pop() || filename,
                path: filename || (filePath as string) || `${agent.type}/${task.title.toLowerCase().replace(/\s+/g, '-')}.js`,
                content: content,
                language: language || (codeType as string) || 'unknown',
                created_by: agent.type,
                last_modified_by: agent.type
              });
            }
            
            toast.success(`${agent.name} created ${codeFiles.length} code files`);
            queryClient.invalidateQueries({ queryKey: ['files', id] });
          } else if (filePath) {
            await createCodeFile({
              project_id: id,
              name: filePath.split('/').pop() || filePath,
              path: filePath as string,
              content: result,
              language: codeType as string || 'unknown',
              created_by: agent.type,
              last_modified_by: agent.type
            });
            
            toast.success(`${agent.name} created a code file: ${filePath}`);
            queryClient.invalidateQueries({ queryKey: ['files', id] });
          }
        } catch (codeError) {
          console.error(`Failed to extract code from ${agent.name}'s response:`, codeError);
        }
        
        updateTaskMutation.mutate({
          id: taskId,
          updates: { 
            status: 'completed'
          }
        });
        
        updateAgentMutation.mutate({
          id: agentId,
          updates: { 
            status: 'completed',
            progress: 100
          }
        });
        
        toast.success(`${agent.name} completed: ${task.title}`);
        
        queryClient.invalidateQueries({ queryKey: ['messages', id] });
        
      } catch (error) {
        console.error('Error executing task:', error);
        
        await createMessage({
          project_id: id,
          content: `Error completing task: ${error instanceof Error ? error.message : 'Unknown error'}`,
          sender: agent.name,
          type: "text"
        });
        
        updateTaskMutation.mutate({
          id: taskId,
          updates: { 
            status: 'failed'
          }
        });
        
        updateAgentMutation.mutate({
          id: agentId,
          updates: { 
            status: 'idle',
            progress: 0
          }
        });
        
        toast.error(`${agent.name} failed to complete task: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error executing task:', error);
      
      try {
        if (id) {
          await createMessage({
            project_id: id,
            content: `Error executing task: ${error instanceof Error ? error.message : 'Unknown error'}`,
            sender: agent.name,
            type: "text"
          });
        }
      } catch (msgError) {
        console.error('Failed to create error message:', msgError);
      }
      
      updateTaskMutation.mutate({
        id: taskId,
        updates: { 
          status: 'failed'
        }
      });
      
      updateAgentMutation.mutate({
        id: agentId,
        updates: { 
          status: 'idle',
          progress: 0
        }
      });
      
      toast.error(`${agent.name} encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getDefaultTasksForAgent = (agent: Agent, projectId: string): Array<{title: string, description: string}> => {
    switch (agent.type) {
      case 'architect':
        return [
          {
            title: 'Define project architecture',
            description: 'Create a high-level architecture diagram and component structure for the project.'
          },
          {
            title: 'Set up project structure',
            description: 'Set up the initial folder structure and core configuration files.'
          },
          {
            title: 'Define data models',
            description: 'Define the core data models and relationships for the project.'
          }
        ];
      case 'frontend':
        return [
          {
            title: 'Create UI components',
            description: 'Build reusable UI components for the application interface.'
          },
          {
            title: 'Implement responsive design',
            description: 'Ensure the application works on all screen sizes and devices.'
          },
          {
            title: 'Add client-side validation',
            description: 'Implement form validation and error handling in the UI.'
          }
        ];
      case 'backend':
        return [
          {
            title: 'Implement API endpoints',
            description: 'Create the necessary API endpoints for the application.'
          },
          {
            title: 'Set up database models',
            description: 'Implement database models and migrations.'
          },
          {
            title: 'Add authentication',
            description: 'Implement user authentication and authorization.'
          }
        ];
      case 'testing':
        return [
          {
            title: 'Write unit tests',
            description: 'Create unit tests for core components and functions.'
          },
          {
            title: 'Set up integration tests',
            description: 'Implement integration tests for API endpoints and services.'
          },
          {
            title: 'Create end-to-end tests',
            description: 'Build end-to-end tests to verify key user flows.'
          }
        ];
      case 'devops':
        return [
          {
            title: 'Set up CI/CD pipeline',
            description: 'Configure continuous integration and deployment workflows.'
          },
          {
            title: 'Configure deployment environments',
            description: 'Set up development, staging, and production environments.'
          },
          {
            title: 'Implement monitoring',
            description: 'Add monitoring and alerting for the application.'
          }
        ];
      default:
        return [
          {
            title: `${agent.name} task`,
            description: `Default task generated for ${agent.name}.`
          }
        ];
    }
  };

  const handleStopAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    
    updateAgentMutation.mutate({
      id: agentId,
      updates: { 
        status: 'idle',
        progress: 0
      }
    });
    
    toast.info(`${agent.name} has been stopped`);
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
      const agentMessages = messages.filter(m => 
        m.sender === agent.name || 
        (m.sender === "You" && messages.findIndex(prev => prev.id === m.id) < messages.length - 1)
      ).slice(-5);
      
      const messageContext = agentMessages.length > 0 
        ? "Previous messages:\n" + agentMessages.map(m => `${m.sender}: ${m.content.substring(0, 100)}...`).join("\n")
        : "";
      
      const expectCode = messages.filter(m => m.sender === agent.name).length > 0;
      
      const response = await sendAgentPrompt(
        agent, 
        message, 
        project, 
        { 
          ignoreStatus: true,
          context: messageContext,
          expectCode
        }
      );
      
      createMessageMutation.mutate({
        project_id: id,
        content: response,
        sender: agent.name,
        type: "text"
      });
      
      if (expectCode) {
        try {
          const codeFiles = extractCodeFilesFromResponse(response);
          if (codeFiles.length > 0) {
            for (const { filename, content, language } of codeFiles) {
              if (filename && content) {
                await createCodeFile({
                  project_id: id,
                  name: filename.split('/').pop() || filename,
                  path: filename,
                  content: content,
                  language: language || 'unknown',
                  created_by: agent.name,
                  last_modified_by: agent.name
                });
              }
            }
            
            if (codeFiles.length > 0) {
              toast.success(`${agent.name} created ${codeFiles.length} code files`);
              queryClient.invalidateQueries({ queryKey: ['files', id] });
            }
          }
        } catch (codeError) {
          console.error(`Failed to extract code from ${agent.name}'s response:`, codeError);
        }
      }
      
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

  const getSpecializedAgentPrompt = (agentType: string, projectData: ProjectType): string => {
    switch (agentType) {
      case 'frontend':
        return `As the frontend agent for the ${projectData.name} project, create the following React components:

1. A main Game component for ${projectData.name}
2. Any necessary UI components for game controls
3. A component to display the game score and status

For each component, provide the COMPLETE code with ALL necessary imports. I need entire functional code files, not just snippets.

IMPORTANT: Please write out the full implementation for each file, one at a time, with appropriate filenames.`;

      case 'backend':
        return `As the backend agent for the ${projectData.name} project, create the following files:

1. Main server setup file
2. API routes for game state management
3. Database models for storing game data

For each file, provide the COMPLETE code with ALL necessary imports. I need entire functional code files, not just snippets.

IMPORTANT: Please write out the full implementation for each file, one at a time, with appropriate filenames.`;

      case 'testing':
        return `As the testing agent for the ${projectData.name} project, create the following test files:

1. Unit tests for game logic
2. Integration tests for API endpoints
3. End-to-end tests for key user flows

For each test file, provide the COMPLETE code with ALL necessary imports. I need entire functional code files, not just snippets.

IMPORTANT: Please write out the full implementation for each file, one at a time, with appropriate filenames.`;

      case 'devops':
        return `As the devops agent for the ${projectData.name} project, create the following configuration files:

1. Dockerfile for containerization
2. CI/CD pipeline configuration
3. Deployment scripts for Vercel

For each file, provide the COMPLETE code with ALL necessary configurations. I need entire functional files, not just snippets.

IMPORTANT: Please write out the full implementation for each file, one at a time, with appropriate filenames.`;

      default:
        return `As the ${agentType} agent, analyze the requirements for project ${projectData.name} and generate the necessary code files.

IMPORTANT: Please write out the full implementation for each file, one at a time, with appropriate filenames.`;
    }
  };

  const extractCodeFilesFromResponse = (response: string): Array<{ filename: string; content: string; language: string }> => {
    const codeFiles: Array<{ filename: string; content: string; language: string }> = [];
    
    const codeBlockRegex = /```(?:([\w#]+)\s+)?([\w-./]+)?\s*\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'unknown';
      const filename = match[2] || '';
      const content = match[3].trim();
      
      if (content) {
        codeFiles.push({ filename, content, language });
      }
    }
    
    const filenameRegex = /(\w+\.(js|jsx|ts|tsx|html|css))\s*:\s*```(?:\w+)?\s*\n([\s\S]*?)```/g;
    
    while ((match = filenameRegex.exec(response)) !== null) {
      const filename = match[1];
      const language = match[2];
      const content = match[3].trim();
      
      if (content) {
        codeFiles.push({ filename, content, language });
      }
    }
    
    return codeFiles;
  };

  const getCodeTasksForAgent = (agent: Agent, projectId: string, projectData: ProjectType): Array<{
    title: string; 
    description: string;
    metadata?: any;
  }> => {
    switch (agent.type) {
      case 'frontend':
        return [
          {
            title: 'Create Game Component',
            description: `Implement the main Game component for ${projectData.name} with game board visualization`,
            metadata: {
              filePath: 'src/components/Game.jsx',
              codeType: 'jsx'
            }
          },
          {
            title: 'Create Controls Component',
            description: 'Build reusable controls for game interaction',
            metadata: {
              filePath: 'src/components/Controls.jsx',
              codeType: 'jsx'
            }
          },
          {
            title: 'Implement Game Logic',
            description: 'Create the core game logic for tetris',
            metadata: {
              filePath: 'src/hooks/useGameLogic.js',
              codeType: 'javascript'
            }
          }
        ];
      case 'backend':
        return [
          {
            title: 'Create API Routes',
            description: 'Implement API endpoints for game state management',
            metadata: {
              filePath: 'src/api/gameRoutes.js',
              codeType: 'javascript'
            }
          },
          {
            title: 'Setup Database Models',
            description: 'Create database models for game data',
            metadata: {
              filePath: 'src/models/GameModel.js',
              codeType: 'javascript'
            }
          },
          {
            title: 'Implement Authentication',
            description: 'Add user authentication for saving scores',
            metadata: {
              filePath: 'src/auth/auth.js',
              codeType: 'javascript'
            }
          }
        ];
      case 'testing':
        return [
          {
            title: 'Write Game Logic Tests',
            description: 'Create unit tests for the game logic',
            metadata: {
              filePath: 'tests/gameLogic.test.js',
              codeType: 'javascript'
            }
          },
          {
            title: 'Create Integration Tests',
            description: 'Write integration tests for the API endpoints',
            metadata: {
              filePath: 'tests/api.test.js',
              codeType: 'javascript'
            }
          },
          {
            title: 'Implement E2E Tests',
            description: 'Build end-to-end tests for key user flows',
            metadata: {
              filePath: 'tests/e2e.test.js',
              codeType: 'javascript'
            }
          }
        ];
      case 'devops':
        return [
          {
            title: 'Create Dockerfile',
            description: 'Write a Dockerfile for containerization',
            metadata: {
              filePath: 'Dockerfile',
              codeType: 'docker'
            }
          },
          {
            title: 'Setup CI/CD Pipeline',
            description: 'Configure CI/CD pipeline for GitHub Actions',
            metadata: {
              filePath: '.github/workflows/ci.yml',
              codeType: 'yaml'
            }
          },
          {
            title: 'Configure Vercel Deployment',
            description: 'Setup Vercel deployment configuration',
            metadata: {
              filePath: 'vercel.json',
              codeType: 'json'
            }
          }
        ];
      default:
        return [
          {
            title: `${agent.name} task`,
            description: `Default code-generating task for ${agent.name}.`,
            metadata: {
              filePath: `src/${agent.type}/index.js`,
              codeType: 'javascript'
            }
          }
        ];
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

          <TabsContent value="dashboard" className="flex-1 mt-0">
            <Dashboard
              agents={agents}
              tasks={tasks}
              messages={messages}
              activeChat={activeChat}
              onStartAgent={handleStartAgent}
              onStopAgent={handleStopAgent}
              onRestartAgent={handleRestartAgent}
              onChatWithAgent={handleChatWithAgent}
              onSendMessage={handleSendMessage}
              onExecuteTask={handleExecuteTask}
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

          <TabsContent value="settings" className="flex-1 p-4">
            <div className="bg-white rounded-lg border p-6 max-w-2xl mx-auto">
              <h2 className="text-xl font-semibold mb-6">Project Settings</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-medium mb-2">Project Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="font-medium w-32">Name:</span>
                      <span>{project.name}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="font-medium w-32">Description:</span>
                      <span>{project.description || 'No description'}</span>
                    </div>
                  </div>
                </div>
                
                {project.sourceUrl && (
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
                        <Button onClick={handleConnectGitHub} className="mt-2">
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

