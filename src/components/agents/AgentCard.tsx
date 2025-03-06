
import React, { useState, useEffect } from "react";
import { Agent } from "@/lib/types";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import AgentStatus from "./AgentStatus";
import { Button } from "@/components/ui/button";
import { MessageSquare, PlayCircle, PauseCircle, RefreshCw, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AgentCardProps {
  agent: Agent;
  onChat: (agentId: string) => void;
  onStart: (agentId: string) => void;
  onStop: (agentId: string) => void;
  onRestart?: (agentId: string) => void;
  isActive?: boolean;
  isProcessing?: boolean;
}

const AgentCard: React.FC<AgentCardProps> = ({ 
  agent, 
  onChat, 
  onStart, 
  onStop, 
  onRestart,
  isActive = false,
  isProcessing = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [progressValue, setProgressValue] = useState(agent.progress || 0);
  const [animating, setAnimating] = useState(false);
  
  // Only update progress value when it significantly changes
  useEffect(() => {
    // Only update if the difference is significant to avoid infinite loops
    if (agent.progress !== undefined && Math.abs(agent.progress - progressValue) >= 1) {
      setProgressValue(agent.progress);
      
      // Trigger animation for significant changes
      if (Math.abs(agent.progress - progressValue) > 5) {
        setAnimating(true);
        const timer = setTimeout(() => setAnimating(false), 800);
        return () => clearTimeout(timer);
      }
    }
  }, [agent.progress, progressValue]);

  const getAgentColorClass = () => {
    switch (agent.type) {
      case "architect":
        return "border-t-blue-500";
      case "frontend":
        return "border-t-purple-500";
      case "backend":
        return "border-t-green-500";
      case "testing":
        return "border-t-yellow-500";
      case "devops":
        return "border-t-red-500";
      default:
        return "border-t-gray-500";
    }
  };

  // Handle starting agent with error handling
  const handleStartAgent = () => {
    try {
      if (agent.type === "architect") {
        toast.info("Starting Architect. The team will begin generating tasks shortly.");
      }
      onStart(agent.id);
    } catch (error) {
      console.error("Failed to start agent:", error);
      toast.error(`Failed to start ${agent.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Handle stopping agent with error handling
  const handleStopAgent = () => {
    try {
      onStop(agent.id);
    } catch (error) {
      console.error("Failed to stop agent:", error);
      toast.error(`Failed to stop ${agent.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Handle restarting agent with error handling
  const handleRestartAgent = () => {
    if (onRestart) {
      try {
        onRestart(agent.id);
      } catch (error) {
        console.error("Failed to restart agent:", error);
        toast.error(`Failed to restart ${agent.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  };

  // Determine if restart button should be shown
  const showRestart = onRestart && (agent.status === "completed" || agent.status === "failed");

  // Is this the architect agent?
  const isArchitect = agent.type === "architect";
  
  // Is the agent currently working?
  const isWorking = agent.status === "working";

  return (
    <Card 
      className={`agent-card overflow-hidden border-t-4 ${getAgentColorClass()} transition-all duration-300 ease-in-out agent-card-shadow hover:translate-y-[-4px] ${isActive ? 'ring-2 ring-primary/50' : ''} ${isArchitect ? 'shadow-md' : ''} ${isWorking ? 'bg-blue-50/50' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardHeader className="p-4 pb-0">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold flex items-center">
              {agent.name}
              {isArchitect && (
                <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full flex items-center">
                  <Users className="h-3 w-3 mr-1" />
                  Lead
                </span>
              )}
            </h3>
            <div className="flex items-center mt-1">
              <AgentStatus status={agent.status} className="" />
              {isWorking && <Loader2 className="ml-2 h-3 w-3 animate-spin text-blue-500" />}
            </div>
          </div>
          <div className="text-3xl">{agent.avatar}</div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <p className="text-sm text-gray-600 min-h-[40px]">
          {agent.status === "working" && isArchitect 
            ? "Generating tasks and coordinating with the team..." 
            : agent.status === "working"
            ? "Working on assigned tasks..."
            : agent.description}
        </p>
        <div className="mt-3">
          <div className="flex justify-between mb-1 text-xs">
            <span>Progress</span>
            <span>{Math.round(progressValue)}%</span>
          </div>
          <Progress 
            value={progressValue} 
            className={`h-2 transition-all duration-700 ease-in-out ${animating ? 'progress-animating' : ''}`} 
          />
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button
          variant={isActive ? "default" : "outline"}
          size="sm"
          className="flex-1 text-xs"
          onClick={() => onChat(agent.id)}
          disabled={isProcessing}
        >
          <MessageSquare className="mr-1 h-3.5 w-3.5" />
          Chat
        </Button>
        
        {showRestart ? (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
            onClick={handleRestartAgent}
            disabled={isProcessing}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Restart
          </Button>
        ) : agent.status === "idle" || agent.status === "failed" ? (
          <Button
            variant={isArchitect ? "default" : "outline"}
            size="sm"
            className={`flex-1 text-xs ${isArchitect ? 'bg-blue-600 hover:bg-blue-700' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
            onClick={handleStartAgent}
            disabled={isProcessing}
          >
            <PlayCircle className="mr-1 h-3.5 w-3.5" />
            {isProcessing ? "Starting..." : isArchitect ? "Start Team" : "Start"}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
            onClick={handleStopAgent}
            disabled={agent.status === "completed" || isProcessing}
          >
            <PauseCircle className="mr-1 h-3.5 w-3.5" />
            {isProcessing ? "Stopping..." : "Pause"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default AgentCard;
