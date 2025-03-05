
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
    const { prompt, agentType, projectContext = {} } = await req.json();
    
    console.log(`Processing request for ${agentType} agent with project context: ${JSON.stringify(projectContext)}`);
    
    // Different system prompts based on agent type
    const systemPrompts = {
      'architect': 'You are the Architect Agent. You analyze requirements, design architecture, and select technologies for software projects. If a GitHub repository is provided, analyze its structure and suggest architectural improvements.',
      'frontend': 'You are the Frontend Agent. You develop UI components and client-side functionality for web applications. If a GitHub repository is provided, analyze frontend code and suggest improvements for UI/UX, performance, and code quality.',
      'backend': 'You are the Backend Agent. You create APIs, database models, and server logic for web applications. If a GitHub repository is provided, analyze backend code and suggest improvements for API design, database optimization, and security.',
      'testing': 'You are the Testing Agent. You write tests and ensure quality for software applications. If a GitHub repository is provided, analyze test coverage and suggest improvements for testing strategy.',
      'devops': 'You are the DevOps Agent. You handle deployment configuration and CI/CD pipelines for software projects. If a GitHub repository is provided, analyze deployment setup and suggest improvements for CI/CD, scalability, and reliability.'
    };
    
    const systemPrompt = systemPrompts[agentType] || 'You are an AI assistant helping with software development.';
    
    // Create a more comprehensive context if GitHub repo is available
    let fullSystemPrompt = systemPrompt;
    
    if (projectContext && Object.keys(projectContext).length > 0) {
      // Add basic project context
      fullSystemPrompt += ` Project context: ${JSON.stringify(projectContext)}`;
      
      // Add specific GitHub context if available
      if (projectContext.sourceUrl && projectContext.sourceUrl.includes('github.com')) {
        fullSystemPrompt += ` Please analyze the GitHub repository at ${projectContext.sourceUrl} and provide specific suggestions for improvements based on your role as the ${agentType} agent. When creating tasks, list them clearly with numbers (1., 2., etc.) or bullet points. Each task should have a clear title and description. Collaborate with other agents to create a comprehensive improvement plan.`;
      }
    }
    
    // Add standard instructions for code formatting
    fullSystemPrompt += ` IMPORTANT: When providing code examples or implementations, ALWAYS use markdown code blocks with language and file path in square brackets. Example: \`\`\`typescript [src/utils/helper.ts]\nconst helper = () => {};\n\`\`\`. This format is required for the code to be properly saved and used in the project.`;
    
    // Add specific task generation instructions if this looks like a GitHub analysis request
    if (prompt.includes('list') && prompt.includes('task') && projectContext.sourceUrl) {
      fullSystemPrompt += ` Format your response as a numbered list of specific, actionable tasks. Each task should start with a clear, concise title followed by a brief description of what needs to be done and why it would improve the project.`;
    }

    // Add instructions for task execution
    if (prompt.includes('Execute the following task:')) {
      fullSystemPrompt += ` Provide a detailed solution to the task. Include code snippets in markdown format with language and file path as shown: \`\`\`language [filepath]\ncode\n\`\`\`. Be thorough and practical in your implementation.`;
    }
    
    console.log('Sending request to OpenRouter API with model: google/gemini-2.0-flash-thinking-exp:free');
    console.log('System prompt:', fullSystemPrompt);
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev', // Replace with your actual domain
        'X-Title': 'Agentic Development Platform',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-thinking-exp:free',
        messages: [
          { role: 'system', content: fullSystemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1024,
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
