
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use environment variable or fallback to a direct key - this ensures we have a key one way or another
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || "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";

console.log("OpenRouter function loaded");
console.log(`OpenRouter API Key available: ${OPENROUTER_API_KEY ? 'Yes' : 'No'}`);
console.log(`API Key prefix: ${OPENROUTER_API_KEY?.substring(0, 8)}...`);

serve(async (req) => {
  // For debugging on every request
  console.log(`OpenRouter request received at ${new Date().toISOString()}`);
  console.log(`Request URL: ${req.url}`);
  console.log(`Request method: ${req.method}`);
  console.log('Request headers:', Object.fromEntries(req.headers.entries()));

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Parsing request body");
    const requestData = await req.json();
    console.log("Request data:", JSON.stringify(requestData).substring(0, 500) + "...");
    
    const { 
      prompt, 
      agentType, 
      projectContext, 
      model = "anthropic/claude-3.7-sonnet:thinking", 
      multipartContent = null 
    } = requestData;
    
    // Log the received request for debugging
    console.log(`Processing ${agentType} agent request with model: ${model}`);
    if (projectContext) {
      console.log("Project context:", JSON.stringify(projectContext).substring(0, 200) + "...");
    } else {
      console.log("No project context provided");
    }
    
    if (multipartContent) {
      console.log('Multipart content detected (e.g., text+image)');
    } else {
      console.log(`Prompt excerpt: ${prompt?.substring(0, 100) + '...'}`);
    }
    
    // Verify API key is available
    if (!OPENROUTER_API_KEY) {
      console.error('OpenRouter API key is not set in environment variables or fallback');
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key is not configured. Please set OPENROUTER_API_KEY in Supabase.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`OpenRouter API Key available: ${OPENROUTER_API_KEY ? 'Yes' : 'No'}`);
    console.log(`API Key prefix: ${OPENROUTER_API_KEY?.substring(0, 8)}...`);

    // Handle multimodal content (text + images)
    if (multipartContent) {
      return await handleMultimodalRequest(multipartContent, model, req, corsHeaders);
    }

    // Use Claude thinking model for all requests
    return await handleClaudeThinkingModel(prompt, agentType, projectContext, req, corsHeaders);
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
    
    // Force the correct model
    const modelToUse = "anthropic/claude-3.7-sonnet:thinking";
    console.log(`Using model: ${modelToUse} (overriding ${model} if different)`);
    
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
        model: modelToUse,
        messages: multipartContent,
        temperature: 0.3,
        max_tokens: 4000,
        thinking: true
      })
    });

    // Log response status
    console.log(`OpenRouter multimodal response status: ${response.status}`);

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

// Special handler for the Claude thinking model
async function handleClaudeThinkingModel(prompt, agentType, projectContext, req, corsHeaders) {
  // The system instruction tailored for the "thinking" model
  const systemInstruction = `You are an AI agent specialized in ${agentType} work for a software development project.
    
As the ${agentType}, your job includes analyzing problems, planning solutions, and implementing high-quality code.

Project Context: ${projectContext?.name || 'No name'} - ${projectContext?.description || 'No description provided'}.

IMPORTANT INSTRUCTIONS:
1. ALWAYS THINK THROUGH THE PROBLEM STEP BY STEP
2. CONSIDER MULTIPLE APPROACHES BEFORE DECIDING ON A SOLUTION
3. BE DETAILED AND SPECIFIC IN YOUR EXPLANATIONS
4. ALWAYS PROVIDE FULLY FUNCTIONAL, COMPLETE CODE IMPLEMENTATIONS

If you need to create code, ALWAYS use this format:
\`\`\`filepath:/path/to/file.ext
// code here
\`\`\`

If you identify tasks that need to be completed, use this format:
TASK: [Task name]
ASSIGNED TO: [Agent type, e.g. Frontend]
DESCRIPTION: [Detailed description]
PRIORITY: [high/medium/low]`;
    
  console.log('Sending request to OpenRouter API with model: anthropic/claude-3.7-sonnet:thinking');
  console.log(`OpenRouter API Key available: ${OPENROUTER_API_KEY ? 'Yes' : 'No'}`);
  console.log(`API Key prefix: ${OPENROUTER_API_KEY?.substring(0, 8)}...`);
  
  // Log more details about the request
  console.log('Request details:', {
    model: 'anthropic/claude-3.7-sonnet:thinking',
    prompt: prompt?.substring(0, 100) + '...',
    temperature: 0.3,
    thinking: true
  });
  
  try {
    // For Claude with thinking enabled
    const requestBody = {
      model: 'anthropic/claude-3.7-sonnet:thinking',
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
      thinking: true
    };
    
    console.log('Request body:', JSON.stringify(requestBody).substring(0, 500) + '...');
    console.log('Making request to OpenRouter API at https://openrouter.ai/api/v1/chat/completions');
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://example.com',
        'X-Title': 'Agent Collaboration System'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`OpenRouter response status: ${response.status}`);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Raw response from OpenRouter API:', responseText.substring(0, 500) + '...');

    if (!response.ok) {
      console.error('OpenRouter API error response:', responseText);
      
      try {
        const errorData = JSON.parse(responseText);
        console.error('OpenRouter API error details:', errorData);
        return new Response(
          JSON.stringify({ error: `OpenRouter API returned status ${response.status}: ${errorData.error?.message || errorData.error || 'Unknown error'}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (parseError) {
        console.error('Failed to parse OpenRouter error response:', parseError);
        return new Response(
          JSON.stringify({ error: `OpenRouter API returned status ${response.status}: ${responseText}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const data = JSON.parse(responseText);
    console.log('OpenRouter response received successfully');
    console.log('Response data excerpt:', JSON.stringify(data).substring(0, 200) + '...');
    
    // Enhanced response processing with better code extraction
    let content = data.choices[0].message.content;
    let thinkingContent = data.choices[0].thinking || "";
    
    console.log('Response content excerpt:', content.substring(0, 200) + '...');
    if (thinkingContent) {
      console.log('Thinking content excerpt:', thinkingContent.substring(0, 200) + '...');
    }
    
    // Extract code snippets from the content
    const codeSnippets = extractCodeSnippets(content);
    console.log(`Extracted ${codeSnippets.length} code snippets`);
    if (codeSnippets.length > 0) {
      codeSnippets.forEach((snippet, i) => {
        console.log(`Snippet ${i+1} path: ${snippet.filePath}`);
        console.log(`Snippet ${i+1} code (excerpt): ${snippet.code.substring(0, 100)}...`);
      });
    }
    
    // Extract tasks information from the content
    const tasksInfo = extractTasksInfo(content);
    console.log(`Extracted ${tasksInfo.length} tasks`);
    if (tasksInfo.length > 0) {
      tasksInfo.forEach((task, i) => {
        console.log(`Task ${i+1}: ${task.title}, assigned to: ${task.assignedTo}, priority: ${task.priority}`);
      });
    }
    
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
    console.error('Error in Claude thinking model request:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ error: `Error processing Claude thinking model request: ${error.message}`, stack: error.stack }),
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
  
  console.log(`Extracted ${tasks.length} tasks from agent response`);
  return tasks;
}

