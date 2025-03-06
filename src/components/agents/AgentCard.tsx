
import React, { useState, useEffect } from "react";
import { Agent } from "@/lib/types";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import AgentStatus from "./AgentStatus";
import { Button } from "@/components/ui/button";
import { MessageSquare, PlayCircle, PauseCircle, RefreshCw } from "lucide-react";

interface AgentCardProps {
  agent: Agent;
  onChat: (agentId: string) => void;
  onStart: (agentId: string) => void;
  onStop: (agentId: string) => void;
  onRestart?: (agentId: string) => void;
  isActive?: boolean;
}

const AgentCard: React.FC<AgentCardProps> = ({ 
  agent, 
  onChat, 
  onStart, 
  onStop, 
  onRestart,
  isActive = false 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [animating, setAnimating] = useState(false);
  
  // Smoothly animate progress changes
  useEffect(() => {
    // Start with current value
    setProgressValue(prev => {
      // If the difference is large, start at a minimum value to show animation
      if (agent.progress > prev + 10) {
        setAnimating(true);
        return prev > 0 ? prev : agent.type === 'architect' ? 20 : 15;
      }
      return prev;
    });
    
    // Animate to target value
    const timeout = setTimeout(() => {
      setProgressValue(agent.progress || 0);
      setTimeout(() => setAnimating(false), 700); // Animation time
    }, 100);
    
    return () => clearTimeout(timeout);
  }, [agent.progress]);

  // Automatically update progress based on status and agent type
  useEffect(() => {
    if (agent.status === "completed") {
      setProgressValue(100);
    } else if (agent.status === "idle" && progressValue > 0) {
      // When paused, keep the current progress
    } else if (agent.status === "working") {
      // For working agents, ensure we show different starting progress values by agent type
      // This ensures visual differentiation between agents
      if (agent.progress === undefined || agent.progress < 15) {
        // Different base progress values for different agent types
        let baseProgress;
        switch(agent.type) {
          case 'architect':
            baseProgress = 20 + (Math.random() * 5);
            break;
          case 'frontend':
            baseProgress = 15 + (Math.random() * 8);
            break;
          case 'backend':
            baseProgress = 18 + (Math.random() * 7);
            break; 
          case 'testing':
            baseProgress = 12 + (Math.random() * 6);
            break;
          case 'devops':
            baseProgress = 16 + (Math.random() * 7);
            break;
          default:
            baseProgress = 15 + (Math.random() * 5);
        }
        
        setProgressValue(baseProgress);
        
        // Add subtle progress animation for working agents
        const interval = setInterval(() => {
          setProgressValue(prev => {
            // Subtle animation with different ranges for different agent types
            return prev + (Math.random() * 0.8);
          });
        }, 3000);
        
        return () => clearInterval(interval);
      }
    }
  }, [agent.status, agent.progress, agent.type, progressValue]);

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

  // Determine if restart button should be shown
  const showRestart = onRestart && (agent.status === "completed" || agent.status === "failed");

  return (
    <Card 
      className={`agent-card overflow-hidden border-t-4 ${getAgentColorClass()} transition-all duration-300 ease-in-out agent-card-shadow hover:translate-y-[-4px] ${isActive ? 'ring-2 ring-primary/50' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardHeader className="p-4 pb-0">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold">{agent.name}</h3>
            <AgentStatus status={agent.status} className="mt-1" />
          </div>
          <div className="text-3xl">{agent.avatar}</div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <p className="text-sm text-gray-600 min-h-[40px]">{agent.description}</p>
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
        >
          <MessageSquare className="mr-1 h-3.5 w-3.5" />
          Chat
        </Button>
        
        {showRestart ? (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
            onClick={() => onRestart(agent.id)}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Restart
          </Button>
        ) : agent.status === "idle" || agent.status === "failed" ? (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs text-green-600 border-green-200 hover:bg-green-50"
            onClick={() => onStart(agent.id)}
          >
            <PlayCircle className="mr-1 h-3.5 w-3.5" />
            Start
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
            onClick={() => onStop(agent.id)}
            disabled={agent.status === "completed"}
          >
            <PauseCircle className="mr-1 h-3.5 w-3.5" />
            Pause
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default AgentCard;
