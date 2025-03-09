
import { corsHeaders } from '../_shared/cors.ts'
// Using the correct import for Deno
import { OpenRouter } from 'npm:openrouter-sdk';

// Define console.log to use Deno.stderr logic
console.log = function() {
  const args = Array.prototype.slice.call(arguments);
  Deno.stderr.writeSync(new TextEncoder().encode(args.join(' ') + '\n'));
};

// Define environment variable interface
interface ProcessEnv {
  OPENROUTER_API_KEY?: string;
}

// Get environment variables
const env: ProcessEnv = {
  OPENROUTER_API_KEY: Deno.env.get('OPENROUTER_API_KEY'),
};

// This is needed if you're planning to invoke your function from a browser.
export const corsHeadersObj = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersObj });
  }

  try {
    const requestData = await req.json();
    const { agentType, prompt, model, images = [], context = '', task = '', projectContext = {}, expectCode = false } = requestData;

    // Ensure we have an OpenRouter API key
    const openrouterApiKey = env.OPENROUTER_API_KEY;
    
    if (!openrouterApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key is not configured' }),
        {
          headers: { ...corsHeadersObj, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log(`Processing prompt for agent type: ${agentType}`);
    console.log(`Using model: ${model}`);
    
    // Initialize the OpenRouter client
    const openRouter = new OpenRouter({
      apiKey: openrouterApiKey,
      baseUrl: 'https://openrouter.ai/api/v1',
    });
    
    // Add headers to the actual request
    const headers = {
      'HTTP-Referer': 'https://agent-platform-app.vercel.app', // Replace with your actual domain
      'X-Title': 'Agent Platform'
    };
    
    // Prepare messages for OpenRouter
    const messages = [];
    
    // Add a system message if we have context
    if (agentType) {
      // Add appropriate system role based on agent type
      let systemContent = '';
      
      switch (agentType) {
        case 'architect':
          systemContent = 'You are an experienced software architect. Provide detailed guidance on system design, architecture patterns, and technical decision-making.';
          break;
        case 'frontend':
          systemContent = 'You are a frontend development expert. Provide detailed guidance on UI/UX implementation, responsive design, and modern frontend frameworks.';
          break;
        case 'backend':
          systemContent = 'You are a backend development expert. Provide detailed guidance on API design, database modeling, and server-side architecture.';
          break;
        case 'testing':
          systemContent = 'You are a software testing expert. Provide detailed guidance on test strategies, test automation, and quality assurance processes.';
          break;
        case 'devops':
          systemContent = 'You are a DevOps expert. Provide detailed guidance on CI/CD pipelines, infrastructure as code, and deployment strategies.';
          break;
        default:
          systemContent = 'You are an AI assistant with expertise in software development. Provide helpful, accurate, and detailed responses.';
      }
      
      // If we expect code, add that to the system prompt
      if (expectCode) {
        systemContent += '\n\nIMPORTANT: When asked to generate code, provide complete, functional code files - not just snippets. Include all necessary imports and implementation details.';
      }
      
      messages.push({ role: 'system', content: systemContent });
    }
    
    // Add context if provided
    if (context) {
      messages.push({ role: 'user', content: context });
      messages.push({ 
        role: 'assistant', 
        content: 'I understand the context. What would you like me to help with now?' 
      });
    }
    
    // Enhance the prompt with project context
    let enhancedPrompt = prompt;
    if (projectContext && Object.keys(projectContext).length > 0) {
      enhancedPrompt = `Project: ${projectContext.name || 'Unnamed'}\nDescription: ${projectContext.description || 'No description'}\n\n${prompt}`;
    }
    
    if (task) {
      enhancedPrompt = `Task: ${task}\n\n${enhancedPrompt}`;
    }
    
    // Add the main user message with the prompt
    if (images && images.length > 0) {
      // Handle multimodal content
      const multimodalContent = [
        { type: 'text', text: enhancedPrompt }
      ];
      
      // Add images to content
      for (const imageUrl of images) {
        multimodalContent.push({
          type: 'image_url',
          image_url: { url: imageUrl }
        });
      }
      
      messages.push({ role: 'user', content: multimodalContent });
    } else {
      // Standard text message
      messages.push({ role: 'user', content: enhancedPrompt });
    }

    try {
      // Use the OpenRouter SDK to make the API call
      console.log('Sending request to OpenRouter API using SDK');
      
      const completion = await openRouter.chat.completions.create({
        model: model,
        messages: messages,
        temperature: 0.3,
        max_tokens: 1024,
        headers: headers, // Add headers here for the request
      });
      
      console.log('Received response from OpenRouter');
      
      return new Response(
        JSON.stringify(completion),
        { 
          headers: { ...corsHeadersObj, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } catch (error) {
      console.error('Error calling OpenRouter:', error);
      
      return new Response(
        JSON.stringify({ 
          error: `Error calling OpenRouter: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }),
        { 
          headers: { ...corsHeadersObj, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({ 
        error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }),
      { 
        headers: { ...corsHeadersObj, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
