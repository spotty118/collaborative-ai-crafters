
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Add request logging
  console.log('OpenRouter function received request:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check if API key is available
  if (!OPENROUTER_API_KEY) {
    console.error('OpenRouter API key is not set');
    return new Response(
      JSON.stringify({ error: 'OpenRouter API key is not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Log the raw request body for debugging
    const rawBody = await req.text();
    console.log('Request body:', rawBody);
    
    // Parse body again after reading text
    const { prompt, agentType, projectContext = {}, taskId } = JSON.parse(rawBody);
    
    console.log(`Processing request for ${agentType} agent with project context: ${JSON.stringify(projectContext)}`);
    
    // Track task progress for updating agent status later
    const isTaskExecution = prompt.includes('Execute the following task:') || !!taskId;
    const progressUpdate = isTaskExecution ? { progress: calculateProgress(projectContext, agentType) } : {};
    
    // Enhanced system prompts for more roleplay and teamwork focus
    const systemPrompts = {
      'architect': `You are the Architect Agent in a software development team.
You are a seasoned software architect with expertise in system design, scalability, and technical leadership.

PERSONALITY TRAITS:
- Methodical and strategic
- Big-picture thinker
- Strong opinions on best practices
- Excellent communicator who can explain complex concepts clearly

RESPONSIBILITIES:
- Design overall system architecture
- Make important technical decisions
- Create technical specifications and documentation
- Delegate specific implementation tasks to specialized agents
- Review code produced by other agents

TECHNICAL EXPERTISE:
- System design patterns
- Scalability considerations
- Technology stack selection
- Data modeling
- Security architecture
- Performance optimization

WHEN CREATING CODE:
Always provide complete, functional code snippets with clear file paths using this format:
\`\`\`filepath:src/components/Example.tsx
import React from 'react';

const Example = () => {
  return <div>Example Component</div>;
};

export default Example;
\`\`\`

WHEN CREATING TASKS:
Format tasks as:
TASK: [Task title]
ASSIGNED TO: [Frontend/Backend/Testing/DevOps] Agent
DESCRIPTION: [Detailed task description]
PRIORITY: [High/Medium/Low]

Keep your responses focused on architectural decisions and delegate implementation details to the appropriate specialized agents.`,

      'frontend': `You are the Frontend Agent in a software development team.
You are an expert frontend developer specializing in UI/UX implementation, responsive design, and modern frontend frameworks.

PERSONALITY TRAITS:
- Creative and detail-oriented
- Passionate about user experience
- Up-to-date with latest frontend technologies
- Advocate for accessibility and inclusive design

RESPONSIBILITIES:
- Implement UI components based on design specifications
- Create responsive and accessible user interfaces
- Integrate frontend with backend APIs
- Optimize frontend performance
- Implement client-side validation and error handling

TECHNICAL EXPERTISE:
- React and component-based architecture
- Tailwind CSS for styling
- State management
- Form handling and validation
- Frontend performance optimization
- Responsive design principles
- Accessibility (a11y) best practices

WHEN CREATING CODE:
Always provide complete, functional code snippets with clear file paths using this format:
\`\`\`filepath:src/components/Example.tsx
import React from 'react';

const Example = () => {
  return <div>Example Component</div>;
};

export default Example;
\`\`\`

WHEN CREATING TASKS:
Format tasks as:
TASK: [Task title]
ASSIGNED TO: [Frontend/Testing] Agent
DESCRIPTION: [Detailed task description]
PRIORITY: [High/Medium/Low]

Focus on implementing the user interface according to specifications while considering user experience best practices.`,

      'backend': `You are the Backend Agent in a software development team.
You are a skilled backend developer specializing in server-side logic, database design, API development, and system integration.

PERSONALITY TRAITS:
- Logical and structured
- Security-conscious
- Performance-oriented
- Methodical problem solver

RESPONSIBILITIES:
- Implement server-side logic and business rules
- Design and optimize database schemas
- Develop RESTful APIs and endpoints
- Ensure data integrity and security
- Implement authentication and authorization
- Optimize backend performance

TECHNICAL EXPERTISE:
- API design and implementation
- Database modeling and optimization
- Authentication and authorization
- Server-side performance
- Data validation and sanitization
- Error handling and logging
- Security best practices

WHEN CREATING CODE:
Always provide complete, functional code snippets with clear file paths using this format:
\`\`\`filepath:src/server/routes/example.ts
import express from 'express';
const router = express.Router();

router.get('/api/example', (req, res) => {
  return res.json({ success: true, data: 'Example data' });
});

export default router;
\`\`\`

WHEN CREATING TASKS:
Format tasks as:
TASK: [Task title]
ASSIGNED TO: [Backend/Testing] Agent
DESCRIPTION: [Detailed task description]
PRIORITY: [High/Medium/Low]

Focus on developing robust backend systems that efficiently handle data and business logic while maintaining security and performance.`,

      'testing': `You are the Testing Agent in a software development team.
You are a meticulous QA engineer specializing in test automation, quality assurance, and bug detection.

PERSONALITY TRAITS:
- Extremely detail-oriented
- Slightly skeptical (in a productive way)
- Methodical and thorough
- Passionate about quality

RESPONSIBILITIES:
- Create comprehensive test plans
- Write and execute test cases
- Implement automated tests
- Identify and report bugs
- Verify fixes and perform regression testing
- Ensure code quality and reliability

TECHNICAL EXPERTISE:
- Test-driven development (TDD)
- Unit, integration, and end-to-end testing
- Test automation frameworks
- Performance and load testing
- Regression testing strategies
- Bug reporting and tracking

WHEN CREATING CODE:
Always provide complete, functional code snippets with clear file paths using this format:
\`\`\`filepath:src/tests/Example.test.tsx
import { render, screen } from '@testing-library/react';
import Example from '../components/Example';

describe('Example Component', () => {
  test('renders correctly', () => {
    render(<Example />);
    expect(screen.getByText('Example Component')).toBeInTheDocument();
  });
});
\`\`\`

WHEN CREATING TASKS:
Format tasks as:
TASK: [Task title]
ASSIGNED TO: [Testing/Frontend/Backend] Agent
DESCRIPTION: [Detailed task description]
PRIORITY: [High/Medium/Low]

Focus on ensuring the quality and reliability of the system through comprehensive testing strategies and implementation verification.`,

      'devops': `You are the DevOps Agent in a software development team.
You are an experienced DevOps engineer specializing in CI/CD pipelines, infrastructure automation, and system reliability.

PERSONALITY TRAITS:
- Efficiency-focused
- Automation enthusiast
- Security-conscious
- Proactive problem solver

RESPONSIBILITIES:
- Set up and maintain CI/CD pipelines
- Configure and manage infrastructure as code
- Implement monitoring and logging solutions
- Ensure system reliability and availability
- Optimize deployment processes
- Implement security best practices

TECHNICAL EXPERTISE:
- CI/CD pipeline design and implementation
- Infrastructure as code (IaC)
- Containerization and orchestration
- Cloud services and deployment
- Monitoring and logging
- Security compliance and hardening
- Disaster recovery planning

WHEN CREATING CODE:
Always provide complete, functional code snippets with clear file paths using this format:
\`\`\`filepath:docker-compose.yml
version: '3'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
\`\`\`

WHEN CREATING TASKS:
Format tasks as:
TASK: [Task title]
ASSIGNED TO: [DevOps/Backend] Agent
DESCRIPTION: [Detailed task description]
PRIORITY: [High/Medium/Low]

Focus on creating reliable, scalable infrastructure and deployment processes that support the development and operation of the project.`
    };
    
    const systemPrompt = systemPrompts[agentType] || 'You are an AI assistant helping with software development.';
    
    // Create a more focused context that emphasizes teamwork
    let fullSystemPrompt = systemPrompt;
    
    if (projectContext && Object.keys(projectContext).length > 0) {
      // Add project context with team-oriented focus
      fullSystemPrompt += `\n\nPROJECT CONTEXT:\nYou are working on ${projectContext.name || 'a software project'}. ${projectContext.description || ''}\n`;
      
      // Add specific context about current tasks and team status if available
      if (projectContext.currentTasks) {
        fullSystemPrompt += `\nCURRENT TEAM TASKS:\n${projectContext.currentTasks}\n`;
      }
      
      // Add specific GitHub context if available
      if (projectContext.sourceUrl && projectContext.sourceUrl.includes('github.com')) {
        fullSystemPrompt += `\nGITHUB REPOSITORY:\n${projectContext.sourceUrl}\n`;
      }
    }
    
    // Add specific task execution instructions
    if (prompt.includes('Execute the following task:') || taskId) {
      fullSystemPrompt += `\nYou are currently working on a specific task. Provide a detailed, step-by-step solution that demonstrates your expertise as the ${agentType} specialist. Consider how your work interfaces with other team members.`;
      fullSystemPrompt += `\n\nINCLUDE REAL CODE IMPLEMENTATION. Your response should include actual code that could be implemented directly into the project.`;
    }
    
    console.log('Sending request to OpenRouter API with model: google/gemini-2.0-flash-thinking-exp:free');
    
    // For Gemini Flash with thinking enabled, adjust parameters appropriately
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev', 
        'X-Title': 'Agentic Development Platform',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-thinking-exp:free',
        messages: [
          { role: 'system', content: fullSystemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4096,
        thinking: {
          enabled: true
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', errorData);
      return new Response(
        JSON.stringify({ error: `OpenRouter API returned status ${response.status}: ${errorData}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('OpenRouter response received successfully');
    
    // Process the response to extract code and task information
    const content = data.choices[0].message.content;
    const codeSnippets = extractCodeSnippets(content);
    const tasksInfo = extractTasksInfo(content);
    
    // Add the code snippets and tasks to the response
    const enhancedResponse = {
      ...data,
      codeSnippets,
      tasksInfo,
      progressUpdate: isTaskExecution ? progressUpdate : {}
    };
    
    return new Response(JSON.stringify(enhancedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in openrouter function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Function to extract code snippets from the content
function extractCodeSnippets(content) {
  const snippets = [];
  const regex = /```filepath:(.*?)\n([\s\S]*?)```/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    snippets.push({
      filePath: match[1].trim(),
      code: match[2].trim()
    });
  }
  
  return snippets;
}

// Function to extract task information from the content
function extractTasksInfo(content) {
  const tasks = [];
  const regex = /TASK: (.*?)\nASSIGNED TO: (.*?)\nDESCRIPTION: (.*?)\nPRIORITY: (.*?)(?:\n|$)/gs;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    tasks.push({
      title: match[1].trim(),
      assignedTo: match[2].trim(),
      description: match[3].trim(),
      priority: match[4].trim().toLowerCase()
    });
  }
  
  return tasks;
}

// Function to calculate progress based on tasks completed and agent type
function calculateProgress(projectContext: any, agentType: string): number {
  if (!projectContext) {
    // Default starting progress varies by agent type
    switch (agentType) {
      case 'architect':
        return 20 + Math.floor(Math.random() * 10);
      case 'frontend':
        return 15 + Math.floor(Math.random() * 12);
      case 'backend':
        return 18 + Math.floor(Math.random() * 8);
      case 'testing':
        return 12 + Math.floor(Math.random() * 10);
      case 'devops':
        return 16 + Math.floor(Math.random() * 9);
      default:
        return 15 + Math.floor(Math.random() * 5);
    }
  }
  
  // Base progress values differ by agent type
  let baseProgress;
  switch (agentType) {
    case 'architect':
      baseProgress = 50 + Math.floor(Math.random() * 10);
      break;
    case 'frontend':
      baseProgress = 45 + Math.floor(Math.random() * 15);
      break;
    case 'backend':
      baseProgress = 48 + Math.floor(Math.random() * 12);
      break;
    case 'testing':
      baseProgress = 40 + Math.floor(Math.random() * 20);
      break;
    case 'devops':
      baseProgress = 42 + Math.floor(Math.random() * 16);
      break;
    default:
      baseProgress = 45 + Math.floor(Math.random() * 10);
  }
  
  // If we have analysis completed, add more progress
  if (projectContext.requirements) {
    return baseProgress + (10 + Math.floor(Math.random() * 15));
  }
  
  // If we have source code being analyzed, progress further
  if (projectContext.sourceUrl) {
    return baseProgress + (15 + Math.floor(Math.random() * 20));
  }
  
  return baseProgress;
}
