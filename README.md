# CrewAI API Integration

This project integrates with an external CrewAI API to replace the original agents with more powerful AI agents provided by [CrewAI](https://crewai.com).

## Features

- ✅ External CrewAI API integration
- ✅ React hooks for managing CrewAI agents
- ✅ Fallback to mock data when API is unavailable
- ✅ TypeScript support for type-safe API interactions
- ✅ Comprehensive error handling

## API Endpoints

The CrewAI API is available at:

```
https://could-you-clarify-if-this-chat-is-intended--fc133f12.crewai.com
```

It offers three main endpoints:

- `GET /inputs` - Retrieve required inputs for the CrewAI agents
- `POST /kickoff` - Start a new CrewAI task
- `GET /status/{task_id}` - Check execution status of a running task

## Setup

To use the CrewAI API integration:

1. Browse to the `/external-crewai` route to see a demo of the integration
2. In production, set `USE_MOCK` to `false` in `src/hooks/useCrewAIApi.ts`

## Integration Components

The integration consists of several key components:

### Hooks

- `useCrewAIApi` - Low-level hook for direct API interaction
- `useCrewAIAgentBridge` - Bridge between existing agent system and CrewAI API

### UI Components

- `CrewAIConnector` - UI component for interacting with the CrewAI API

### Utilities

- `crewAIApi.ts` - API client utilities
- `mockCrewAIData.ts` - Mock data for development and testing

## Push to GitHub

To push changes to GitHub, run the included shell script:

```bash
chmod +x push-to-github.sh
./push-to-github.sh
```

Follow the prompts to provide your GitHub repository URL and optional commit message.
