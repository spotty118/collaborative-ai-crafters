
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, GitBranch } from 'lucide-react';
import { SDKService } from '@/services/openRouterSDK';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const WorkflowsView: React.FC = () => {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        setLoading(true);
        const data = await SDKService.getWorkflows();
        setWorkflows(data);
      } catch (error) {
        console.error('Error loading workflows:', error);
        toast.error('Failed to load workflows');
      } finally {
        setLoading(false);
      }
    };
    
    loadWorkflows();
  }, []);

  // Progress bar component
  const ProgressBar = ({ progress }: { progress: number }) => (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div
        className="bg-blue-600 h-2.5 rounded-full"
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Workflows</h1>
        <Button className="flex items-center">
          <Plus size={16} className="mr-2" />
          New Workflow
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i} className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-2 w-full" />
                <div className="flex space-x-2 pt-2">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-24" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <Card className="p-8 text-center">
          <GitBranch size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">No workflows available</h3>
          <p className="text-gray-500 mb-6">Create a workflow to orchestrate tasks</p>
          <Button>
            <Plus size={16} className="mr-2" />
            Create First Workflow
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {workflows.map(workflow => (
            <Card key={workflow.id} className="p-6 border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-gray-800">{workflow.name}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium
                  ${workflow.status === 'completed' ? 'bg-green-100 text-green-800' : 
                  workflow.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 
                  'bg-gray-100 text-gray-800'}`}>
                  {workflow.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">Tasks: {workflow.tasks.length} total</p>
              <div className="mb-4">
                <ProgressBar progress={workflow.progress} />
              </div>
              <div className="flex space-x-2">
                <Button size="sm" className="flex items-center">
                  <Play size={14} className="mr-1" />
                  Execute
                </Button>
                <Button variant="outline" size="sm" className="flex items-center">
                  <Edit size={14} className="mr-1" />
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowsView;
