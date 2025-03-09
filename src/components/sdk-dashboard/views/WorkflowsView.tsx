
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { SDKService, Workflow } from '@/services/openRouterSDK';
import { toast } from 'sonner';
import { Plus, Play, Edit, ArrowUpRight, Clock, CheckCircle, AlertCircle, RotateCw } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

const WorkflowsView: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    tasks: [] as string[],
    project_id: 'default-project' // Default project ID
  });

  useEffect(() => {
    loadWorkflows();
  }, []);

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

  const handleCreateWorkflow = async () => {
    try {
      if (!newWorkflow.name.trim()) {
        toast.error('Workflow name is required');
        return;
      }
      
      const workflow = await SDKService.createWorkflow(newWorkflow);
      setWorkflows(prev => [...prev, workflow]);
      setOpenDialog(false);
      setNewWorkflow({ name: '', description: '', tasks: [], project_id: 'default-project' });
      toast.success(`Workflow "${workflow.name}" created successfully`);
    } catch (error) {
      console.error('Error creating workflow:', error);
      toast.error('Failed to create workflow');
    }
  };

  const handleExecuteWorkflow = async (workflowId: string) => {
    try {
      setExecuting(workflowId);
      await SDKService.executeWorkflow(workflowId);
      toast.success('Workflow execution started');
      
      // Update the workflow status in the UI
      setWorkflows(prevWorkflows => 
        prevWorkflows.map(w => 
          w.id === workflowId 
            ? { ...w, status: 'in_progress' } 
            : w
        )
      );
      
      // Refresh workflows after a delay to get updated status
      setTimeout(() => {
        loadWorkflows();
        setExecuting(null);
      }, 2000);
    } catch (error) {
      console.error('Error executing workflow:', error);
      toast.error('Failed to execute workflow');
      setExecuting(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'in_progress':
        return <RotateCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Workflows</h1>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button className="flex items-center">
              <Plus size={16} className="mr-2" />
              New Workflow
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Workflow</DialogTitle>
              <DialogDescription>
                Create a workflow to automate a series of tasks.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workflow Name</label>
                <Input 
                  placeholder="Enter workflow name" 
                  value={newWorkflow.name} 
                  onChange={e => setNewWorkflow(prev => ({ ...prev, name: e.target.value }))} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <Textarea 
                  placeholder="Enter workflow description" 
                  value={newWorkflow.description} 
                  onChange={e => setNewWorkflow(prev => ({ ...prev, description: e.target.value }))} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tasks</label>
                <p className="text-xs text-gray-500 mb-2">Tasks will be executed in the specified order.</p>
                <Select 
                  value={newWorkflow.tasks.join(',')} 
                  onValueChange={(value) => setNewWorkflow(prev => ({ ...prev, tasks: value ? value.split(',') : [] }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tasks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task-1,task-2">Initialize Project + Design Components</SelectItem>
                    <SelectItem value="task-3,task-4">Data Analysis Pipeline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleCreateWorkflow}>Create Workflow</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      {loading ? (
        <div className="grid gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Play size={20} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">No workflows available</h3>
          <p className="text-gray-500 mb-6">Create your first workflow to automate AI agent tasks</p>
          <Button onClick={() => setOpenDialog(true)}>
            <Plus size={16} className="mr-2" />
            Create First Workflow
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6">
          {workflows.map(workflow => (
            <Card key={workflow.id} className="border border-gray-200">
              <CardHeader className="p-4 border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{workflow.name}</CardTitle>
                    <p className="text-sm text-gray-500">{workflow.description}</p>
                  </div>
                  <div className="flex items-center space-x-1 bg-gray-100 px-2 py-1 rounded-full">
                    {getStatusIcon(workflow.status)}
                    <span className="text-xs capitalize">{workflow.status.replace('_', ' ')}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">Tasks</h4>
                  <div className="space-y-2">
                    {workflow.tasks.map((taskId, index) => (
                      <div key={index} className="flex items-center text-sm border border-gray-200 rounded-md p-2">
                        <span className="bg-gray-100 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center mr-2">
                          {index + 1}
                        </span>
                        <span className="flex-1">{taskId}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="mt-4 flex justify-between items-center">
                  <div className="flex items-center">
                    <span className="text-sm text-gray-500 mr-2">Progress:</span>
                    <div className="w-24 h-2 bg-gray-200 rounded-full">
                      <div 
                        className="h-full bg-blue-500 rounded-full" 
                        style={{ width: `${workflow.progress}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 ml-2">{workflow.progress}%</span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex items-center" 
                      onClick={() => handleExecuteWorkflow(workflow.id)}
                      disabled={workflow.status === 'in_progress' || executing === workflow.id}
                    >
                      {executing === workflow.id ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play size={14} className="mr-1" />
                          Execute
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex items-center"
                    >
                      <Edit size={14} className="mr-1" />
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="flex items-center text-blue-600"
                    >
                      Details
                      <ArrowUpRight size={14} className="ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowsView;
