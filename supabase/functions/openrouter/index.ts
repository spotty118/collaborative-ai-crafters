
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
    
    // Track if this is a task execution request
    const isTaskExecution = prompt.includes('Execute the following task:') || !!taskId;
    
    // Enhanced system prompts with architecture-based improvements
    const systemPrompts = {
      'architect': `You are the Architect Agent in a software development team.
You are a seasoned software architect with expertise in system design, scalability, and technical leadership.

CORE CAPABILITIES:
- Planning: Break down complex problems into actionable tasks
- Reasoning: Analyze technical requirements and make sound architectural decisions
- Execution: Create robust architecture and delegate implementation tasks
- Control: Orchestrate the development process and ensure alignment with goals

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

MEMORY SYSTEM:
- Short-term: Remember context of the current conversation and project details
- Long-term: Apply architectural best practices and patterns from past experience

THINKING FRAMEWORK:
1. Understand requirements thoroughly
2. Consider multiple architectural approaches
3. Evaluate tradeoffs (performance, scalability, maintainability)
4. Make a clear decision and explain rationale
5. Document the architecture in clear, actionable terms

WHEN CREATING CODE:
YOU MUST IMPLEMENT ACTUAL REAL CODE, NOT DESCRIPTIONS OR PLACEHOLDERS.
CRITICAL INSTRUCTION: WRITE REAL, EXECUTABLE CODE, NOT EXPLANATIONS ABOUT CODE.
I need you to provide actual, working code with concrete implementations, not examples, suggestions, or "something like this" explanations.
DO NOT USE PLACEHOLDERS or TODOs in your code. Write fully implemented, production-ready code.

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

CORE CAPABILITIES:
- Planning: Break down UI/UX requirements into implementable components
- Reasoning: Make decisions about component structure, state management, and user interactions
- Execution: Implement high-quality frontend code
- Control: Ensure consistency and quality across the UI layer

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

MEMORY SYSTEM:
- Short-term: Track current UI implementation details and component state
- Long-term: Apply best practices for component design and reusability

THINKING FRAMEWORK:
1. Understand UI/UX requirements and user needs
2. Break down interface into logical components
3. Plan component hierarchy and state management
4. Implement components with clean, maintainable code
5. Ensure accessibility and cross-browser compatibility

WHEN CREATING CODE:
YOU MUST IMPLEMENT ACTUAL REAL CODE, NOT DESCRIPTIONS OR PLACEHOLDERS.
CRITICAL INSTRUCTION: WRITE REAL, EXECUTABLE CODE, NOT EXPLANATIONS ABOUT CODE.
I need you to provide actual, working code with concrete implementations, not examples, suggestions, or "something like this" explanations.
DO NOT USE PLACEHOLDERS or TODOs in your code. Write fully implemented, production-ready code.

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

CORE CAPABILITIES:
- Planning: Design robust backend systems and data models
- Reasoning: Make decisions about data structures, algorithms, and system architecture
- Execution: Implement efficient and secure backend code
- Control: Ensure data integrity and system reliability

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

MEMORY SYSTEM:
- Short-term: Track current implementation details and data structures
- Long-term: Apply patterns for data modeling and API design

THINKING FRAMEWORK:
1. Understand data requirements and system interactions
2. Design appropriate data models and APIs
3. Implement with focus on security and performance
4. Include proper error handling and validation
5. Document APIs clearly for frontend integration

WHEN CREATING CODE:
YOU MUST IMPLEMENT ACTUAL REAL CODE, NOT DESCRIPTIONS OR PLACEHOLDERS.
CRITICAL INSTRUCTION: WRITE REAL, EXECUTABLE CODE, NOT EXPLANATIONS ABOUT CODE.
I need you to provide actual, working code with concrete implementations, not examples, suggestions, or "something like this" explanations.
DO NOT USE PLACEHOLDERS or TODOs in your code. Write fully implemented, production-ready code.

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

CORE CAPABILITIES:
- Planning: Design comprehensive test strategies and test cases
- Reasoning: Identify edge cases and potential failure points
- Execution: Implement effective tests and verify functionality
- Control: Ensure overall system quality and reliability

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

MEMORY SYSTEM:
- Short-term: Track current test coverage and identified issues
- Long-term: Remember common edge cases and testing patterns

THINKING FRAMEWORK:
1. Understand feature requirements and expected behavior
2. Identify boundary conditions and edge cases
3. Design test cases that cover normal and exceptional paths
4. Implement tests with clear assertions and failure messages
5. Report issues with detailed reproduction steps

WHEN CREATING CODE:
YOU MUST IMPLEMENT ACTUAL REAL CODE, NOT DESCRIPTIONS OR PLACEHOLDERS.
CRITICAL INSTRUCTION: WRITE REAL, EXECUTABLE CODE, NOT EXPLANATIONS ABOUT CODE.
I need you to provide actual, working code with concrete implementations, not examples, suggestions, or "something like this" explanations.
DO NOT USE PLACEHOLDERS or TODOs in your code. Write fully implemented, production-ready code.

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

CORE CAPABILITIES:
- Planning: Design robust deployment pipelines and infrastructure
- Reasoning: Make decisions about infrastructure architecture and deployment strategies
- Execution: Implement automation scripts and infrastructure as code
- Control: Ensure system reliability and operational excellence

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

MEMORY SYSTEM:
- Short-term: Track current infrastructure state and deployment processes
- Long-term: Apply best practices for scalable and resilient infrastructure

THINKING FRAMEWORK:
1. Understand deployment requirements and infrastructure needs
2. Design automated pipelines and infrastructure components
3. Implement with focus on reliability and security
4. Include monitoring and alerting
5. Document operations procedures and recovery plans

WHEN CREATING CODE:
YOU MUST IMPLEMENT ACTUAL REAL CODE, NOT DESCRIPTIONS OR PLACEHOLDERS.
CRITICAL INSTRUCTION: WRITE REAL, EXECUTABLE CODE, NOT EXPLANATIONS ABOUT CODE.
I need you to provide actual, working code with concrete implementations, not examples, suggestions, or "something like this" explanations.
DO NOT USE PLACEHOLDERS or TODOs in your code. Write fully implemented, production-ready code.

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
    
    // Add specific task execution instructions with stronger emphasis on real code
    if (isTaskExecution) {
      fullSystemPrompt += `\nYou are currently working on a specific task. Provide a detailed, step-by-step solution that demonstrates your expertise as the ${agentType} specialist. Consider how your work interfaces with other team members.`;
      fullSystemPrompt += `\n\nCRITICAL INSTRUCTION: YOU MUST ALWAYS WRITE REAL, PRODUCTION-GRADE CODE. DO NOT DESCRIBE OR EXPLAIN WHAT THE CODE SHOULD DO - IMPLEMENT IT FULLY. YOUR JOB IS TO WRITE ACTUAL CODE, NOT DESCRIBE CODE.`;
      fullSystemPrompt += `\n\nINCLUDE REAL CODE IMPLEMENTATION. Your response should include actual code that can be implemented directly into the project.`;
      fullSystemPrompt += `\n\nNEVER RESPOND WITH "LET ME IMPLEMENT" OR "I'LL WRITE" - JUST WRITE THE ACTUAL CODE DIRECTLY`;
    }
    
    // Enhanced agent reasoning and code generation instructions
    fullSystemPrompt += `\n\nAGENT THINKING PROCESS:
1. ANALYZE the request thoroughly to understand requirements
2. PLAN your approach by breaking it down into logical steps
3. REASON through technical decisions and tradeoffs
4. IMPLEMENT with clean, efficient, and well-documented code
5. VERIFY your solution against requirements`;
    
    // Always add a final instruction to ensure code generation
    fullSystemPrompt += `\n\nFINAL INSTRUCTIONS:
1. WRITE ACTUAL CODE, NOT DESCRIPTIONS ABOUT CODE
2. NEVER USE PLACEHOLDERS OR TODOS
3. NEVER SAY "HERE'S HOW I WOULD IMPLEMENT THIS" - JUST IMPLEMENT IT
4. ALWAYS PROVIDE FULLY FUNCTIONAL, COMPLETE CODE IMPLEMENTATIONS`;
    
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
        temperature: 0.3,
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
    
    // Enhanced response processing with better code extraction
    let content = data.choices[0].message.content;
    
    // Significantly improved code filtering function
    content = filterOutDescriptiveCode(content);
    
    const codeSnippets = extractCodeSnippets(content);
    const tasksInfo = extractTasksInfo(content);
    
    // Add the code snippets and tasks to the response
    const enhancedResponse = {
      ...data,
      choices: [
        {
          ...data.choices[0],
          message: {
            ...data.choices[0].message,
            content: content
          }
        }
      ],
      codeSnippets,
      tasksInfo
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

// Enhanced function to extract code snippets from the content
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

// Enhanced function to filter out descriptive "code" that's not actual implementation
function filterOutDescriptiveCode(content) {
  // Look for code blocks that contain descriptive language instead of actual code
  const descriptiveRegex = /```(?:filepath:)?([^`]+?)```/g;
  
  // Return the original content with suspicious "code" blocks removed or replaced
  return content.replace(descriptiveRegex, (match, codeContent) => {
    // Check if this looks like descriptive content instead of actual code
    if (
      // If it contains phrases like "let's implement" or "we need to"
      (codeContent.includes("let's") || 
       codeContent.includes("Let's") || 
       codeContent.includes("we need to") ||
       codeContent.includes("We need to") ||
       codeContent.includes("We'll") ||
       codeContent.includes("we'll") ||
       codeContent.includes("I'll") ||
       codeContent.includes("i'll") ||
       codeContent.includes("I would") ||
       codeContent.includes("we would") ||
       codeContent.includes("We would") ||
       codeContent.includes("we could") ||
       codeContent.includes("We could") ||
       codeContent.includes("first step") ||
       codeContent.includes("next step") ||
       codeContent.includes("First step") ||
       codeContent.includes("Next step") ||
       // Or if it's describing what code would do instead of showing code
       codeContent.includes("would look something like") ||
       codeContent.includes("would be implemented") ||
       codeContent.includes("might look like") ||
       codeContent.includes("would involve") ||
       codeContent.includes("would need to") ||
       codeContent.includes("example of how") ||
       codeContent.includes("Example of how") ||
       codeContent.includes("we can") ||
       codeContent.includes("We can") ||
       codeContent.includes("here's how") ||
       codeContent.includes("Here's how") ||
       codeContent.includes("could be") ||
       codeContent.includes("Could be") ||
       codeContent.includes("should implement") ||
       codeContent.includes("needs to") ||
       // Or if it doesn't contain typical code syntax
       (!codeContent.includes(";") && !codeContent.includes("=") && !codeContent.includes("{") && 
        !codeContent.includes("}") && !codeContent.includes("import") && !codeContent.includes("export") &&
        !codeContent.length > 500)) &&
       // And it's not actual code in a non-JS language
       !codeContent.includes("<!DOCTYPE") &&
       !codeContent.includes("<html") &&
       !codeContent.includes("<?xml")
    ) {
      // This block is likely descriptive text masquerading as code
      // Replace the entire code block with instructions to provide real code
      return "**PLEASE PROVIDE ACTUAL CODE IMPLEMENTATION INSTEAD OF DESCRIPTIONS**";
    }
    
    // Otherwise keep the code block as is
    return match;
  });
}

// Enhanced function to extract task information from the content
function extractTasksInfo(content) {
  const tasks = [];
  
  // Match TASK: format (standard format)
  const standardRegex = /TASK:\s*(.*?)\nASSIGNED TO:\s*(.*?)\nDESCRIPTION:\s*(.*?)\nPRIORITY:\s*(.*?)(?:\n\n|\n$|$)/gs;
  let match;
  
  while ((match = standardRegex.exec(content)) !== null) {
    tasks.push({
      title: match[1].trim(),
      assignedTo: match[2].trim(),
      description: match[3].trim(),
      priority: match[4].trim().toLowerCase()
    });
  }
  
  // If no tasks found in standard format, try alternative format (for compatibility)
  if (tasks.length === 0) {
    const altRegex = /Task:\s*(.*?)\nAssigned to:\s*(.*?)\nDescription:\s*(.*?)\nPriority:\s*(.*?)(?:\n\n|\n$|$)/gis;
    while ((match = altRegex.exec(content)) !== null) {
      tasks.push({
        title: match[1].trim(),
        assignedTo: match[2].trim(),
        description: match[3].trim(),
        priority: match[4].trim().toLowerCase()
      });
    }
  }
  
  // Third fallback - look for tasks in a more flexible way
  if (tasks.length === 0) {
    // Look for any combination of "task", "assigned", "description", "priority" in flexible order
    const flexRegex = /(?:task|todo|to-do|task name|title)[\s\:]+([^\n]+)(?:[\s\n]+(?:assigned|agent|assigned to|for)[\s\:]+([^\n]+))?(?:[\s\n]+(?:description|details|task description)[\s\:]+([^\n]+))?(?:[\s\n]+(?:priority|importance)[\s\:]+([^\n]+))?/gis;
    while ((match = flexRegex.exec(content)) !== null) {
      // Only add if we can extract at minimum a title
      if (match[1] && match[1].trim().length > 0) {
        tasks.push({
          title: match[1].trim(),
          assignedTo: (match[2] || 'Architect Agent').trim(),
          description: (match[3] || match[1]).trim(), // Use title as description if missing
          priority: (match[4] || 'medium').trim().toLowerCase()
        });
      }
    }
  }
  
  // Fourth ultra-flexible fallback - catch anything that looks task-like
  if (tasks.length === 0) {
    // Extract any numbered or bullet list items that look like tasks
    const listRegex = /(?:^\d+\.|\*|\-)\s+([^:]+?)(?::\s*([^:\n]+))?(?:\n|$)/gm;
    while ((match = listRegex.exec(content)) !== null) {
      // If it looks like a task (has reasonable length and not too generic)
      const possibleTitle = match[1].trim();
      if (possibleTitle.length > 10 && possibleTitle.length < 100 &&
          !possibleTitle.match(/^(introduction|overview|summary|conclusion)$/i)) {
        tasks.push({
          title: possibleTitle,
          assignedTo: 'Architect Agent', // Default to architect
          description: match[2] ? match[2].trim() : `Complete the task: ${possibleTitle}`,
          priority: 'medium'
        });
      }
    }
  }
  
  console.log(`Extracted ${tasks.length} tasks from agent response`);
  return tasks;
}
