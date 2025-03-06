import React, { useState, useRef, useEffect } from "react";
import AgentCard from "@/components/agents/AgentCard";
import TaskList from "@/components/ui/TaskList";
import { Agent, Task, Message } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SendHorizontal, Menu, LayoutPanelLeft, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface DashboardProps {
  agents: Agent[];
  tasks: Task[];
  messages: Message[];
  activeChat: string | null;
  onStartAgent: (agentId: string) => void;
  onStopAgent: (agentId: string) => void;
  onRestartAgent?: (agentId: string) => void;
  onChatWithAgent: (agentId: string) => void;
  onSendMessage: (message: string) => void;
  onExecuteTask?: (taskId: string, agentId: string) => void;
  project: {
    name: string;
    description: string;
    mode: string;
  };
  isLoading: {
    agents: boolean;
    tasks: boolean;
    messages: boolean;
  }
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
  isLoading
}) => {
  const [chatMessage, setChatMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [processingAgents, setProcessingAgents] = useState<Record<string, boolean>>({});
  const [refreshingTasks, setRefreshingTasks] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<string>("chat");
  const queryClient = useQueryClient();
  
  const handleRefreshTasks = async () => {
    try {
      setRefreshingTasks(true);
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setTimeout(() => setRefreshingTasks(false), 500);
    } catch (error) {
      console.error("Error refreshing tasks:", error);
      toast.error("Failed to refresh tasks");
      setRefreshingTasks(false);
    }
  };

  const handleSendMessage = () => {
    if (chatMessage.trim() && activeChat) {
      onSendMessage(chatMessage);
      setChatMessage("");
    }
  };

  const handleStartAgent = async (agentId: string) => {
    try {
      setProcessingAgents(prev => ({ ...prev, [agentId]: true }));
      await onStartAgent(agentId);
      toast.success(`Agent started successfully`);
    } catch (error) {
      console.error("Error starting agent:", error);
      toast.error(`Failed to start agent: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setProcessingAgents(prev => ({ ...prev, [agentId]: false }));
    }
  };

  const handleStopAgent = async (agentId: string) => {
    try {
      setProcessingAgents(prev => ({ ...prev, [agentId]: true }));
      await onStopAgent(agentId);
      toast.success(`Agent stopped successfully`);
    } catch (error) {
      console.error("Error stopping agent:", error);
      toast.error(`Failed to stop agent: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setProcessingAgents(prev => ({ ...prev, [agentId]: false }));
    }
  };

  const handleRestartAgent = async (agentId: string) => {
    if (onRestartAgent) {
      try {
        setProcessingAgents(prev => ({ ...prev, [agentId]: true }));
        await onRestartAgent(agentId);
        toast.success(`Agent restarted successfully`);
      } catch (error) {
        console.error("Error restarting agent:", error);
        toast.error(`Failed to restart agent: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        setProcessingAgents(prev => ({ ...prev, [agentId]: false }));
      }
    }
  };

  const getActiveAgentName = () => {
    if (!activeChat) return "";
    const agent = agents.find(a => a.id === activeChat);
    return agent ? agent.name : "";
  };

  const filteredMessages = messages.filter(m => 
    !activeChat || // Show all messages when no agent is selected
    m.sender === "You" || // Always show user messages
    m.sender === getActiveAgentName() // Show only selected agent's messages
  );

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredMessages]);

  useEffect(() => {
    if (activeChat && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [activeChat]);

  useEffect(() => {
    const architectAgent = agents.find(a => a.type === 'architect');
    if (architectAgent && architectAgent.status === 'working') {
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }, 15000);
      
      return () => clearInterval(interval);
    }
  }, [agents, queryClient]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-73px)]">
      <div className="md:hidden flex items-center justify-between p-3 border-b">
        <div className="flex items-center">
          <Button
            variant="ghost" 
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mr-2"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold truncate max-w-[180px]">
            {activeChat ? `Chat with ${getActiveAgentName()}` : project.name}
          </h2>
        </div>
        {activeChat && (
          <Badge variant="secondary" className="text-xs">
            Active
          </Badge>
        )}
      </div>
      
      <div 
        className={`
          ${sidebarOpen ? 'block' : 'hidden'} 
          md:block w-full md:w-1/4 border-r bg-gray-50 
          overflow-auto h-full md:h-auto
          ${sidebarOpen ? 'fixed z-30 inset-0 md:static md:z-auto bg-white md:bg-gray-50' : ''}
          pt-safe-top pb-safe-bottom
          max-h-[calc(100vh-73px)]
        `}
      >
        {sidebarOpen && (
          <div className="md:hidden flex justify-end p-3">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
              <span className="sr-only">Close sidebar</span>
              ✕
            </Button>
          </div>
        )}
        
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-3">Project</h2>
          <div className="mb-4 bg-white p-3 rounded-md border">
            <h3 className="font-medium">{project.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{project.description}</p>
            <div className="mt-2">
              <Badge variant="secondary" className="text-xs">
                {project.mode === 'existing' ? 'Existing Project' : 'New Project'}
              </Badge>
            </div>
          </div>
          
          <h2 className="text-lg font-semibold mb-3">Agents</h2>
          {isLoading.agents ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 border-2 border-t-primary rounded-full animate-spin"></div>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-4 text-gray-500 bg-white rounded-md border p-4">
              <p>No agents available</p>
              <p className="text-xs mt-2">Agents are being initialized. Please wait or refresh the page.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onChat={onChatWithAgent}
                  onStart={handleStartAgent}
                  onStop={handleStopAgent}
                  onRestart={onRestartAgent ? handleRestartAgent : undefined}
                  isActive={activeChat === agent.id}
                  isProcessing={!!processingAgents[agent.id]}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col ${sidebarOpen ? 'hidden md:flex' : 'flex'}`}>
        {isMobile ? (
          <Tabs 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col"
          >
            <TabsList className="w-full justify-between rounded-none border-b">
              <TabsTrigger value="chat" className="flex-1">
                Chat
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex-1">
                <LayoutPanelLeft className="h-4 w-4 mr-1" />
                Tasks
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="chat" className="flex-1 flex flex-col p-0 m-0 data-[state=active]:flex data-[state=inactive]:hidden">
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-[calc(100vh-180px)] md:h-[calc(100vh-220px)]">
                  <div className="space-y-4 p-4">
                    {isLoading.messages ? (
                      <div className="flex justify-center py-8">
                        <div className="h-6 w-6 border-2 border-t-primary rounded-full animate-spin"></div>
                      </div>
                    ) : filteredMessages.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {activeChat 
                          ? "No messages yet. Start a conversation with this agent." 
                          : "Select an agent from the sidebar to start a conversation."}
                      </div>
                    ) : (
                      filteredMessages.map((message) => (
                        <div key={message.id} className="animate-fade-in">
                          <div className="flex items-start gap-2 mb-1">
                            <div className="font-medium text-sm">{message.sender}</div>
                            <div className="text-xs text-gray-500 pt-1">
                              {message.created_at && new Date(message.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </div>
                          </div>
                          <div className="pl-2 border-l-2 border-gray-200 text-sm text-gray-700 break-words">
                            {message.content}
                          </div>
                          <Separator className="mt-4" />
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </div>
              
              <div className="p-3 md:p-4 border-t mt-auto">
                <div className="flex gap-2">
                  <Input
                    placeholder={activeChat ? "Type a message..." : "Select an agent to chat"}
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    disabled={!activeChat}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
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
            </TabsContent>
            
            <TabsContent value="tasks" className="flex-1 p-4 overflow-auto m-0 data-[state=active]:flex data-[state=inactive]:hidden">
              {isLoading.tasks || refreshingTasks ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 border-2 border-t-primary rounded-full animate-spin"></div>
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-white rounded-md border p-4">
                  <p>No tasks available</p>
                  <p className="text-xs mt-2">Tasks will appear here when agents create them.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={handleRefreshTasks}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              ) : (
                <TaskList 
                  tasks={tasks}
                  agents={agents}
                  onExecuteTask={onExecuteTask}
                  onRefreshTasks={handleRefreshTasks}
                  isLoading={refreshingTasks}
                />
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0">
            <div className="border-r flex flex-col h-full overflow-hidden">
              <div className="border-b p-4 hidden md:block">
                <h2 className="text-lg font-semibold">
                  {activeChat 
                    ? `Chat with ${getActiveAgentName()}`
                    : 'Agent Communication'
                  }
                </h2>
              </div>
              
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-[calc(100vh-200px)] md:h-[calc(100vh-220px)]">
                  <div className="space-y-4 p-4">
                    {isLoading.messages ? (
                      <div className="flex justify-center py-8">
                        <div className="h-6 w-6 border-2 border-t-primary rounded-full animate-spin"></div>
                      </div>
                    ) : filteredMessages.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {activeChat 
                          ? "No messages yet. Start a conversation with this agent." 
                          : "Select an agent from the sidebar to start a conversation."}
                      </div>
                    ) : (
                      filteredMessages.map((message) => (
                        <div key={message.id} className="animate-fade-in">
                          <div className="flex items-start gap-2 mb-1">
                            <div className="font-medium text-sm">{message.sender}</div>
                            <div className="text-xs text-gray-500 pt-1">
                              {message.created_at && new Date(message.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </div>
                          </div>
                          <div className="pl-2 border-l-2 border-gray-200 text-sm text-gray-700 break-words">
                            {message.content}
                          </div>
                          <Separator className="mt-4" />
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </div>
              
              <div className="p-3 md:p-4 border-t mt-auto">
                <div className="flex gap-2">
                  <Input
                    placeholder={activeChat ? "Type a message..." : "Select an agent to chat"}
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    disabled={!activeChat}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
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
            
            <div className="hidden md:block p-4 bg-gray-50 overflow-auto h-[calc(100vh-73px)]">
              {isLoading.tasks || refreshingTasks ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 border-2 border-t-primary rounded-full animate-spin"></div>
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-white rounded-md border p-4">
                  <p>No tasks available</p>
                  <p className="text-xs mt-2">Tasks will appear here when agents create them.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={handleRefreshTasks}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              ) : (
                <TaskList 
                  tasks={tasks}
                  agents={agents}
                  onExecuteTask={onExecuteTask}
                  onRefreshTasks={handleRefreshTasks}
                  isLoading={refreshingTasks}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
