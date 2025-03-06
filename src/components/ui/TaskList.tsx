
import React, { useEffect, useState } from "react";
import { Task, Agent } from "@/lib/types";
import { CheckCircle2, Circle, Clock, AlertCircle, RotateCw, Play, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TaskListProps {
  tasks: Task[];
  agents?: Agent[];
  onExecuteTask?: (taskId: string, agentId: string) => void;
  onRefreshTasks?: () => void;
  isLoading?: boolean;
  className?: string;
}

const TaskList: React.FC<TaskListProps> = ({ 
  tasks, 
  agents = [], 
  onExecuteTask, 
  onRefreshTasks,
  isLoading = false,
  className 
}) => {
  const [displayedTaskMap, setDisplayedTaskMap] = useState<Map<string, Set<string>>>(new Map());
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Function to normalize task titles for deduplication
  const normalizeTitle = (title: string) => {
    // Remove agent prefix if present [AgentName]
    const titleWithoutPrefix = title.replace(/^\[\w+\s+\w+\]\s+/i, '');
    return titleWithoutPrefix.toLowerCase().replace(/[^\w\s]/g, '').trim();
  };
  
  // Reset the task map when tasks change significantly
  useEffect(() => {
    if (tasks.length === 0) {
      setDisplayedTaskMap(new Map());
      console.log("Reset task map due to empty tasks array");
    }
  }, [tasks.length === 0]);
  
  const uniqueTasks = tasks.reduce((acc: Task[], task) => {
    // Skip tasks with no title
    if (!task.title || task.title.trim() === '') {
      console.log("Skipping task with empty title");
      return acc;
    }
    
    console.log(`Processing task: ${task.id} - ${task.title}`);
    const normalizedTitle = normalizeTitle(task.title);
    
    if (displayedTaskMap.has(normalizedTitle)) {
      const taskIds = displayedTaskMap.get(normalizedTitle);
      if (taskIds && taskIds.has(task.id)) {
        console.log(`Task ${task.id} already in displayed map, skipping`);
        return acc;
      }
      
      const existingTaskIndex = acc.findIndex(t => 
        normalizeTitle(t.title) === normalizedTitle
      );
      
      if (existingTaskIndex !== -1) {
        const existingTask = acc[existingTaskIndex];
        console.log(`Found existing task with similar title: ${existingTask.title}`);
        
        if (new Date(existingTask.created_at) < new Date(task.created_at)) {
          console.log(`Replacing older task ${existingTask.id} with newer ${task.id}`);
          acc.splice(existingTaskIndex, 1);
          const updatedTaskIds = new Set(displayedTaskMap.get(normalizedTitle) || []);
          updatedTaskIds.add(task.id);
          setDisplayedTaskMap(prev => {
            const newMap = new Map(prev);
            newMap.set(normalizedTitle, updatedTaskIds);
            return newMap;
          });
          acc.push(task);
        } else {
          console.log(`Keeping existing task ${existingTask.id}, it's newer than ${task.id}`);
          const updatedTaskIds = new Set(displayedTaskMap.get(normalizedTitle) || []);
          updatedTaskIds.add(task.id);
          setDisplayedTaskMap(prev => {
            const newMap = new Map(prev);
            newMap.set(normalizedTitle, updatedTaskIds);
            return newMap;
          });
        }
      } else {
        console.log(`No existing task with title ${normalizedTitle}, adding ${task.id}`);
        const updatedTaskIds = new Set(displayedTaskMap.get(normalizedTitle) || []);
        updatedTaskIds.add(task.id);
        setDisplayedTaskMap(prev => {
          const newMap = new Map(prev);
          newMap.set(normalizedTitle, updatedTaskIds);
          return newMap;
        });
        acc.push(task);
      }
    } else {
      console.log(`First occurrence of title ${normalizedTitle}, adding ${task.id}`);
      setDisplayedTaskMap(prev => {
        const newMap = new Map(prev);
        newMap.set(normalizedTitle, new Set([task.id]));
        return newMap;
      });
      acc.push(task);
    }
    
    return acc;
  }, []);
  
  console.log(`After deduplication: ${uniqueTasks.length} tasks (from original ${tasks.length})`);
  
  const finalFilteredTasks = uniqueTasks.filter((task, index, self) => {
    const isDuplicate = self.some((otherTask, otherIndex) => {
      if (index === otherIndex) return false;
      
      if (task.assigned_to === otherTask.assigned_to && 
          task.status === otherTask.status &&
          areSimilarDescriptions(task.description, otherTask.description)) {
        return new Date(task.created_at) < new Date(otherTask.created_at);
      }
      return false;
    });
    
    return !isDuplicate;
  });

  function areSimilarDescriptions(desc1: string, desc2: string): boolean {
    const start1 = desc1.substring(0, 50).toLowerCase();
    const start2 = desc2.substring(0, 50).toLowerCase();
    
    return start1 === start2;
  }

  function cleanTaskTitle(title: string): string {
    // Remove agent prefix if present [AgentName]
    return title.replace(/^\[\w+\s+\w+\]\s+/i, '');
  }
  
  function getAgentPrefixFromTitle(title: string): string | null {
    const match = title.match(/^\[(\w+\s+\w+)\]/i);
    return match ? match[1] : null;
  }

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
    if (!agents || agents.length === 0) return "Unassigned";
    const agent = agents.find(a => a.id === agentId);
    return agent ? agent.name : "Unassigned";
  };

  const formatTaskDescription = (description: string) => {
    if (description.includes('Error:')) {
      return description.replace(/Error: \[object Object\]/g, 'Error occurred - check logs for details');
    }
    return description;
  };

  const handleRefresh = () => {
    if (onRefreshTasks) {
      onRefreshTasks();
      setLastUpdated(new Date());
      toast.info("Refreshing tasks...");
    }
  };

  console.log(`Rendering ${finalFilteredTasks.length} tasks after all filtering`);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Tasks ({finalFilteredTasks.length})</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            Updated: {formatDate(lastUpdated)}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 border-2 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : finalFilteredTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No tasks yet</p>
            <p className="text-xs mt-2">Tasks will appear here as the agents generate them</p>
            {onRefreshTasks && (
              <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Refresh
              </Button>
            )}
          </div>
        ) : (
          finalFilteredTasks.map((task) => {
            const agentPrefix = getAgentPrefixFromTitle(task.title);
            const cleanTitle = cleanTaskTitle(task.title);
            
            return (
              <div
                key={task.id}
                className="p-3 border rounded-md bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getTaskStatusIcon(task.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium truncate">{cleanTitle}</h4>
                      <span className={`text-xs ${getTaskStatusClass(task.status)} ml-2`}>
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                    
                    {agentPrefix && (
                      <div className="mt-1">
                        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded-sm">
                          Created by: {agentPrefix}
                        </span>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {formatTaskDescription(task.description)}
                    </p>
                    
                    {task.assigned_to && (
                      <div className="mt-2 text-xs text-gray-600">
                        Assigned to: {getAgentNameById(task.assigned_to)}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">
                        Updated: {formatDate(task.updated_at)}
                      </span>
                      
                      {task.status === 'pending' && task.assigned_to && onExecuteTask && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => onExecuteTask(task.id, task.assigned_to as string)}
                        >
                          <Play className="h-3 w-3" />
                          Execute
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TaskList;
