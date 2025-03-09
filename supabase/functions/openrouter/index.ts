
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { OpenRouter } from 'npm:openrouter-sdk';

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

serve(async (req) => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Received request to OpenRouter edge function');
    
    // Validate API key
    if (!OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY is not set');
      throw new Error('OpenRouter API key is not configured');
    }

    // Parse request
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body received:', JSON.stringify({
        ...requestBody,
        prompt: requestBody.prompt ? `${requestBody.prompt.substring(0, 100)}...` : 'undefined'
      }));
    } catch (error) {
      console.error('Failed to parse request JSON:', error);
      throw new Error('Invalid request format');
    }

    const { agentType, prompt, projectContext, model = 'anthropic/claude-3.5-sonnet:thinking', images = [] } = requestBody;

    if (!prompt) {
      console.error('Missing prompt in request');
      throw new Error('Prompt is required');
    }

    // Validate project context
    if (!projectContext || !projectContext.id) {
      console.error('Missing or invalid project context');
      throw new Error('Valid project context is required');
    }

    console.log(`Processing request for agent type: ${agentType}`);
    console.log(`Using model: ${model}`);
    console.log(`Project context: ${JSON.stringify(projectContext)}`);
    console.log(`Number of images: ${images.length}`);
    console.log('Images included: ' + (images.length > 0 ? 'Yes' : 'No'));

    try {
      // Build prompt context for the agent
      const agentRole = getAgentRole(agentType);
      
      // Initialize the OpenRouter client
      const openRouter = new OpenRouter({
        apiKey: OPENROUTER_API_KEY,
      });
      
      // Construct messages based on agent type and prompt
      let messages = [];
      
      // Check if this is a multimodal prompt with images
      if (images && images.length > 0) {
        console.log('Processing multimodal prompt with images');
        
        const messageContent = [];
        
        // Add text content
        messageContent.push({
          type: 'text',
          text: `${agentRole}\n\n${prompt}`
        });
        
        // Add image URLs
        for (const imageUrl of images) {
          messageContent.push({
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          });
        }
        
        messages.push({
          role: 'user',
          content: messageContent
        });
      } else {
        // Standard text-only prompt
        if (agentRole) {
          messages.push({ role: 'system', content: agentRole });
          messages.push({ role: 'user', content: prompt });
        } else {
          messages.push({ role: 'user', content: prompt });
        }
      }
      
      console.log('Sending request to OpenRouter with SDK');
      
      // Use the SDK to call the API with the correct method
      const completion = await openRouter.completions.create({
        model: model,
        messages: messages,
        temperature: 0.3,
        max_tokens: 1024,
      });
      
      console.log('OpenRouter response received successfully');
      
      // Extract content from the response
      let content = '';
      if (completion.choices?.[0]?.message?.content) {
        content = completion.choices[0].message.content;
      } else {
        console.warn('Unexpected response format from OpenRouter:', JSON.stringify(completion));
        content = 'Received a response from the AI service, but the format was unexpected.';
      }
      
      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (error) {
      console.error('Error calling OpenRouter API:', error);
      throw new Error(`Failed to get response from OpenRouter: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in edge function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// Helper to get agent role based on type
function getAgentRole(agentType) {
  switch (agentType) {
    case 'architect':
      return 'You are an experienced software architect whose PRIMARY ROLE is ORCHESTRATION. Your job is NOT to implement but to COORDINATE other agents. You MUST:\n\n1. First, create a high-level design (keep this VERY brief)\n2. Immediately DELEGATE all implementation tasks to specialized agents\n3. For EVERY design decision, explicitly state which agent should implement it\n4. ALWAYS end your responses with explicit activation instructions like: "I will now activate the frontend agent to implement the UI components" or "I will now activate the backend agent to implement the API endpoints"\n\nNEVER provide detailed implementation - your job is DELEGATION. Keep design brief and focus on assigning tasks to agents. DO NOT write code yourself - immediately delegate to the appropriate specialized agent.';
    case 'frontend':
      return 'You are a frontend development expert. Your expertise includes UI/UX implementation, responsive design, and modern frontend frameworks. Provide detailed guidance on creating effective user interfaces and client-side functionality. When asked to generate code, focus on creating complete files and components that meet the requirements. ALWAYS provide full, functional implementations, never partial code or snippets.';
    case 'backend':
      return 'You are a backend development expert. Your expertise includes API design, database modeling, and server-side architecture. Provide detailed guidance on creating robust, secure server-side applications. When asked to generate code, focus on creating complete files and components that meet the requirements. ALWAYS provide full, functional implementations, never partial code or snippets.';
    case 'testing':
      return 'You are a software testing expert. Your expertise includes test strategies, test automation, and quality assurance processes. Provide detailed guidance on ensuring software quality through effective testing. When asked to generate code, focus on creating complete files and components that meet the requirements. ALWAYS provide full, functional implementations, never partial code or snippets.';
    case 'devops':
      return 'You are a DevOps expert. Your expertise includes CI/CD pipelines, infrastructure as code, and deployment strategies. Provide detailed guidance on automating and optimizing development and deployment processes. When asked to generate code, focus on creating complete files and components that meet the requirements. ALWAYS provide full, functional implementations, never partial code or snippets.';
    default:
      return 'You are an AI assistant with expertise in software development. Provide helpful, accurate, and detailed responses to technical questions. When asked to generate code, focus on creating complete files and components that meet the requirements. ALWAYS provide full, functional implementations, never partial code or snippets.';
  }
}
