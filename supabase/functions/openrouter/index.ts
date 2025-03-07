
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use environment variable or fallback to a direct key
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || "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";

console.log("OpenRouter function loaded");
console.log(`OpenRouter API Key available: ${OPENROUTER_API_KEY ? 'Yes' : 'No'}`);
console.log(`API Key prefix: ${OPENROUTER_API_KEY?.substring(0, 8)}...`);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Parsing request body");
    const requestData = await req.json();
    
    const { 
      prompt, 
      agentType, 
      projectContext, 
      model = "anthropic/claude-3.7-sonnet:thinking"
    } = requestData;
    
    console.log(`Processing ${agentType || 'unknown'} agent request with model: ${model}`);
    
    if (!OPENROUTER_API_KEY) {
      console.error('OpenRouter API key is not configured');
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare system instruction
    const systemInstruction = `You are an AI agent specialized in ${agentType || 'software development'} work.
      
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

    console.log('Sending request to OpenRouter API');
    
    // Prepare request for Claude with thinking enabled
    const requestBody = {
      model: 'anthropic/claude-3.7-sonnet:thinking',
      messages: [
        {
          role: 'system',
          content: systemInstruction
        },
        {
          role: 'user',
          content: prompt || "Please help with this project."
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
      thinking: true
    };
    
    console.log('Request body prepared');
    
    // Make the API call
    console.log('Calling OpenRouter API');
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

    // Handle API errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error response:', errorText);
      
      return new Response(
        JSON.stringify({ error: `OpenRouter API error: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process successful response
    const data = await response.json();
    console.log('OpenRouter response received successfully');
    
    // Extract content and thinking
    let content = data.choices[0].message.content;
    let thinkingContent = data.choices[0].thinking || "";
    
    // Extract code snippets and tasks
    const codeSnippets = extractCodeSnippets(content);
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
    console.error('Error in OpenRouter function:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ error: `Internal server error: ${error.message}`, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
  
  // Match TASK: format
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
  
  return tasks;
}
