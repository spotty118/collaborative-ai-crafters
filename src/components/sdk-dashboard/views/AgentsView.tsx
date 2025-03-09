
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Play, Edit, User } from 'lucide-react';
import { SDKService } from '@/services/openRouterSDK';
import { Agent, AgentType } from '@/lib/types';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const AgentsView: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  
  // New agent form state
  const [newAgent, setNewAgent] = useState({
    name: '',
    type: 'architect' as AgentType,
    description: ''
  });
  
  // Execution state
  const [executionAgent, setExecutionAgent] = useState<Agent | null>(null);
  const [prompt, setPrompt] = useState('');
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState('');

  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoading(true);
        const data = await SDKService.getAgents();
        setAgents(data);
      } catch (error) {
        console.error('Error loading agents:', error);
        toast.error('Failed to load agents');
      } finally {
        setLoading(false);
      }
    };
    
    loadAgents();
  }, []);

  const handleCreateAgent = async () => {
    try {
      if (!newAgent.name.trim()) {
        toast.error('Agent name is required');
        return;
      }
      
      const agent = await SDKService.createAgent(newAgent);
      setAgents(prev => [...prev, agent]);
      setOpenDialog(false);
      setNewAgent({ name: '', type: 'architect', description: '' });
    } catch (error) {
      console.error('Error creating agent:', error);
      toast.error('Failed to create agent');
    }
  };

  const handleExecuteAgent = async (agent: Agent) => {
    setExecutionAgent(agent);
    setPrompt('');
    setExecutionResult('');
  };

  const handleSendPrompt = async () => {
    if (!executionAgent || !prompt.trim()) {
      toast.error('Agent and prompt are required');
      return;
    }
    
    try {
      setExecuting(true);
      const result = await SDKService.executeAgent(executionAgent, prompt);
      setExecutionResult(result);
    } catch (error) {
      console.error('Error executing agent:', error);
      toast.error('Failed to execute agent');
    } finally {
      setExecuting(false);
    }
  };

  const AgentCard = ({ agent }: { agent: Agent }) => (
    <Card className="p-6 border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-bold text-gray-800">{agent.name}</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium
          ${agent.status === 'working' ? 'bg-green-100 text-green-800' : 
          'bg-gray-100 text-gray-800'}`}>
          {agent.status}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">Type: {agent.type}</p>
      <p className="text-sm text-gray-600 mb-6">{agent.description}</p>
      <div className="flex space-x-2">
        <Button
          size="sm"
          className="flex items-center" 
          onClick={() => handleExecuteAgent(agent)}
        >
          <Play size={14} className="mr-1" />
          Execute
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center"
        >
          <Edit size={14} className="mr-1" />
          Edit
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Agents</h1>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button className="flex items-center">
              <Plus size={16} className="mr-2" />
              New Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
                <Input 
                  placeholder="Enter agent name" 
                  value={newAgent.name} 
                  onChange={e => setNewAgent(prev => ({ ...prev, name: e.target.value }))} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agent Type</label>
                <Select 
                  value={newAgent.type} 
                  onValueChange={value => setNewAgent(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="architect">Architect</SelectItem>
                    <SelectItem value="frontend">Frontend Developer</SelectItem>
                    <SelectItem value="backend">Backend Developer</SelectItem>
                    <SelectItem value="testing">Testing Engineer</SelectItem>
                    <SelectItem value="devops">DevOps Engineer</SelectItem>
                    <SelectItem value="custom">Custom Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <Textarea 
                  placeholder="Enter agent description" 
                  value={newAgent.description} 
                  onChange={e => setNewAgent(prev => ({ ...prev, description: e.target.value }))} 
                />
              </div>
              <Button className="w-full" onClick={handleCreateAgent}>Create Agent</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <div className="flex space-x-2 pt-2">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-24" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <Card className="p-8 text-center">
          <User size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">No agents available</h3>
          <p className="text-gray-500 mb-6">Create an agent to get started with the OpenRouter SDK</p>
          <Button onClick={() => setOpenDialog(true)}>
            <Plus size={16} className="mr-2" />
            Create First Agent
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map(agent => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
          
          {executionAgent && (
            <Card className="mt-8 p-6">
              <div className="flex items-center mb-4">
                <User size={20} className="text-blue-600 mr-2" />
                <h3 className="text-lg font-bold text-gray-800">Execute Agent: {executionAgent.name}</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
                  <Textarea 
                    placeholder="Enter your prompt for the agent" 
                    value={prompt} 
                    onChange={e => setPrompt(e.target.value)} 
                    rows={4}
                  />
                </div>
                <Button 
                  onClick={handleSendPrompt} 
                  disabled={executing || !prompt.trim()}
                  className="w-full"
                >
                  {executing ? 'Processing...' : 'Send Prompt'}
                </Button>
                
                {executionResult && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Result</label>
                    <div className="bg-gray-50 rounded-md p-4 border border-gray-200 whitespace-pre-wrap">
                      {executionResult}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default AgentsView;
