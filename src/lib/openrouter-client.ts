
import { getOpenRouterApiKey } from '@/lib/env';
import { Agent, Project, SendAgentPromptOptions } from '@/lib/types';
import { toast } from 'sonner';
import { OpenAI } from 'openrouter-sdk';

export class OpenRouterClient {
  private apiKey: string;
  private openRouter: any;
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey || getOpenRouterApiKey() || '';
    if (this.apiKey) {
      this.initClient();
    } else {
      console.warn('OpenRouter client initialized without API key');
    }
  }
  
  private initClient() {
    this.openRouter = new OpenAI({
      apiKey: this.apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Agent Platform'
      }
    });
  }
  
  public setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    if (apiKey) {
      this.initClient();
    } else {
      this.openRouter = null;
    }
  }
  
  public hasApiKey(): boolean {
    return !!this.apiKey;
  }
  
  public async getModels() {
    if (!this.apiKey || !this.openRouter) {
      throw new Error('OpenRouter API key is not set');
    }
    
    try {
      const response = await this.openRouter.models.list();
      return response;
    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error);
      throw error;
    }
  }
  
  public async chatCompletion(params: {
    model: string;
    messages: Array<{role: string; content: string | Array<{type: string; [key: string]: any}>}>;
    temperature?: number;
    max_tokens?: number;
  }) {
    if (!this.apiKey || !this.openRouter) {
      throw new Error('OpenRouter API key is not set');
    }
    
    try {
      const response = await this.openRouter.chat.completions.create({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature || 0.3,
        max_tokens: params.max_tokens || 1024
      });
      
      return response;
    } catch (error) {
      console.error('Failed to get chat completion from OpenRouter:', error);
      throw error;
    }
  }
}

export const openRouterClient = new OpenRouterClient();

export async function sendAgentPrompt(
  agent: Agent,
  prompt: string,
  project: Project,
  options: SendAgentPromptOptions = {}
): Promise<string> {
  try {
    if (!agent || !prompt) {
      throw new Error('Agent and prompt are required');
    }
    
    const {
      model = 'openai/gpt-4o-mini',
      images = [],
      context = '',
      task = '',
      expectCode = false,
      ignoreStatus = false
    } = options;
    
    if (!openRouterClient.hasApiKey()) {
      toast.error('OpenRouter API key is required. Please set it in the settings.');
      throw new Error('OpenRouter API key is not configured');
    }
    
    const projectContext = project ? {
      name: project.name,
      description: project.description
    } : {};
    
    console.log(`Sending prompt to ${agent.type} agent using model: ${model}`);
    
    const messages: any[] = [];
    
    let systemContent = '';
    switch (agent.type) {
      case 'architect':
        systemContent = 'You are an experienced software architect. Provide detailed guidance on system design, architecture patterns, and technical decision-making.';
        break;
      case 'frontend':
        systemContent = 'You are a frontend development expert. Provide detailed guidance on UI/UX implementation, responsive design, and modern frontend frameworks.';
        break;
      case 'backend':
        systemContent = 'You are a backend development expert. Provide detailed guidance on API design, database modeling, and server-side architecture.';
        break;
      case 'testing':
        systemContent = 'You are a software testing expert. Provide detailed guidance on test strategies, test automation, and quality assurance processes.';
        break;
      case 'devops':
        systemContent = 'You are a DevOps expert. Provide detailed guidance on CI/CD pipelines, infrastructure as code, and deployment strategies.';
        break;
      default:
        systemContent = 'You are an AI assistant with expertise in software development. Provide helpful, accurate, and detailed responses.';
    }
    
    if (expectCode) {
      systemContent += '\n\nIMPORTANT: When asked to generate code, provide complete, functional code files - not just snippets. Include all necessary imports and implementation details.';
    }
    
    messages.push({ role: 'system', content: systemContent });
    
    if (context) {
      messages.push({ role: 'user', content: context });
      messages.push({ 
        role: 'assistant', 
        content: 'I understand the context. What would you like me to help with now?' 
      });
    }
    
    let enhancedPrompt = prompt;
    if (projectContext && Object.keys(projectContext).length > 0) {
      enhancedPrompt = `Project: ${projectContext.name || 'Unnamed'}\nDescription: ${projectContext.description || 'No description'}\n\n${prompt}`;
    }
    
    if (task) {
      enhancedPrompt = `Task: ${task}\n\n${enhancedPrompt}`;
    }
    
    if (images && images.length > 0) {
      const multimodalContent = [
        { type: 'text', text: enhancedPrompt }
      ];
      
      for (const imageUrl of images) {
        multimodalContent.push({
          type: 'image_url',
          image_url: { url: imageUrl }
        } as any);
      }
      
      messages.push({ role: 'user', content: multimodalContent });
    } else {
      messages.push({ role: 'user', content: enhancedPrompt });
    }
    
    const completion = await openRouterClient.chatCompletion({
      model,
      messages,
    });
    
    const responseText = completion.choices[0].message.content;
    return responseText;
    
  } catch (error) {
    console.error('Error sending agent prompt:', error);
    throw error;
  }
}

export async function orchestrateAgents(
  project: Project,
  agents: Agent[],
  prompt: string
) {
  try {
    if (!agents || agents.length === 0) {
      throw new Error('No agents available for orchestration');
    }
    
    const architectAgent = agents.find(a => a.type === 'architect');
    if (!architectAgent) {
      throw new Error('Architect agent is required for orchestration');
    }
    
    console.log('Starting agent orchestration with Architect agent');
    
    const designPrompt = `I need a comprehensive project design based on this description: ${prompt}\n\n` +
      'Please provide:\n' +
      '1. A high-level architecture overview\n' +
      '2. Key components and their responsibilities\n' +
      '3. Technology recommendations\n' +
      '4. Potential challenges and solutions';
    
    const designResponse = await sendAgentPrompt(
      architectAgent,
      designPrompt,
      project,
      { model: 'anthropic/claude-3-sonnet', expectCode: false }
    );
    
    console.log('Received project design from Architect');
    
    return {
      projectPlan: {
        name: "Project Plan",
        description: prompt,
        design: designResponse
      },
      results: [
        { id: "1", description: "Project design", assignedTo: "architect", status: "completed", result: designResponse }
      ],
      evaluation: "Project plan created successfully. Ready for implementation."
    };
    
  } catch (error) {
    console.error('Agent orchestration error:', error);
    throw error;
  }
}
