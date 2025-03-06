
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
    
    // Different system prompts based on agent type with focus on task creation without summaries
    const systemPrompts = {
      'architect': `You are the Architect Agent, responsible for analyzing code repositories and delegating specific tasks to specialized agents. 

IMPORTANT: Keep your responses concise and focused on actionable tasks. Do not provide lengthy analysis.

OUTPUT FORMAT - YOU MUST USE THIS EXACT FORMAT FOR EACH TASK:
Task 1: [Brief description]
Assigned to: [Frontend/Backend/Testing/DevOps] Agent

Task 2: [Brief description]
Assigned to: [Frontend/Backend/Testing/DevOps] Agent

[Continue for each task...]

IMPORTANT: Do not return complex objects in error messages. Always convert errors to simple string messages.`,
      'frontend': 'You are the Frontend Agent. Keep responses concise and focused on specific frontend tasks. Avoid lengthy explanations unless explicitly asked.',
      'backend': 'You are the Backend Agent. Keep responses concise and focused on specific backend tasks. Avoid lengthy explanations unless explicitly asked.',
      'testing': 'You are the Testing Agent. Keep responses concise and focused on specific testing tasks. Avoid lengthy explanations unless explicitly asked.',
      'devops': 'You are the DevOps Agent. Keep responses concise and focused on specific DevOps tasks. Avoid lengthy explanations unless explicitly asked.'
    };
    
    const systemPrompt = systemPrompts[agentType] || 'You are an AI assistant helping with software development. Keep responses concise and focused on actionable tasks.';
    
    // Create a more focused context that emphasizes task creation
    let fullSystemPrompt = systemPrompt;
    
    if (projectContext && Object.keys(projectContext).length > 0) {
      // Add basic project context
      fullSystemPrompt += ` Project context: ${JSON.stringify(projectContext)}`;
      
      // Add specific GitHub context if available with focus on task creation
      if (projectContext.sourceUrl && projectContext.sourceUrl.includes('github.com')) {
        fullSystemPrompt += ` When analyzing GitHub repositories, focus on creating specific, actionable tasks without lengthy explanations. Be concise.`;
      }
    }
    
    // Enhanced instructions for code formatting
    fullSystemPrompt += ` When providing code examples, use markdown code blocks with language and file path. Example: \`\`\`typescript [src/utils/helper.ts]\nconst helper = () => {};\n\`\`\`.`;
    
    // Add specific task generation instructions if this looks like a GitHub analysis request
    if (prompt.includes('list') && prompt.includes('task') && projectContext.sourceUrl) {
      fullSystemPrompt += ` Format your response as a numbered list of specific, actionable tasks. Each task should have a clear title and assigned agent. Be concise.`;
    }

    // Add detailed instructions for task execution
    if (prompt.includes('Execute the following task:')) {
      fullSystemPrompt += ` Provide a concise solution to the task, focusing on code implementation rather than lengthy explanations.`;
    }
    
    console.log('Sending request to OpenRouter API with model: anthropic/claude-3.7-sonnet:thinking');
    
    // For Claude with thinking enabled, we need to configure appropriate token limits
    // The 'thinking' feature requires max_tokens to be greater than thinking.budget_tokens
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev', 
        'X-Title': 'Agentic Development Platform',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.7-sonnet:thinking',
        messages: [
          { role: 'system', content: fullSystemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4096,  // Increased from 1024 to accommodate thinking.budget_tokens requirement
        thinking: {
          enabled: true,
          budget_tokens: 2048  // Allocate tokens for thinking, which must be less than max_tokens
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
