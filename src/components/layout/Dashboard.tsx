
import React, { useState, useEffect } from "react";
import AgentCard from "@/components/agents/AgentCard";
import TaskList from "@/components/ui/TaskList";
import { Agent, Task, Message, ProjectMode } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SendHorizontal, AlertCircle, Code2 } from "lucide-react";
import AgentOrchestration from "@/components/agents/AgentOrchestration";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DashboardProps {
  agents: Agent[];
  tasks: Task[];
  messages: Message[];
  activeChat: string | null;
  onStartAgent: (agentId: string) => void;
  onStopAgent: (agentId: string) => void;
  onRestartAgent: (agentId: string) => void;
  onChatWithAgent: (agentId: string) => void;
  onSendMessage: (message: string) => void;
  onExecuteTask?: (taskId: string, agentId: string) => void;
  project: {
    name: string;
    description: string;
    mode: ProjectMode;
    id?: string;
  };
  isLoading: {
    agents: boolean;
    tasks: boolean;
    messages: boolean;
  };
  children?: React.ReactNode; // Add children prop to the interface
}

const Dashboard: React.FC<DashboardProps> = ({
  agents,
  tasks,
  messages,
  activeChat,
  onStartAgent,
  onStopAgent,
  onRestartAgent,
  onChatWithAgent,
  onSendMessage,
  onExecuteTask,
  project,
  isLoading,
  children // Add children to destructuring
}) => {
  const [chatMessage, setChatMessage] = useState("");
  const [activeTab, setActiveTab] = useState<string>("communication");
  const [quickPrompts, setQuickPrompts] = useState<Record<string, string[]>>({
    frontend: [
      "Create a React component for the game board",
      "Implement user controls for the game",
      "Add animations to the UI"
    ],
    backend: [
      "Set up API routes for storing game scores",
      "Create a database schema for user data",
      "Implement authentication logic"
    ],
    architect: [
      "Design the system architecture",
      "Break down the project into components",
      "Identify necessary technologies"
    ],
    testing: [
      "Write unit tests for game logic",
      "Create end-to-end tests for the application",
      "Set up testing framework"
    ],
    devops: [
      "Set up the deployment pipeline",
      "Configure Docker container",
      "Implement CI/CD workflow"
    ]
  });

  const chatEndRef = React.useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (chatMessage.trim() && activeChat) {
      onSendMessage(chatMessage);
      setChatMessage("");
    }
  };

  const getActiveAgentName = () => {
    if (!activeChat) return "";
    const agent = agents.find(a => a.id === activeChat);
    return agent ? agent.name : "";
  };

  const getActiveAgentType = () => {
    if (!activeChat) return "";
    const agent = agents.find(a => a.id === activeChat);
    return agent ? agent.type : "";
  };

  const filteredMessages = messages.filter(m => 
    !activeChat || 
    m.sender === "You" || 
    m.sender === getActiveAgentName()
  );

  const hasCodeBlock = (content: string): boolean => {
    return content.includes("```");
  };

  const formatMessageContent = (content: string): JSX.Element => {
    if (!hasCodeBlock(content)) {
      return <p className="whitespace-pre-wrap">{content}</p>;
    }

    const parts = content.split(/```(?:[\w-]*\s*\n)?/);
    const result: JSX.Element[] = [];

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        if (parts[i].trim()) {
          result.push(<p key={`text-${i}`} className="whitespace-pre-wrap mb-2">{parts[i]}</p>);
        }
      } else {
        result.push(
          <div key={`code-${i}`} className="bg-gray-900 rounded-md p-3 mb-3 overflow-x-auto">
            <pre className="text-gray-100 text-sm">
              <code>{parts[i]}</code>
            </pre>
          </div>
        );
      }
    }

    return <>{result}</>;
  };

  const extractFilename = (content: string): string | null => {
    const filenameRegex = /(?:^|\n)([\w./-]+\.\w+)(?:\s*:|:|\n```)/;
    const match = content.match(filenameRegex);
    return match ? match[1] : null;
  };

  return (
    <div className="flex h-[calc(100vh-73px)]">
      <div className="w-1/4 border-r bg-gray-50 p-4">
        <h2 className="text-lg font-semibold mb-3">Project</h2>
        <div className="mb-4 bg-white p-3 rounded-md border">
          <h3 className="font-medium">{project.name}</h3>
          <p className="text-sm text-gray-600 mt-1">{project.description}</p>
          <div className="mt-2 inline-block px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
            {project.mode === 'new' ? 'New Project' : 'Existing Project'}
          </div>
        </div>
        
        <h2 className="text-lg font-semibold mb-3">Agents</h2>
        {isLoading.agents ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 border-2 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-md border p-4">
            <p className="text-gray-500 mb-2">No agents available</p>
            <p className="text-sm text-gray-400">Agents will appear here soon.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onChat={onChatWithAgent}
                onStart={onStartAgent}
                onStop={onStopAgent}
                onRestart={onRestartAgent}
                isActive={activeChat === agent.id}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col">
        <div className="border-b p-2">
          <Tabs defaultValue="communication" className="w-full">
            <TabsList className="grid grid-cols-2 w-full max-w-md">
              <TabsTrigger value="communication">Communication</TabsTrigger>
              <TabsTrigger value="orchestration">Orchestration</TabsTrigger>
            </TabsList>
          
            <TabsContent value="communication" className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 pt-0 mt-0">
              <div className="border-r flex flex-col h-full">
                <div className="border-b p-4">
                  <h2 className="text-lg font-semibold">
                    {activeChat 
                      ? `Chat with ${getActiveAgentName()}`
                      : 'Agent Communication'
                    }
                  </h2>
                </div>
                
                {!activeChat ? (
                  <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center p-6 max-w-md">
                      <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No agent selected</h3>
                      <p className="text-gray-500 mb-4">
                        Please select an agent from the sidebar to start a conversation.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {isLoading.messages ? (
                          <div className="flex justify-center py-8">
                            <div className="h-6 w-6 border-2 border-t-primary rounded-full animate-spin"></div>
                          </div>
                        ) : filteredMessages.length === 0 ? (
                          <div className="space-y-4">
                            <div className="text-center py-4 text-gray-500">
                              No messages yet. Start a conversation with the agent.
                            </div>
                            
                            <Alert variant="default" className="bg-blue-50 border-blue-200">
                              <AlertCircle className="h-4 w-4 text-blue-600" />
                              <AlertDescription className="text-blue-700">
                                Hint: Use the quick prompt suggestions below to get started with {getActiveAgentName()}.
                              </AlertDescription>
                            </Alert>
                            
                            <div className="border rounded-md p-3">
                              <h3 className="text-sm font-medium mb-2">Suggested prompts:</h3>
                              <div className="space-y-2">
                                {quickPrompts[getActiveAgentType()] ? 
                                  quickPrompts[getActiveAgentType()].map((prompt, idx) => (
                                    <Button
                                      key={idx}
                                      variant="outline"
                                      size="sm"
                                      className="mr-2 mb-2 text-xs"
                                      onClick={() => {
                                        setChatMessage(prompt);
                                      }}
                                    >
                                      {prompt}
                                    </Button>
                                  )) 
                                  : 
                                  <p className="text-sm text-gray-500">No specific prompts available for this agent.</p>
                                }
                              </div>
                            </div>
                          </div>
                        ) : (
                          filteredMessages.map((message, index) => (
                            <div key={message.id} className={`animate-fade-in ${index === filteredMessages.length - 1 ? 'pb-4' : ''}`}>
                              <div className="flex items-start gap-2 mb-1">
                                <div className={`font-medium text-sm ${message.sender === 'You' ? 'text-blue-600' : 'text-green-600'}`}>
                                  {message.sender}
                                </div>
                                <div className="text-xs text-gray-500 pt-1">
                                  {new Date(message.created_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </div>
                                {hasCodeBlock(message.content) && (
                                  <div className="text-xs bg-gray-100 px-1.5 py-0.5 rounded flex items-center">
                                    <Code2 className="h-3 w-3 mr-1" />
                                    <span>Contains code</span>
                                  </div>
                                )}
                              </div>
                              <div className="pl-2 border-l-2 border-gray-200 text-sm text-gray-700">
                                {formatMessageContent(message.content)}
                                
                                {hasCodeBlock(message.content) && extractFilename(message.content) && (
                                  <div className="mt-1 text-xs text-gray-500">
                                    Potential file: {extractFilename(message.content)}
                                  </div>
                                )}
                              </div>
                              {index < filteredMessages.length - 1 && <Separator className="my-4" />}
                            </div>
                          ))
                        )}
                        <div ref={chatEndRef} />
                      </div>
                    </ScrollArea>
                    
                    <div className="p-4 border-t">
                      <div className="space-y-3">
                        {getActiveAgentType() && quickPrompts[getActiveAgentType()] && (
                          <div className="flex flex-wrap gap-1">
                            {quickPrompts[getActiveAgentType()].map((prompt, idx) => (
                              <Button
                                key={idx}
                                variant="ghost"
                                size="sm"
                                className="text-xs py-1 h-auto"
                                onClick={() => {
                                  setChatMessage(prompt);
                                }}
                              >
                                {prompt}
                              </Button>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <Input
                            placeholder={activeChat ? "Type a message..." : "Select an agent to chat"}
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            disabled={!activeChat}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            className="flex-1"
                          />
                          <Button 
                            size="icon" 
                            disabled={!activeChat || !chatMessage.trim()}
                            onClick={handleSendMessage}
                          >
                            <SendHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <div className="p-4 bg-gray-50 overflow-auto">
                {isLoading.tasks ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 border-2 border-t-primary rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <TaskList 
                    tasks={tasks}
                    agents={agents}
                    onExecuteTask={onExecuteTask}
                  />
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="orchestration" className="flex-1 p-4 pt-0 mt-0">
              {agents.length > 0 ? (
                <AgentOrchestration 
                  project={{
                    id: project.id || '',
                    name: project.name,
                    description: project.description,
                    mode: project.mode,
                  }}
                  agents={agents} 
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-6 max-w-md">
                    <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No agents available</h3>
                    <p className="text-gray-500">
                      Please wait for the agents to be initialized before using the orchestration feature.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Render children at the bottom of the dashboard */}
        {children && (
          <div className="p-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
