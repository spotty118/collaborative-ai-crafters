
// This file now serves as a central export point for all orchestration functionality
// Re-exporting from the individual modules for backward compatibility

import { Agent, Project } from "@/lib/types";

// Re-export all functions from the new modules
export {
  initializeAgentOrchestration,
  initializeCrewAI,
  updateCrewAIOrchestration
} from './agentInitialization';

export {
  initiateTeamCollaboration,
  startAgentOrchestration,
  stopAgentOrchestration
} from './teamCollaboration';

export {
  handleCrewTaskCompletion
} from './taskManagement';

// Export new agent system components
export { default as AgentCore } from './agentCore';
export { default as MemorySystem } from './memorySystem';
export { default as ToolRegistry } from './toolRegistry';
export { default as agentSystem } from './agentSystem';
