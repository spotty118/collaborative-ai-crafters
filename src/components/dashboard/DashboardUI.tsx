
import React, { useState } from 'react';
import { Monitor, User, CheckSquare, GitBranch, Database, Code, Settings, Plus, Play, Edit, Trash, Search, BarChart } from 'lucide-react';
import { Agent, Task, AgentStatus, TaskStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: string;
}

interface ProgressBarProps {
  progress: number;
}

interface DashboardUIProps {
  agents: Agent[];
  tasks: Task[];
  onStartAgent?: (agentId: string) => void;
  onEditAgent?: (agentId: string) => void;
  onExecuteTask?: (taskId: string, agentId: string) => void;
}

const DashboardUI: React.FC<DashboardUIProps> = ({
  agents = [],
  tasks = [],
  onStartAgent,
  onEditAgent,
  onExecuteTask
}) => {
  const [activeTab, setActiveTab] = useState('agents');
  
  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: <Monitor size={18} /> },
    { id: 'agents', name: 'Agents', icon: <User size={18} /> },
    { id: 'tasks', name: 'Tasks', icon: <CheckSquare size={18} /> },
    { id: 'workflows', name: 'Workflows', icon: <GitBranch size={18} /> },
    { id: 'knowledge', name: 'Knowledge Bases', icon: <Database size={18} /> },
    { id: 'functions', name: 'Functions', icon: <Code size={18} /> },
    { id: 'settings', name: 'Settings', icon: <Settings size={18} /> },
  ];
  
  // Sample data for tabs that aren't yet connected to real data
  const workflows = [
    {
      id: 'workflow-1',
      name: 'Research & Write',
      tasks: ['task-1', 'task-2'],
      status: 'in_progress',
      progress: 50,
      tasksCompleted: 1,
      totalTasks: 2
    },
    {
      id: 'workflow-2',
      name: 'Market Analysis',
      tasks: ['task-1', 'task-3'],
      status: 'pending',
      progress: 25,
      tasksCompleted: 1,
      totalTasks: 4
    }
  ];
  
  const knowledgeBases = [
    {
      id: 'kb-1',
      name: 'Research Knowledge',
      documents: 74,
      lastUpdated: '2025-03-08T16:30:00Z'
    },
    {
      id: 'kb-2',
      name: 'Market Data',
      documents: 128,
      lastUpdated: '2025-03-07T11:45:00Z'
    }
  ];
  
  const functions = [
    {
      id: 'func-1',
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: ['location', 'units']
    },
    {
      id: 'func-2',
      name: 'search_web',
      description: 'Search the web for information',
      parameters: ['query', 'limit']
    }
  ];
  
  // Function to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Status badge component
  const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    let bgColor = '';
    let textColor = '';
    
    switch(status) {
      case 'working':
      case 'completed':
        bgColor = 'bg-green-100';
        textColor = 'text-green-800';
        break;
      case 'in_progress':
        bgColor = 'bg-blue-100';
        textColor = 'text-blue-800';
        break;
      case 'pending':
      case 'waiting':
        bgColor = 'bg-yellow-100';
        textColor = 'text-yellow-800';
        break;
      case 'inactive':
      case 'idle':
      case 'failed':
        bgColor = 'bg-gray-100';
        textColor = 'text-gray-800';
        break;
      default:
        bgColor = 'bg-gray-100';
        textColor = 'text-gray-800';
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };
  
  // Progress bar component
  const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
    return (
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    );
  };
  
  // Map agent data to the format expected by this UI
  const mappedAgents = agents.map(agent => ({
    id: agent.id,
    name: agent.name,
    model: agent.type,
    description: agent.description || `${agent.name} agent for your project`,
    status: agent.status || 'idle'
  }));
  
  // Map task data to the format expected by this UI
  const mappedTasks = tasks.map(task => ({
    id: task.id || '',
    name: task.title || '', // Changed from name to title to match Task type
    agent: task.agent_id || '',
    status: task.status || 'pending',
    createdAt: task.created_at || new Date().toISOString()
  }));
  
  return (
    <div className="flex h-[calc(100vh-73px)] bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">OpenRouter SDK</h1>
        </div>
        <div className="mt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-6 py-3 w-full text-left ${
                activeTab === tab.id 
                  ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="mr-3">{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-6">
          
          {/* Agents Tab */}
          {activeTab === 'agents' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Agents</h2>
                <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  <Plus size={16} className="mr-2" />
                  <span>New Agent</span>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mappedAgents.length > 0 ? mappedAgents.map((agent) => (
                  <div key={agent.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-bold text-gray-800">{agent.name}</h3>
                      <StatusBadge status={agent.status} />
                    </div>
                    <p className="text-sm text-gray-500 mb-4">Model: {agent.model}</p>
                    <p className="text-sm text-gray-600 mb-6">{agent.description}</p>
                    <div className="flex space-x-2">
                      <button 
                        className="flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                        onClick={() => onStartAgent && onStartAgent(agent.id)}
                      >
                        <Play size={14} className="mr-1" />
                        Execute
                      </button>
                      <button 
                        className="flex items-center px-3 py-2 border border-blue-600 text-blue-600 text-sm rounded-md hover:bg-blue-50"
                        onClick={() => onEditAgent && onEditAgent(agent.id)}
                      >
                        <Edit size={14} className="mr-1" />
                        Edit
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-3 text-center py-10 bg-white rounded-lg shadow-md">
                    <User size={40} className="mx-auto text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium text-gray-800 mb-1">No agents available</h3>
                    <p className="text-gray-500 mb-4">Create an agent to get started</p>
                    <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                      <Plus size={16} className="mr-2" />
                      <span>New Agent</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Tasks</h2>
                <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  <Plus size={16} className="mr-2" />
                  <span>New Task</span>
                </button>
              </div>
              
              {mappedTasks.length > 0 ? (
                <div className="bg-white shadow-md rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Agent</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {mappedTasks.map((task) => (
                        <tr key={task.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{task.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {agents.find(a => a.id === task.agent)?.name || task.agent}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={task.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(task.createdAt)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button 
                                className="text-blue-600 hover:text-blue-900"
                                onClick={() => onExecuteTask && onExecuteTask(task.id, task.agent)}
                              >
                                <Play size={16} />
                              </button>
                              <button className="text-gray-600 hover:text-gray-900"><Edit size={16} /></button>
                              <button className="text-red-600 hover:text-red-900"><Trash size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 bg-white rounded-lg shadow-md">
                  <CheckSquare size={40} className="mx-auto text-gray-400 mb-3" />
                  <h3 className="text-lg font-medium text-gray-800 mb-1">No tasks available</h3>
                  <p className="text-gray-500 mb-4">Create a task to get started</p>
                  <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    <Plus size={16} className="mr-2" />
                    <span>New Task</span>
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Workflows Tab */}
          {activeTab === 'workflows' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Workflows</h2>
                <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  <Plus size={16} className="mr-2" />
                  <span>New Workflow</span>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {workflows.map((workflow) => (
                  <div key={workflow.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-bold text-gray-800">{workflow.name}</h3>
                      <StatusBadge status={workflow.status} />
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Tasks: {workflow.tasksCompleted}/{workflow.totalTasks} completed</p>
                    <div className="mb-4">
                      <ProgressBar progress={workflow.progress} />
                    </div>
                    <div className="flex space-x-2">
                      <button className="flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
                        <Play size={14} className="mr-1" />
                        Execute
                      </button>
                      <button className="flex items-center px-3 py-2 border border-blue-600 text-blue-600 text-sm rounded-md hover:bg-blue-50">
                        <Edit size={14} className="mr-1" />
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Knowledge Bases Tab */}
          {activeTab === 'knowledge' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Knowledge Bases</h2>
                <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  <Plus size={16} className="mr-2" />
                  <span>New Knowledge Base</span>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {knowledgeBases.map((kb) => (
                  <div key={kb.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                    <div className="flex items-center mb-4">
                      <Database size={20} className="text-blue-600 mr-2" />
                      <h3 className="text-lg font-bold text-gray-800">{kb.name}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">Documents: {kb.documents}</p>
                    <p className="text-sm text-gray-600 mb-4">Last updated: {formatDate(kb.lastUpdated)}</p>
                    <div className="flex space-x-2">
                      <button className="flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
                        <Search size={14} className="mr-1" />
                        Search
                      </button>
                      <button className="flex items-center px-3 py-2 border border-blue-600 text-blue-600 text-sm rounded-md hover:bg-blue-50">
                        <Plus size={14} className="mr-1" />
                        Add Documents
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Functions Tab */}
          {activeTab === 'functions' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Functions</h2>
                <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  <Plus size={16} className="mr-2" />
                  <span>Register Function</span>
                </button>
              </div>
              
              <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Function Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parameters</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {functions.map((func) => (
                      <tr key={func.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{func.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{func.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {func.parameters.map(param => (
                            <span key={param} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mr-1">
                              {param}
                            </span>
                          ))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button className="text-blue-600 hover:text-blue-900">Use in Agent</button>
                            <button className="text-gray-600 hover:text-gray-900"><Edit size={16} /></button>
                            <button className="text-red-600 hover:text-red-900"><Trash size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Active Agents</p>
                      <p className="text-3xl font-bold text-gray-800">{mappedAgents.filter(a => a.status === 'working').length}</p>
                    </div>
                    <div className="bg-blue-100 p-3 rounded-full">
                      <User size={24} className="text-blue-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Tasks in Progress</p>
                      <p className="text-3xl font-bold text-gray-800">{mappedTasks.filter(t => t.status === 'in_progress').length}</p>
                    </div>
                    <div className="bg-green-100 p-3 rounded-full">
                      <CheckSquare size={24} className="text-green-600" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Active Workflows</p>
                      <p className="text-3xl font-bold text-gray-800">{workflows.filter(w => w.status === 'in_progress').length}</p>
                    </div>
                    <div className="bg-purple-100 p-3 rounded-full">
                      <GitBranch size={24} className="text-purple-600" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Tasks</h3>
                  {mappedTasks.length > 0 ? (
                    <div className="space-y-4">
                      {mappedTasks.slice(0, 3).map((task) => (
                        <div key={task.id} className="flex items-center justify-between pb-2 border-b border-gray-100">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{task.name}</p>
                            <p className="text-xs text-gray-500">
                              {agents.find(a => a.id === task.agent)?.name || 'Unassigned'}
                            </p>
                          </div>
                          <StatusBadge status={task.status} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500">No tasks available</p>
                    </div>
                  )}
                </div>
                
                <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Agent Activity</h3>
                  {mappedAgents.length > 0 ? (
                    <div className="space-y-4">
                      {mappedAgents.slice(0, 3).map((agent) => (
                        <div key={agent.id} className="flex items-center justify-between pb-2 border-b border-gray-100">
                          <div className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              agent.status === 'working' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                            } mr-3`}>
                              <User size={16} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{agent.name}</p>
                              <p className="text-xs text-gray-500">{agent.model}</p>
                            </div>
                          </div>
                          <StatusBadge status={agent.status} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500">No agents available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Settings</h2>
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">API Configuration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">OpenRouter API Key</label>
                    <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="sk-or-..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Model</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                      <option>anthropic/claude-3-opus</option>
                      <option>openai/gpt-4o</option>
                      <option>anthropic/claude-3-sonnet</option>
                      <option>google/gemini-pro</option>
                    </select>
                  </div>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Save Settings
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardUI;
