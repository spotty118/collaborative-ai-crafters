
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
