
// CrewAI API client implementation
import { toast } from "sonner";

// CrewAI API constants
const CREWAI_API_URL = "https://could-you-clarify-if-this-chat-is-intended--fc133f12.crewai.com";
const CREWAI_API_TOKEN = "8b45b95c0542";
const CREWAI_UUID = "8f975a62-fed4-4c2f-88ac-30c374646154";

// Types for CrewAI API
export interface CrewAIAgent {
  id: string;
  name: string;
  role: string;
  goal: string;
  backstory: string;
  status: string;
  progress?: number;
}

export interface CrewAITask {
  id: string;
  description: string;
  agent_id?: string;
  status: string;
  result?: string;
  created_at: string;
  updated_at: string;
}

export interface CrewAICrew {
  id: string;
  name: string;
  description: string;
  agents: CrewAIAgent[];
  tasks: CrewAITask[];
  status: string;
}

// CrewAI client class
class CrewAIClient {
  private apiUrl: string;
  private apiToken: string;
  private uuid: string;
  
  constructor(apiUrl: string, apiToken: string, uuid: string) {
    this.apiUrl = apiUrl;
    this.apiToken = apiToken;
    this.uuid = uuid;
  }
  
  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    };
  }
  
  async createCrew(name: string, description: string): Promise<CrewAICrew | null> {
    try {
      const response = await fetch(`${this.apiUrl}/crews`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name,
          description,
          uuid: this.uuid
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create crew: ${response.status} ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error creating CrewAI crew:", error);
      toast.error(`Failed to create CrewAI crew: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
  
  async getCrew(crewId: string): Promise<CrewAICrew | null> {
    try {
      const response = await fetch(`${this.apiUrl}/crews/${crewId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get crew: ${response.status} ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error getting CrewAI crew:", error);
      return null;
    }
  }
  
  async createAgent(
    crewId: string, 
    name: string, 
    role: string, 
    goal: string, 
    backstory: string
  ): Promise<CrewAIAgent | null> {
    try {
      const response = await fetch(`${this.apiUrl}/crews/${crewId}/agents`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name,
          role,
          goal,
          backstory
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create agent: ${response.status} ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error creating CrewAI agent:", error);
      toast.error(`Failed to create CrewAI agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
  
  async createTask(
    crewId: string, 
    description: string, 
    agentId?: string
  ): Promise<CrewAITask | null> {
    try {
      const payload: any = { description };
      if (agentId) payload.agent_id = agentId;
      
      const response = await fetch(`${this.apiUrl}/crews/${crewId}/tasks`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create task: ${response.status} ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error creating CrewAI task:", error);
      toast.error(`Failed to create CrewAI task: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
  
  async runCrew(crewId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/crews/${crewId}/run`, {
        method: 'POST',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to run crew: ${response.status} ${errorText}`);
      }
      
      return true;
    } catch (error) {
      console.error("Error running CrewAI crew:", error);
      toast.error(`Failed to run CrewAI crew: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
  
  async getAgentResults(crewId: string, agentId: string): Promise<any | null> {
    try {
      const response = await fetch(`${this.apiUrl}/crews/${crewId}/agents/${agentId}/results`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get agent results: ${response.status} ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error getting CrewAI agent results:", error);
      return null;
    }
  }
  
  async getTaskResult(crewId: string, taskId: string): Promise<any | null> {
    try {
      const response = await fetch(`${this.apiUrl}/crews/${crewId}/tasks/${taskId}/results`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get task results: ${response.status} ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error getting CrewAI task results:", error);
      return null;
    }
  }
}

// Export a singleton instance
export const crewAIClient = new CrewAIClient(
  CREWAI_API_URL,
  CREWAI_API_TOKEN,
  CREWAI_UUID
);

export default crewAIClient;
