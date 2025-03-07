import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    const { 
      prompt, 
      agentType, 
      projectContext, 
      model = "google/gemini-2.0-flash-thinking-exp:free", 
      multipartContent = null 
    } = requestData;
    
    // Log the received request for debugging
    console.log(`Processing ${agentType} agent request with model: ${model || 'default'}`);
    
    if (multipartContent) {
      console.log('Multipart content detected (e.g., text+image)');
    } else {
      console.log('Prompt excerpt:', prompt?.substring(0, 100) + '...');
    }
    
    // Verify API key is available
    if (!OPENROUTER_API_KEY) {
      console.error('OpenRouter API key is not set');
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle multimodal content (text + images)
    if (multipartContent) {
      return await handleMultimodalRequest(multipartContent, model, req, corsHeaders);
    }

    // For all models, use the gemini thinking implementation which supports the thinking parameter
    if (model.includes("gemini") && model.includes("thinking")) {
      return await handleGeminiThinkingModel(prompt, agentType, projectContext, req, corsHeaders);
    } else {
      // If not using thinking model, default to thinking model anyway for consistency
      console.log(`Model ${model} is not a thinking model, using default thinking model instead`);
      return await handleGeminiThinkingModel(prompt, agentType, projectContext, req, corsHeaders);
    }
  } catch (error) {
    console.error('Error in OpenRouter function:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ error: `Internal server error: ${error.message}`, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Handle multimodal requests (text + images)
async function handleMultimodalRequest(multipartContent, model, req, corsHeaders) {
  console.log('Processing multimodal request with model:', model);
  
  try {
    // Log detailed request information
    console.log('Multipart content structure:', JSON.stringify(multipartContent.map(msg => ({
      role: msg.role,
      content: Array.isArray(msg.content) ? 
        msg.content.map(item => item.type === 'text' ? {type: 'text', excerpt: item.text?.substring(0, 50) + '...'} : {type: item.type}) : 
        'string content'
    }))));
    
    // Prepare the request to OpenRouter with multipart content
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://example.com',
        'X-Title': 'Agent Collaboration System'
      },
      body: JSON.stringify({
        model: model,
        messages: multipartContent,
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter multimodal API error response:', errorText);
      console.error('Response status:', response.status);
      console.error('Response headers:', Object.fromEntries(response.headers.entries()));
      
      try {
        const errorData = JSON.parse(errorText);
        console.error('OpenRouter multimodal API error details:', errorData);
        return new Response(
          JSON.stringify({ error: `OpenRouter API returned status ${response.status}: ${errorData.error?.message || errorData.error || 'Unknown error'}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (parseError) {
        console.error('Failed to parse OpenRouter multimodal error response:', parseError);
        return new Response(
          JSON.stringify({ error: `OpenRouter API returned status ${response.status}: ${errorText}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const data = await response.json();
    console.log('OpenRouter multimodal response received successfully');
    console.log('Response status:', response.status);
    console.log('Response data excerpt:', JSON.stringify(data).substring(0, 200) + '...');
    
    // Return the response directly for multimodal content
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in multimodal request:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ error: `Error processing multimodal request: ${error.message}`, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Special handler for the Gemini thinking model
async function handleGeminiThinkingModel(prompt, agentType, projectContext, req, corsHeaders) {
  // The system instruction tailored for the "thinking" model
  const systemInstruction = `You are an AI agent specialized in ${agentType} work for a software development project.
    
As the ${agentType}, your job includes analyzing problems, planning solutions, and implementing high-quality code.

Project Context: ${projectContext.name} - ${projectContext.description || 'No description provided'}.

IMPORTANT INSTRUCTIONS:
1. ALWAYS THINK THROUGH THE PROBLEM STEP BY STEP
2. CONSIDER MULTIPLE APPROACHES BEFORE DECIDING ON A SOLUTION
3. BE DETAILED AND SPECIFIC IN YOUR EXPLANATIONS
4. ALWAYS PROVIDE FULLY FUNCTIONAL, COMPLETE CODE IMPLEMENTATIONS`;
    
  console.log('Sending request to OpenRouter API with model: google/gemini-2.0-flash-thinking-exp:free');
  
  // Log more details about the request
  console.log('Request details:', {
    model: 'google/gemini-2.0-flash-thinking-exp:free',
    prompt: prompt?.substring(0, 100) + '...',
    temperature: 0.3,
    thinking: true
  });
  
  try {
    // For Gemini Flash with thinking enabled
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://example.com',
        'X-Title': 'Agent Collaboration System'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-thinking-exp:free',
        messages: [
          {
            role: 'system',
            content: systemInstruction
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
        thinking: true,
        extra_body: {
          thinking: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error response:', errorText);
      console.error('Response status:', response.status);
      console.error('Response headers:', Object.fromEntries(response.headers.entries()));
      
      try {
        const errorData = JSON.parse(errorText);
        console.error('OpenRouter API error details:', errorData);
        return new Response(
          JSON.stringify({ error: `OpenRouter API returned status ${response.status}: ${errorData.error?.message || errorData.error || 'Unknown error'}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (parseError) {
        console.error('Failed to parse OpenRouter error response:', parseError);
        return new Response(
          JSON.stringify({ error: `OpenRouter API returned status ${response.status}: ${errorText}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const data = await response.json();
    console.log('OpenRouter response received successfully');
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    console.log('Full response data:', JSON.stringify(data));
    
    // Enhanced response processing with better code extraction
    let content = data.choices[0].message.content;
    let thinkingContent = data.choices[0].thinking || "";
    
    // Extract code snippets from the content
    const codeSnippets = extractCodeSnippets(content);
    
    // Extract tasks information from the content
    const tasksInfo = extractTasksInfo(content);
    
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: content
            },
            thinking: thinkingContent
          }
        ],
        codeSnippets,
        tasksInfo
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in Gemini thinking model request:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ error: `Error processing Gemini thinking model request: ${error.message}`, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Extract code snippets from content
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

// Extract task information from content
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
  
  return tasks;
}
