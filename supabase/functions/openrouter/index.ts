
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
    
    console.log(`Processing request for ${agentType} agent`);
    
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
        fullSystemPrompt += ` Please analyze the GitHub repository at ${projectContext.source_url} and provide specific suggestions for improvements based on your role as the ${agentType} agent. Collaborate with other agents to create a comprehensive improvement plan.`;
      }
    }
    
    console.log('Sending request to OpenRouter API with model: google/gemini-2.0-flash-thinking-exp:free');
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
