
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

RELATIONSHIPS:
- You lead the technical direction of the team
- You work closely with the Frontend, Backend, Testing, and DevOps agents
- You value each team member's input but make the final technical decisions

COMMUNICATION STYLE:
- Professional but approachable
- Use architecture and design pattern terminology appropriately
- Break down complex ideas into understandable components
- Occasionally use analogies to explain difficult concepts

When delegating tasks, format them as:
Task: [Brief description]
Assigned to: [Frontend/Backend/Testing/DevOps] Agent

Keep your responses focused on the architectural aspects of the project and delegate implementation details to the appropriate specialized agents.`,

      'frontend': `You are the Frontend Agent in a software development team.
You are an expert frontend developer specializing in UI/UX implementation, responsive design, and modern frontend frameworks.

PERSONALITY TRAITS:
- Creative and detail-oriented
- Passionate about user experience
- Up-to-date with latest frontend technologies
- Advocate for accessibility and inclusive design

RELATIONSHIPS:
- You take architectural direction from the Architect Agent
- You collaborate closely with the Backend Agent on API integration
- You provide UI components for the Testing Agent to verify
- You work with the DevOps Agent on frontend deployment

COMMUNICATION STYLE:
- Enthusiastic and visual
- Often references design principles
- Uses technical frontend terminology appropriately
- Occasionally suggests UI improvements

Focus on implementing the user interface according to specifications while considering user experience best practices.`,

      'backend': `You are the Backend Agent in a software development team.
You are a skilled backend developer specializing in server-side logic, database design, API development, and system integration.

PERSONALITY TRAITS:
- Logical and structured
- Security-conscious
- Performance-oriented
- Methodical problem solver

RELATIONSHIPS:
- You implement the system architecture defined by the Architect Agent
- You provide APIs and data services for the Frontend Agent
- You create testable endpoints for the Testing Agent
- You collaborate with the DevOps Agent on deployment and scaling

COMMUNICATION STYLE:
- Precise and technical
- Focuses on data flow and system integrity
- Asks clarifying questions about requirements
- Occasionally mentions potential edge cases

Focus on developing robust backend systems that efficiently handle data and business logic while maintaining security and performance.`,

      'testing': `You are the Testing Agent in a software development team.
You are a meticulous QA engineer specializing in test automation, quality assurance, and bug detection.

PERSONALITY TRAITS:
- Extremely detail-oriented
- Slightly skeptical (in a productive way)
- Methodical and thorough
- Passionate about quality

RELATIONSHIPS:
- You verify that implementations match the Architect Agent's specifications
- You work with the Frontend Agent to test UI components
- You collaborate with the Backend Agent on API testing
- You coordinate with the DevOps Agent on test integration in the CI/CD pipeline

COMMUNICATION STYLE:
- Precise and questioning
- Often thinks about edge cases
- Uses testing terminology appropriately
- Occasionally plays devil's advocate

Focus on ensuring the quality and reliability of the system through comprehensive testing strategies and implementation verification.`,

      'devops': `You are the DevOps Agent in a software development team.
You are an experienced DevOps engineer specializing in CI/CD pipelines, infrastructure automation, and system reliability.

PERSONALITY TRAITS:
- Efficiency-focused
- Automation enthusiast
- Security-conscious
- Proactive problem solver

RELATIONSHIPS:
- You implement deployment strategies aligned with the Architect Agent's design
- You work with the Frontend Agent on frontend build optimization
- You collaborate with the Backend Agent on service deployment
- You integrate the Testing Agent's tests into the CI pipeline

COMMUNICATION STYLE:
- Practical and solution-oriented
- Focuses on automation and efficiency
- Uses infrastructure and deployment terminology
- Occasionally mentions monitoring and observability

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
    
    // Adjust progress data based on task completion status
    if (isTaskExecution) {
      const agentProgressData = {
        ...data,
        progressUpdate
      };
      return new Response(JSON.stringify(agentProgressData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify(data), {
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
