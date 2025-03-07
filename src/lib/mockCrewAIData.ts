
import { Agent } from "./types";

// Mock required inputs for CrewAI
export const mockRequiredInputs = [
  {
    name: "goal",
    type: "text",
    description: "What do you want the AI agents to accomplish?",
    required: true
  },
  {
    name: "context",
    type: "textarea",
    description: "Provide any additional context about your task",
    required: false
  }
];

// Generate a mock task status based on the provided status
export const getMockTaskStatus = (taskId: string, status: 'pending' | 'in_progress' | 'completed' | 'failed') => {
  let progress = 0;
  let result = null;
  let error = null;
  
  switch (status) {
    case 'pending':
      progress = 0;
      break;
    case 'in_progress':
      progress = Math.floor(Math.random() * 70) + 10; // Random progress between 10-80%
      break;
    case 'completed':
      progress = 100;
      result = {
        summary: "Task completed successfully",
        recommendations: [
          "Consider implementing feature X",
          "Optimize function Y for better performance",
          "Add more test coverage to module Z"
        ],
        codeSnippets: [
          {
            filePath: "src/components/Example.tsx",
            code: "function Example() {\n  return <div>Example Component</div>;\n}"
          }
        ],
        tasks: [
          { title: "Implement feature A", status: "completed" },
          { title: "Fix bug B", status: "in_progress" },
          { title: "Optimize function C", status: "pending" }
        ]
      };
      break;
    case 'failed':
      progress = 0;
      error = "Task execution failed due to an unexpected error";
      break;
  }
  
  return {
    task_id: taskId,
    status,
    progress,
    result,
    error
  };
};

// Create default agents with different roles
export const getDefaultAgents = (projectId: string): Agent[] => {
  return [
    {
      id: `${projectId}-architect`,
      name: "System Architect",
      description: "Designs the overall system architecture and technical specifications",
      type: "architect",
      status: "idle",
      progress: 0,
      avatar: "🏛️"
    },
    {
      id: `${projectId}-frontend`,
      name: "Frontend Developer",
      description: "Implements the user interface and client-side functionality",
      type: "frontend",
      status: "idle",
      progress: 0,
      avatar: "🎨"
    },
    {
      id: `${projectId}-backend`,
      name: "Backend Developer",
      description: "Implements server-side logic, APIs, and database interactions",
      type: "backend",
      status: "idle",
      progress: 0,
      avatar: "⚙️"
    },
    {
      id: `${projectId}-testing`,
      name: "QA Engineer",
      description: "Tests the application for bugs and ensures it meets requirements",
      type: "testing",
      status: "idle",
      progress: 0,
      avatar: "🧪"
    },
    {
      id: `${projectId}-devops`,
      name: "DevOps Engineer",
      description: "Sets up deployment pipelines and infrastructure",
      type: "devops",
      status: "idle",
      progress: 0,
      avatar: "🚀"
    }
  ];
};
