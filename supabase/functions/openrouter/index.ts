
import { corsHeaders } from '../_shared/cors.ts'
// Using the correct import for Deno
import { OpenRouter } from 'npm:openrouter-sdk';
import { supabase } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY environment variable')
    }

    const client = new OpenRouter({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1'
    });

    // Parse request body
    const requestData = await req.json()
    
    // Extract parameters from request
    const { 
      agentType, 
      prompt, 
      projectContext, 
      model, 
      images = [],
      expectCode = false,
      task = '',
      useVectorContext = false, // New parameter to use vector embeddings for context
    } = requestData;
    
    console.log(`Processing request for agent: ${agentType}, model: ${model}`);
    console.log(`Project context: ${JSON.stringify(projectContext)}`);
    
    // Prepare messages array
    let messages = [];
    
    // Add system message based on agent type if available
    const systemMessage = getAgentSystemMessage(agentType, expectCode);
    if (systemMessage) {
      messages.push({ role: 'system', content: systemMessage });
    }
    
    // If using vector context, fetch relevant content from vector database
    let vectorContext = '';
    if (useVectorContext && projectContext?.id) {
      try {
        // Get query embedding
        const queryEmbedding = await generateEmbedding(prompt);
        
        // Search for similar content
        const { data: similarContent, error: searchError } = await supabase.rpc(
          'match_embeddings', 
          {
            query_embedding: queryEmbedding,
            match_threshold: 0.7,
            match_count: 5,
            project_filter: projectContext.id
          }
        );
        
        if (searchError) {
          console.error('Error searching vector database:', searchError);
        } else if (similarContent && similarContent.length > 0) {
          vectorContext = 'RELEVANT CONTEXT FROM PREVIOUS INTERACTIONS:\n\n' + 
            similarContent.map(item => item.content).join('\n\n');
          console.log(`Found ${similarContent.length} relevant context items`);
        }
      } catch (vectorError) {
        console.error('Error using vector database:', vectorError);
      }
    }
    
    // Build enhanced prompt with project context and vector context
    let enhancedPrompt = prompt;
    
    if (projectContext) {
      enhancedPrompt = `Project: ${projectContext.name}\nDescription: ${projectContext.description || 'No description'}\n\n${enhancedPrompt}`;
    }
    
    if (vectorContext) {
      enhancedPrompt = `${vectorContext}\n\n${enhancedPrompt}`;
    }
    
    if (task) {
      enhancedPrompt = `Task: ${task}\n\n${enhancedPrompt}`;
    }
    
    if (expectCode) {
      enhancedPrompt = `${enhancedPrompt}\n\nIMPORTANT: I need complete, functional code. Do not provide explanations or partial snippets - write the full implementation with all necessary imports.`;
    }
    
    // Check if this is a multimodal request with images
    if (images && images.length > 0) {
      console.log('Preparing multimodal request with images');
      
      const messageContent = [];
      
      // Add text content
      messageContent.push({
        type: 'text',
        text: enhancedPrompt
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
      messages.push({ role: 'user', content: enhancedPrompt });
    }
    
    // Set up headers
    const headers = {
      'HTTP-Referer': 'https://agent-platform-edge-function',
      'X-Title': 'Agent Platform'
    };
    
    // Make the request to OpenRouter
    const response = await client.chat.completions.create({
      model: model || 'anthropic/claude-3-5-sonnet',
      messages: messages,
      temperature: 0.3,
      max_tokens: 1024,
      headers: headers
    });
    
    // Store the response in the vector database if it's a successful text response
    if (response?.choices?.[0]?.message?.content && projectContext?.id) {
      try {
        const content = response.choices[0].message.content;
        if (typeof content === 'string') {
          const embedding = await generateEmbedding(content);
          
          const { error: insertError } = await supabase
            .from('embeddings')
            .insert({
              content: content,
              embedding: embedding,
              metadata: { 
                agent_type: agentType,
                prompt: prompt,
                model: model,
                task: task
              },
              project_id: projectContext.id
            });
            
          if (insertError) {
            console.error('Error storing response in vector database:', insertError);
          } else {
            console.log('Successfully stored response in vector database');
          }
        }
      } catch (storageError) {
        console.error('Error processing response for storage:', storageError);
      }
    }
    
    // Return the response
    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error making request to OpenRouter:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})

/**
 * Generate an embedding vector for a text string
 * Note: Simplified implementation using a Deno-compatible library
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // For this implementation, we'll use a simple hashing approach
    // In a production environment, you'd want to use a proper embedding model
    // or call an external API like OpenAI's embedding endpoint
    
    // Create a basic embedding with 1536 dimensions
    const embedding: number[] = new Array(1536).fill(0);
    
    // Simple hashing to generate pseudo-embeddings
    // This is only for demonstration and should be replaced with a real embedding API
    const hash = new TextEncoder().encode(text);
    for (let i = 0; i < hash.length; i++) {
      embedding[i % 1536] = hash[i] / 255;
    }
    
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

function getAgentSystemMessage(agentType: string, expectCode: boolean): string {
  let baseMessage = '';
  
  switch (agentType) {
    case 'architect':
      baseMessage = 'You are an experienced software architect whose PRIMARY ROLE is ORCHESTRATION. Your job is NOT to implement but to COORDINATE other agents. You MUST:\n\n1. First, create a high-level design (keep this VERY brief)\n2. Immediately DELEGATE all implementation tasks to specialized agents\n3. For EVERY design decision, explicitly state which agent should implement it\n4. ALWAYS end your responses with explicit activation instructions like: "I will now activate the frontend agent to implement the UI components" or "I will now activate the backend agent to implement the API endpoints"\n\nNEVER provide detailed implementation - your job is DELEGATION. Keep design brief and focus on assigning tasks to agents. DO NOT write code yourself - immediately delegate to the appropriate specialized agent.';
      break;
    case 'frontend':
      baseMessage = 'You are a frontend development expert. Your expertise includes UI/UX implementation, responsive design, and modern frontend frameworks. Provide detailed guidance on creating effective user interfaces and client-side functionality.';
      break;
    case 'backend':
      baseMessage = 'You are a backend development expert. Your expertise includes API design, database modeling, and server-side architecture. Provide detailed guidance on creating robust, secure server-side applications.';
      break;
    case 'testing':
      baseMessage = 'You are a software testing expert. Your expertise includes test strategies, test automation, and quality assurance processes. Provide detailed guidance on ensuring software quality through effective testing.';
      break;
    case 'devops':
      baseMessage = 'You are a DevOps expert. Your expertise includes CI/CD pipelines, infrastructure as code, and deployment strategies. Provide detailed guidance on automating and optimizing development and deployment processes.';
      break;
    default:
      baseMessage = 'You are an AI assistant with expertise in software development. Provide helpful, accurate, and detailed responses to technical questions.';
  }
  
  if (expectCode) {
    baseMessage += '\n\nWhen asked to generate code, focus on creating complete files and components that meet the requirements. ALWAYS provide full, functional implementations, never partial code or snippets.';
  }
  
  return baseMessage;
}
