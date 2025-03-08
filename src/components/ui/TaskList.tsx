
import React from "react";
import { Task, Agent } from "@/lib/types";
import { CheckCircle2, Circle, Clock, AlertCircle, RotateCw, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TaskListProps {
  tasks: Task[];
  agents?: Agent[];
  onExecuteTask?: (taskId: string, agentId: string) => void;
  className?: string;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, agents = [], onExecuteTask, className }) => {
  const getTaskStatusIcon = (status: Task["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-gray-400" />;
      case "in_progress":
        return <RotateCw className="h-4 w-4 text-blue-500 animate-spin-slow" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTaskStatusClass = (status: Task["status"]) => {
    switch (status) {
      case "pending":
        return "text-gray-500";
      case "in_progress":
        return "text-blue-500";
      case "completed":
        return "text-green-500";
      case "failed":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const formatDate = (date: string | Date) => {
    const dateObject = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dateObject);
  };

  const getAgentNameById = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent ? agent.name : "Unassigned";
  };

  const handleExecuteTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      toast.error('Task not found');
      return;
    }
    
    const agentId = task.agent_id || task.assigned_to;
    if (!agentId) {
      toast.error('No agent assigned to this task');
      return;
    }
    
    if (onExecuteTask) {
      toast.info(`Starting task execution...`);
      onExecuteTask(taskId, agentId);
    } else {
      toast.error('Task execution function not provided');
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-lg font-semibold">Tasks</h3>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No tasks yet</div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="p-3 border rounded-md bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getTaskStatusIcon(task.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium truncate">{task.title}</h4>
                    <span className={`text-xs ${getTaskStatusClass(task.status)} ml-2`}>
                      {task.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {task.description}
                  </p>
                  
                  {(task.assigned_to || task.agent_id) && (
                    <div className="mt-2 text-xs text-gray-600">
                      Assigned to: {getAgentNameById(task.assigned_to || task.agent_id || '')}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500">
                      Updated: {formatDate(task.updated_at)}
                    </span>
                    
                    {task.status === 'pending' && (task.assigned_to || task.agent_id) && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => handleExecuteTask(task.id)}
                      >
                        <Play className="h-3 w-3" />
                        Execute
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TaskList;
