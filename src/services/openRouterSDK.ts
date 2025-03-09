
import { openRouterClient, sendAgentPrompt, orchestrateAgents } from '@/lib/openrouter-client';
import { Agent, Task, Project, AgentType } from '@/lib/types';
import { toast } from 'sonner';
import { VectorDatabase } from '@/lib/vectorDb';

// Types for our APIs
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  tasks: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  project_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  documents_count: number;
  created_at: string;
  updated_at?: string;
}

export interface Function {
  id: string;
  name: string;
  description: string;
  parameters: string[];
  created_at?: string;
}

// API Services
export const SDKService = {
  // Authentication
  setApiKey: (apiKey: string): boolean => {
    try {
      if (!apiKey.startsWith('sk-or-')) {
        console.warn('Warning: API key does not have the expected format (sk-or-...)');
      }
      
      openRouterClient.setApiKey(apiKey);
      localStorage.setItem('OPENROUTER_API_KEY', apiKey);
      console.log('API key set successfully');
      return true;
    } catch (error) {
      console.error('Failed to set API key:', error);
      return false;
    }
  },

  getApiKey: (): string | null => {
    return localStorage.getItem('OPENROUTER_API_KEY');
  },
  
  // Model Management
  getModels: async (): Promise<any[]> => {
    try {
      const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
      if (!apiKey) {
        toast.error('API key is not set. Please configure your API key in settings.');
        return [];
      }
      
      const models = await openRouterClient.getModels();
      return models;
    } catch (error) {
      console.error('Error fetching models:', error);
      toast.error('Failed to fetch models: ' + (error instanceof Error ? error.message : 'Unknown error'));
      return [];
    }
  },

  // Agent Management
  getAgents: async (projectId?: string): Promise<Agent[]> => {
    console.log('Fetching agents for project', projectId);
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      return [];
    }
    
    try {
      // In a real implementation, this would fetch from an API
      // Currently using sample data
      return [
        {
          id: 'architect',
          name: 'Architect',
          type: 'architect',
          status: 'idle',
          progress: 0,
          description: 'Designs the system architecture and components'
        },
        {
          id: 'frontend',
          name: 'Frontend Developer',
          type: 'frontend',
          status: 'idle',
          progress: 0,
          description: 'Builds user interfaces and components'
        },
        {
          id: 'backend',
          name: 'Backend Developer', 
          type: 'backend',
          status: 'idle',
          progress: 0,
          description: 'Implements server-side logic and APIs'
        }
      ];
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to fetch agents');
      return [];
    }
  },
  
  createAgent: async (agent: Partial<Agent>): Promise<Agent> => {
    console.log('Creating agent:', agent);
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      throw new Error('API key is not set');
    }
    
    try {
      // In a real implementation, this would post to an API
      // Mock implementation
      const newAgent: Agent = {
        id: `agent-${Date.now()}`,
        name: agent.name || 'New Agent',
        type: agent.type || 'architect',
        status: 'idle',
        progress: 0,
        description: agent.description || 'Custom agent',
        ...agent
      };
      
      toast.success(`Agent "${newAgent.name}" created successfully`);
      return newAgent;
    } catch (error) {
      console.error('Error creating agent:', error);
      toast.error('Failed to create agent');
      throw error;
    }
  },
  
  executeAgent: async (agent: Agent, prompt: string, project?: Project): Promise<string> => {
    console.log('Executing agent:', agent.id, 'with prompt:', prompt);
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      throw new Error('API key is not set');
    }
    
    try {
      const defaultModel = localStorage.getItem('OPENROUTER_DEFAULT_MODEL') || 'anthropic/claude-3-5-sonnet';
      
      // Use the client to send the prompt to the agent
      const response = await sendAgentPrompt(agent, prompt, project || {
        id: 'default-project',
        name: 'Default Project',
        description: 'Default project for SDK operations',
        mode: 'existing'
      }, {
        model: defaultModel
      });
      
      return response;
    } catch (error) {
      console.error('Error executing agent:', error);
      toast.error('Failed to execute agent: ' + (error instanceof Error ? error.message : 'Unknown error'));
      throw error;
    }
  },

  // Task Management
  getTasks: async (projectId?: string): Promise<Task[]> => {
    console.log('Fetching tasks for project', projectId);
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      return [];
    }
    
    try {
      // Mock implementation
      return [
        {
          id: 'task-1',
          title: 'Initialize project structure',
          description: 'Set up initial project structure and configuration',
          agent_id: 'architect',
          status: 'completed',
          project_id: projectId || 'default-project',
          created_at: new Date().toISOString()
        },
        {
          id: 'task-2',
          title: 'Design component system',
          description: 'Create reusable component library',
          agent_id: 'frontend',
          status: 'in_progress',
          project_id: projectId || 'default-project',
          created_at: new Date().toISOString()
        }
      ];
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to fetch tasks');
      return [];
    }
  },
  
  createTask: async (task: Partial<Task>): Promise<Task> => {
    console.log('Creating task:', task);
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      throw new Error('API key is not set');
    }
    
    try {
      // Mock implementation
      const newTask: Task = {
        id: `task-${Date.now()}`,
        title: task.title || 'New Task',
        description: task.description || 'Task description',
        agent_id: task.agent_id || '',
        status: 'pending',
        project_id: task.project_id || 'default-project',
        created_at: new Date().toISOString(),
        ...task
      };
      
      toast.success(`Task "${newTask.title}" created successfully`);
      return newTask;
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
      throw error;
    }
  },
  
  executeTask: async (taskId: string, agentId: string): Promise<boolean> => {
    console.log('Executing task:', taskId, 'with agent:', agentId);
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      throw new Error('API key is not set');
    }
    
    try {
      // Mock implementation
      toast.success(`Task ${taskId} executed by agent ${agentId}`);
      return true;
    } catch (error) {
      console.error('Error executing task:', error);
      toast.error('Failed to execute task');
      throw error;
    }
  },

  // Workflow Management
  getWorkflows: async (): Promise<Workflow[]> => {
    console.log('Fetching workflows');
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      return [];
    }
    
    try {
      // Mock implementation
      return [
        {
          id: 'workflow-1',
          name: 'Full-stack Development',
          description: 'End-to-end application development workflow',
          tasks: ['task-1', 'task-2'],
          status: 'in_progress',
          progress: 50,
          created_at: new Date().toISOString()
        },
        {
          id: 'workflow-2',
          name: 'Data Analysis Pipeline',
          description: 'Extract, transform, and analyze data',
          tasks: ['task-3', 'task-4'],
          status: 'pending',
          progress: 0,
          created_at: new Date().toISOString()
        }
      ];
    } catch (error) {
      console.error('Error fetching workflows:', error);
      toast.error('Failed to fetch workflows');
      return [];
    }
  },
  
  createWorkflow: async (workflow: Partial<Workflow>): Promise<Workflow> => {
    console.log('Creating workflow:', workflow);
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      throw new Error('API key is not set');
    }
    
    try {
      // Mock implementation
      const newWorkflow: Workflow = {
        id: `workflow-${Date.now()}`,
        name: workflow.name || 'New Workflow',
        description: workflow.description || 'Workflow description',
        tasks: workflow.tasks || [],
        status: 'pending',
        progress: 0,
        created_at: new Date().toISOString(),
        ...workflow
      };
      
      toast.success(`Workflow "${newWorkflow.name}" created successfully`);
      return newWorkflow;
    } catch (error) {
      console.error('Error creating workflow:', error);
      toast.error('Failed to create workflow');
      throw error;
    }
  },
  
  executeWorkflow: async (workflowId: string): Promise<boolean> => {
    console.log('Executing workflow:', workflowId);
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      throw new Error('API key is not set');
    }
    
    try {
      // Mock implementation
      toast.success(`Workflow ${workflowId} execution started`);
      return true;
    } catch (error) {
      console.error('Error executing workflow:', error);
      toast.error('Failed to execute workflow');
      throw error;
    }
  },

  // Knowledge Base Management
  getKnowledgeBases: async (): Promise<KnowledgeBase[]> => {
    console.log('Fetching knowledge bases');
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      return [];
    }
    
    try {
      // Mock implementation
      return [
        {
          id: 'kb-1',
          name: 'Project Documentation',
          description: 'Core project documentation and specifications',
          documents_count: 15,
          created_at: new Date().toISOString()
        },
        {
          id: 'kb-2',
          name: 'Research Data',
          description: 'Research papers and analysis',
          documents_count: 28,
          created_at: new Date().toISOString()
        }
      ];
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
      toast.error('Failed to fetch knowledge bases');
      return [];
    }
  },
  
  createKnowledgeBase: async (kb: Partial<KnowledgeBase>): Promise<KnowledgeBase> => {
    console.log('Creating knowledge base:', kb);
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      throw new Error('API key is not set');
    }
    
    try {
      // Mock implementation
      const newKB: KnowledgeBase = {
        id: `kb-${Date.now()}`,
        name: kb.name || 'New Knowledge Base',
        description: kb.description || 'Knowledge base description',
        documents_count: 0,
        created_at: new Date().toISOString(),
        ...kb
      };
      
      toast.success(`Knowledge base "${newKB.name}" created successfully`);
      return newKB;
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      toast.error('Failed to create knowledge base');
      throw error;
    }
  },
  
  // Vector DB operations
  addDocument: async (knowledgeBaseId: string, document: { text: string, metadata?: any }): Promise<boolean> => {
    console.log('Adding document to knowledge base:', knowledgeBaseId, document);
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      throw new Error('API key is not set');
    }
    
    try {
      // Use VectorDatabase to add the document - using the correct method name
      await VectorDatabase.storeEmbedding(
        knowledgeBaseId, 
        document.text,
        document.metadata || {}
      );
      
      toast.success('Document added successfully');
      return true;
    } catch (error) {
      console.error('Error adding document:', error);
      toast.error('Failed to add document');
      throw error;
    }
  },
  
  searchDocuments: async (knowledgeBaseId: string, query: string): Promise<any[]> => {
    console.log('Searching in knowledge base:', knowledgeBaseId, 'with query:', query);
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      throw new Error('API key is not set');
    }
    
    try {
      // Use VectorDatabase to search for documents - using the correct method name
      const results = await VectorDatabase.searchSimilar(
        knowledgeBaseId, 
        query, 
        0.7, // default threshold
        5    // default limit
      );
      
      return results;
    } catch (error) {
      console.error('Error searching documents:', error);
      toast.error('Failed to search documents');
      throw error;
    }
  },
  
  // Function Registry
  getFunctions: async (): Promise<Function[]> => {
    console.log('Fetching functions');
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      return [];
    }
    
    try {
      // Mock implementation
      return [
        {
          id: 'func-1',
          name: 'getWeather',
          description: 'Get current weather for a location',
          parameters: ['location', 'units']
        },
        {
          id: 'func-2',
          name: 'searchWeb',
          description: 'Search the web for information',
          parameters: ['query', 'maxResults']
        }
      ];
    } catch (error) {
      console.error('Error fetching functions:', error);
      toast.error('Failed to fetch functions');
      return [];
    }
  },
  
  createFunction: async (func: Partial<Function>): Promise<Function> => {
    console.log('Creating function:', func);
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      throw new Error('API key is not set');
    }
    
    try {
      // Mock implementation
      const newFunc: Function = {
        id: `func-${Date.now()}`,
        name: func.name || 'newFunction',
        description: func.description || 'Function description',
        parameters: func.parameters || [],
        ...func
      };
      
      toast.success(`Function "${newFunc.name}" registered successfully`);
      return newFunc;
    } catch (error) {
      console.error('Error creating function:', error);
      toast.error('Failed to create function');
      throw error;
    }
  },
  
  executeFunction: async (funcId: string, parameters: Record<string, any>): Promise<any> => {
    console.log('Executing function:', funcId, 'with parameters:', parameters);
    
    // Check if API key is set
    const apiKey = localStorage.getItem('OPENROUTER_API_KEY');
    if (!apiKey) {
      toast.error('API key is not set. Please configure your API key in settings.');
      throw new Error('API key is not set');
    }
    
    try {
      // Mock implementation
      toast.success(`Function ${funcId} executed successfully`);
      return { success: true, result: `Executed function with parameters: ${JSON.stringify(parameters)}` };
    } catch (error) {
      console.error('Error executing function:', error);
      toast.error('Failed to execute function');
      throw error;
    }
  }
};
