
import React, { useState } from "react";
import { Agent } from "@/lib/types";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import AgentStatus from "./AgentStatus";
import { Button } from "@/components/ui/button";
import { MessageSquare, PlayCircle, PauseCircle } from "lucide-react";

interface AgentCardProps {
  agent: Agent;
  onChat: (agentId: string) => void;
  onStart: (agentId: string) => void;
  onStop: (agentId: string) => void;
  isActive?: boolean;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, onChat, onStart, onStop, isActive = false }) => {
  const [isHovered, setIsHovered] = useState(false);

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
            <span>{agent.progress}%</span>
          </div>
          <Progress value={agent.progress} className="h-1" />
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
        {agent.status === "idle" || agent.status === "failed" ? (
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
