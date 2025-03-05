
import React, { useState } from "react";
import AgentCard from "@/components/agents/AgentCard";
import TaskList from "@/components/ui/TaskList";
import { Agent, Task, Message } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SendHorizontal } from "lucide-react";

interface DashboardProps {
  agents: Agent[];
  tasks: Task[];
  messages: Message[];
  activeChat: string | null;
  onStartAgent: (agentId: string) => void;
  onStopAgent: (agentId: string) => void;
  onChatWithAgent: (agentId: string) => void;
  onSendMessage: (message: string) => void;
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
  onChatWithAgent,
  onSendMessage,
  project,
  isLoading
}) => {
  const [chatMessage, setChatMessage] = useState("");

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

  const filteredMessages = messages.filter(m => 
    !activeChat || // Show all messages when no agent is selected
    m.sender === "You" || // Always show user messages
    m.sender === getActiveAgentName() // Show only selected agent's messages
  );

  return (
    <div className="flex h-[calc(100vh-73px)]">
      {/* Left sidebar with agents */}
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
        ) : (
          <div className="grid gap-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onChat={onChatWithAgent}
                onStart={onStartAgent}
                onStop={onStopAgent}
                isActive={activeChat === agent.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Chat section */}
          <div className="border-r flex flex-col">
            <div className="border-b p-4">
              <h2 className="text-lg font-semibold">
                {activeChat 
                  ? `Chat with ${getActiveAgentName()}`
                  : 'Agent Communication'
                }
              </h2>
            </div>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {isLoading.messages ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 border-2 border-t-primary rounded-full animate-spin"></div>
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No messages yet. Start a conversation with an agent.
                  </div>
                ) : (
                  filteredMessages.map((message) => (
                    <div key={message.id} className="animate-fade-in">
                      <div className="flex items-start gap-2 mb-1">
                        <div className="font-medium text-sm">{message.sender}</div>
                        <div className="text-xs text-gray-500 pt-1">
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </div>
                      </div>
                      <div className="pl-2 border-l-2 border-gray-200 text-sm text-gray-700">
                        {message.content}
                      </div>
                      <Separator className="mt-4" />
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            
            <div className="p-4 border-t">
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
          
          {/* Tasks section */}
          <div className="p-4 bg-gray-50 overflow-auto">
            {isLoading.tasks ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 border-2 border-t-primary rounded-full animate-spin"></div>
              </div>
            ) : (
              <TaskList tasks={tasks} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
