
import { Agent, Project, Task } from '@/lib/types';

// Export everything from the specialized modules
export {
  initializeOrchestration 
} from './orchestrationInitializer';

export {
  handleTaskCompletion
} from './taskManagement';

export {
  startAgentWithOrchestration,
  restartAgentWithOrchestration,
  stopAgentWithOrchestration
} from './agentLifecycle';

// Export CrewAI functions
export {
  initializeCrewAI,
  updateCrewAIOrchestration,
  handleCrewTaskCompletion
} from './crewAI';

// The orchestrator now serves as a facade for the agent orchestration system,
// providing a unified API for the rest of the application while delegating
// the actual implementation to more specialized modules.
