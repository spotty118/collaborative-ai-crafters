declare module "https://esm.sh/crewai@1.0.1" {
  export class Agent {
    name: string;
    role: string;
    goal: string;
    backstory?: string;
    verbose?: boolean;
    allowDelegation?: boolean;
    tools?: Tool[];
    llm?: {
      invoke(prompt: string): Promise<string>;
    };

    constructor(options: {
      name: string;
      role: string;
      goal: string;
      backstory?: string;
      verbose?: boolean;
      allowDelegation?: boolean;
      tools?: Tool[];
      llm?: {
        invoke(prompt: string): Promise<string>;
      };
    });
    
    execute(task: Task): Promise<unknown>;
  }

  export class Crew {
    constructor(options: {
      agents: Agent[];
      tasks: Task[];
      verbose?: boolean;
      process?: 'sequential' | 'hierarchical';
      memory?: boolean;
    });

    kickoff(): Promise<unknown>;
    
    getTaskResult(task: Task): Promise<unknown>;
  }

  export class Task {
    description: string;
    agent: Agent;
    expected_output?: string;
    id: string;
    
    constructor(options: {
      description: string;
      agent: Agent;
      expected_output?: string;
      tools?: Tool[];
      async_execution?: boolean;
      context?: string[];
    });
    
    execute(): Promise<unknown>;
  }

  export class Tool {
    name: string;
    description: string;
    
    constructor(options: {
      name: string;
      description: string;
      func: (input: string) => Promise<string>;
    });
  }
}

declare module "https://esm.sh/@langchain/openai@0.4.4" {
  export class OpenAI {
    constructor(options: {
      modelName?: string;
      temperature?: number;
      openAIApiKey?: string;
      maxTokens?: number;
      streaming?: boolean;
    });
    
    invoke(prompt: string): Promise<string>;
  }
}
