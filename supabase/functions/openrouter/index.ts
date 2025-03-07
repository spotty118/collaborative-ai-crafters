
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
      model = "anthropic/claude-3-opus:beta", 
      multipartContent = null 
    } = requestData;
    
    // Log the received request for debugging
    console.log(`Processing ${agentType} agent request with model: ${model || 'default'}`);
    
    if (multipartContent) {
      console.log('Multipart content detected (e.g., text+image)');
    } else {
      console.log('Prompt excerpt:', prompt.substring(0, 100) + '...');
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

    // If using the gemini thinking model, use that specific implementation
    if (model === "google/gemini-2.0-flash-thinking-exp:free") {
      return await handleGeminiThinkingModel(prompt, agentType, projectContext, req, corsHeaders);
    }

    // For other models, use standard implementation
    const temperature = agentType === 'architect' ? 0.3 : 0.4;
    
    console.log(`Using model: ${model} with temperature ${temperature}`);

    // Add a system instruction appropriate to the agent type
    let systemInstruction = `You are an AI agent specialized in ${agentType} work for a software development project.`;
    
    // Add more specific instructions based on agent type
    switch (agentType) {
      case 'architect':
        systemInstruction += ` 
        As the architect, your job is to: 
        1. Plan and design the overall system architecture 
        2. Make high-level technical decisions about frameworks and technologies
        3. Break down complex tasks into smaller manageable tasks for other agents
        4. Ensure all components work together coherently`;
        break;
      case 'frontend':
        systemInstruction += ` 
        As the frontend developer, your job is to: 
        1. Implement user interfaces using modern web technologies
        2. Build responsive and accessible components
        3. Handle client-side state management and user interactions
        4. Work with the backend developer to integrate APIs`;
        break;
      case 'backend':
        systemInstruction += ` 
        As the backend developer, your job is to:
        1. Design and implement server-side logic and APIs
        2. Work with databases and data modeling
        3. Ensure security, scalability, and performance
        4. Integrate with external services when needed`;
        break;
      case 'testing':
        systemInstruction += ` 
        As the testing specialist, your job is to:
        1. Create comprehensive test plans and cases
        2. Implement unit, integration, and e2e tests
        3. Identify bugs and edge cases
        4. Ensure code quality and reliability`;
        break;
      case 'devops':
        systemInstruction += ` 
        As the DevOps engineer, your job is to:
        1. Set up CI/CD pipelines
        2. Configure deployment environments
        3. Manage infrastructure and cloud resources
        4. Optimize performance and reliability`;
        break;
    }
    
    // Add specific instructions for code generation
    systemInstruction += `\n\nProject Context: ${projectContext.name} - ${projectContext.description || 'No description provided'}.
    
    When writing code:
    1. WRITE FULLY FUNCTIONAL, PRODUCTION-READY CODE
    2. Include complete implementations, not pseudocode or placeholders
    3. Follow modern best practices for your domain
    4. For code examples, wrap the code in triple backticks with the language (e.g. \`\`\`javascript)
    5. INCLUDE THE FULL FILEPATH at the beginning of any code block by writing \`\`\`filepath:<path/to/file>
    
    When creating tasks:
    1. Use this format:
    TASK: [Clear, specific task name]
    ASSIGNED TO: [Agent type, e.g. Frontend, Backend]
    DESCRIPTION: [Detailed description with acceptance criteria]
    PRIORITY: [high/medium/low]
    
    2. Break down complex work into multiple tasks
    3. Assign tasks to the appropriate specialist agent
    `;
    
    console.log('Sending request to OpenRouter API');
    
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
        temperature: temperature,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error response:', errorText);
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
    console.log('Response data excerpt:', JSON.stringify(data).substring(0, 200) + '...');
    
    // Process response and extract code snippets
    const content = data.choices[0].message.content;
    const codeSnippets = extractCodeSnippets(content);
    
    // Extract tasks information from the content
    const tasksInfo = extractTasksInfo(content);
    
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: content
            }
          }
        ],
        codeSnippets,
        tasksInfo
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in OpenRouter function:', error);
    return new Response(
      JSON.stringify({ error: `Internal server error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Handle multimodal requests (text + images)
async function handleMultimodalRequest(multipartContent, model, req, corsHeaders) {
  console.log('Processing multimodal request with model:', model);
  
  try {
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
    return new Response(
      JSON.stringify({ error: `Error processing multimodal request: ${error.message}` }),
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
    prompt: prompt.substring(0, 100) + '...',
    temperature: 0.3,
    thinking: true
  });
  
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
