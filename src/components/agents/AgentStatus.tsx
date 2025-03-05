
import React from "react";
import { AgentStatus as AgentStatusType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AgentStatusProps {
  status: AgentStatusType;
  className?: string;
}

const AgentStatus: React.FC<AgentStatusProps> = ({ status, className }) => {
  const getStatusColor = () => {
    switch (status) {
      case "idle":
        return "bg-gray-300";
      case "working":
        return "bg-blue-500 animate-pulse-light";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      case "waiting":
        return "bg-yellow-400";
      default:
        return "bg-gray-300";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "idle":
        return "Idle";
      case "working":
        return "Working";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      case "waiting":
        return "Waiting";
      default:
        return "Unknown";
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={`${getStatusColor()} w-2.5 h-2.5 rounded-full`} />
      <span className="text-xs font-medium text-gray-600">{getStatusText()}</span>
    </div>
  );
};

export default AgentStatus;
