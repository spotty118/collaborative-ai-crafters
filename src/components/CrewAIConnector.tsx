
import { useState, useEffect, useRef } from 'react';
import { useCrewAIApi } from '../hooks/useCrewAIApi';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

interface CrewAIConnectorProps {
  onResultReceived?: (result: Record<string, unknown>) => void;
}

export default function CrewAIConnector({ onResultReceived }: CrewAIConnectorProps) {
  const [inputValues, setInputValues] = useState<Record<string, unknown>>({});
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastToastTimeRef = useRef<number>(0);
  
  // Optimized toast function to prevent spamming
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const now = Date.now();
    // Only show a toast if it's been at least 2 seconds since the last one
    if (now - lastToastTimeRef.current > 2000) {
      // Clear any pending toasts
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      
      // Show the toast based on type
      if (type === 'success') {
        toast.success(message);
      } else if (type === 'error') {
        toast.error(message);
      } else {
        toast(message);
      }
      
      lastToastTimeRef.current = now;
    }
  };
  
  const {
    isLoading,
    requiredInputs,
    taskId,
    taskStatus,
    taskResult,
    getRequiredInputs,
    startCrew,
    checkTaskStatus,
  } = useCrewAIApi({
    onSuccess: (data) => {
      console.log('API operation completed successfully:', data);
      
      // If we received a task result and it has a result property, call the onResultReceived callback
      if (taskResult && onResultReceived) {
        onResultReceived(taskResult);
        showToast("Task completed successfully!", "success");
      }
    },
    onError: (error) => {
      console.error('API operation failed:', error);
      showToast(`API operation failed: ${error.message}`, "error");
    },
  });

  // Fetch required inputs when component mounts
  useEffect(() => {
    getRequiredInputs();
  }, [getRequiredInputs]);

  // Poll for task status when taskId changes, using a more efficient approach
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (taskId) {
      // Initial check
      checkTaskStatus();
      
      // Set polling with increasing intervals for better performance
      let interval = 5000; // Start with 5 seconds
      const maxInterval = 15000; // Max 15 seconds
      
      const poll = () => {
        checkTaskStatus();
        
        // Increase interval if task is progressing to reduce load
        if (taskStatus?.progress && taskStatus.progress > 50) {
          interval = Math.min(interval * 1.5, maxInterval);
        }
        
        intervalId = setTimeout(poll, interval);
      };
      
      intervalId = setTimeout(poll, interval);
    }
    
    return () => {
      if (intervalId) {
        clearTimeout(intervalId);
      }
    };
  }, [taskId, checkTaskStatus, taskStatus]);

  // Handle input change
  const handleInputChange = (name: string, value: string) => {
    setInputValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Start a new CrewAI task
  const handleStartTask = async () => {
    // Validate that all required inputs have values
    if (requiredInputs) {
      const missingRequiredInputs = requiredInputs
        .filter((input) => input.required && !inputValues[input.name])
        .map((input) => input.name);

      if (missingRequiredInputs.length > 0) {
        showToast(`Please provide values for: ${missingRequiredInputs.join(', ')}`, "error");
        return;
      }
    }

    try {
      await startCrew(inputValues);
      showToast("CrewAI task started!", "success");
    } catch (error) {
      showToast("Failed to start CrewAI task. Using mock data instead.", "error");
    }
  };

  // Render a form field based on input type
  const renderInputField = (input: { name: string; type: string; description: string; required: boolean }) => {
    switch (input.type.toLowerCase()) {
      case 'text':
      case 'string':
        return (
          <Input
            id={input.name}
            value={(inputValues[input.name] as string) || ''}
            onChange={(e) => handleInputChange(input.name, e.target.value)}
            placeholder={input.description}
            disabled={isLoading || !!taskId}
          />
        );
      case 'textarea':
      case 'longtext':
        return (
          <Textarea
            id={input.name}
            value={(inputValues[input.name] as string) || ''}
            onChange={(e) => handleInputChange(input.name, e.target.value)}
            placeholder={input.description}
            disabled={isLoading || !!taskId}
          />
        );
      default:
        return (
          <Input
            id={input.name}
            value={(inputValues[input.name] as string) || ''}
            onChange={(e) => handleInputChange(input.name, e.target.value)}
            placeholder={input.description}
            disabled={isLoading || !!taskId}
          />
        );
    }
  };

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (!taskStatus) return 0;
    if (taskStatus.status === 'completed') return 100;
    if (taskStatus.status === 'failed') return 100;
    return taskStatus.progress || 0;
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">CrewAI Connector</h2>

      {/* Required inputs form */}
      {requiredInputs && requiredInputs.length > 0 && !taskId && (
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold">Input Parameters</h3>
          {requiredInputs.map((input) => (
            <div key={input.name} className="space-y-2">
              <Label htmlFor={input.name}>
                {input.name} {input.required && <span className="text-red-500">*</span>}
              </Label>
              {renderInputField(input)}
              <p className="text-sm text-gray-500">{input.description}</p>
            </div>
          ))}
          <Button
            onClick={handleStartTask}
            disabled={isLoading}
            className="mt-4"
          >
            {isLoading ? 'Starting...' : 'Start CrewAI Task'}
          </Button>
        </div>
      )}

      {/* Show loading indicator while fetching inputs */}
      {isLoading && !requiredInputs && (
        <div className="text-center py-6">
          <p>Loading required inputs...</p>
        </div>
      )}

      {/* Task status */}
      {taskId && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Task Status</h3>
            <div className="text-sm bg-gray-100 px-2 py-1 rounded">
              ID: {taskId}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Status: {taskStatus?.status || 'pending'}</span>
              <span>{getProgressPercentage()}%</span>
            </div>
            <Progress value={getProgressPercentage()} className="h-2" />
          </div>

          {/* Task result */}
          {taskStatus?.status === 'completed' && taskResult && (
            <div className="mt-6 space-y-2">
              <h3 className="text-lg font-semibold">Result</h3>
              <pre className="bg-gray-50 p-4 rounded overflow-auto max-h-60">
                {JSON.stringify(taskResult, null, 2)}
              </pre>
            </div>
          )}

          {/* Task error */}
          {taskStatus?.status === 'failed' && (
            <div className="mt-6 space-y-2">
              <h3 className="text-lg font-semibold text-red-600">Error</h3>
              <div className="bg-red-50 text-red-700 p-4 rounded">
                {taskStatus.error || 'An unknown error occurred'}
              </div>
            </div>
          )}

          {/* New task button */}
          {(taskStatus?.status === 'completed' || taskStatus?.status === 'failed') && (
            <Button
              onClick={() => window.location.reload()}
              className="mt-4"
            >
              Start New Task
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
