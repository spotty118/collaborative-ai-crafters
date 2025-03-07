
import React from 'react';
import { Agent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface AgentSectionProps {
  agents: Agent[];
  isLoading: boolean;
  onStartAgent: (agent: Agent) => void;
  onStartAllAgents: () => void;
}

const AgentSection = ({ 
  agents, 
  isLoading, 
  onStartAgent, 
  onStartAllAgents 
}: AgentSectionProps) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">AI Agents</h2>
        <Button
          onClick={() => {
            onStartAllAgents();
            toast("Starting all agents...");
          }}
          disabled={isLoading}
        >
          {isLoading ? 'Starting Agents...' : 'Start All Agents'}
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map(agent => (
          <div key={agent.id} className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">{agent.name}</h3>
              <span className="text-2xl">{agent.avatar}</span>
            </div>
            <p className="text-gray-600 mb-2">{agent.description}</p>
            <div className="mb-2">
              <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                agent.status === 'working' ? 'bg-blue-100 text-blue-800' :
                agent.status === 'completed' ? 'bg-green-100 text-green-800' :
                agent.status === 'failed' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
              </span>
            </div>
            {agent.progress > 0 && (
              <div className="mb-4">
                <Progress value={agent.progress} />
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onStartAgent(agent);
                toast(`Starting ${agent.name}...`);
              }}
              disabled={agent.status === 'working' || isLoading}
            >
              Start Agent
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentSection;
