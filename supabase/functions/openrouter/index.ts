
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

  console.log('OpenRouter function called with method:', req.method);

  // Check if API key is available
  if (!OPENROUTER_API_KEY) {
    console.error('OpenRouter API key is not set');
    return new Response(
      JSON.stringify({ error: 'OpenRouter API key is not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed successfully:', JSON.stringify(requestBody));
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt, agentType, projectContext = {} } = requestBody;
    
    if (!prompt) {
      console.error('Prompt is missing from request');
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!agentType) {
      console.error('Agent type is missing from request');
      return new Response(
        JSON.stringify({ error: 'Agent type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing request for ${agentType} agent with prompt: "${prompt.substring(0, 50)}..."`);
    console.log(`Project context: ${JSON.stringify(projectContext)}`);
    
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
      if (projectContext.source_url && projectContext.source_url.includes('github.com')) {
        fullSystemPrompt += ` Please analyze the GitHub repository at ${projectContext.source_url} and provide specific suggestions for improvements based on your role as the ${agentType} agent. When creating tasks, list them clearly with numbers (1., 2., etc.) or bullet points. Each task should have a clear title and description. Collaborate with other agents to create a comprehensive improvement plan.`;
      }
    }
    
    // Add specific task generation instructions if this looks like a GitHub analysis request
    if (prompt.includes('list') && prompt.includes('task') && projectContext.source_url) {
      fullSystemPrompt += ` Format your response as a numbered list of specific, actionable tasks. Each task should start with a clear, concise title followed by a brief description of what needs to be done and why it would improve the project.`;
    }
    
    console.log('Sending request to OpenRouter API with model: google/gemini-2.0-flash-thinking-exp:free');
    console.log('System prompt:', fullSystemPrompt);
    
    try {
      const openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
      console.log(`Making fetch request to: ${openRouterUrl}`);
      
      const response = await fetch(openRouterUrl, {
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
        const errorText = await response.text();
        console.error(`OpenRouter API error: ${response.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ error: `OpenRouter API returned status ${response.status}: ${errorText}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      console.log('OpenRouter response received successfully');
      console.log('Response data:', JSON.stringify(data).substring(0, 200) + '...');
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (fetchError) {
      console.error('Fetch error when calling OpenRouter API:', fetchError);
      return new Response(
        JSON.stringify({ error: `Fetch error: ${fetchError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('General error in openrouter function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
