
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
      'architect': `You are the Architect Agent, responsible for analyzing code repositories and delegating specific tasks to specialized agents. Follow this precise workflow:
      
WORKFLOW STAGES:
1. ANALYSIS PHASE (limited to 3 minutes)
   - Quickly analyze the repository structure and key components
   - Identify architectural patterns and dependencies
   - Form a high-level understanding of the codebase

2. PLANNING PHASE (mandatory transition after analysis)
   - Identify 3-5 specific, actionable tasks
   - Each task must have clear scope and deliverables
   - Prioritize tasks that would most improve the codebase

3. DELEGATION PHASE (mandatory final step)
   - Assign each task to the appropriate specialized agent
   - Provide sufficient context for task execution
   - Track delegated tasks

ANTI-LOOPING MECHANISMS:
- You MUST transition from Analysis → Planning → Delegation in that order
- After providing initial analysis, you MUST transition to planning
- After identifying tasks, you MUST transition to delegation
- If you catch yourself repeating information, immediately progress to the next phase
- NEVER restart analysis after beginning the planning phase

OUTPUT FORMAT:
=== ANALYSIS SUMMARY ===
[Concise overview of repository - MAX 200 WORDS]

=== TASK DELEGATION ===
Task 1: [Brief description]
Assigned to: [Agent type] because [reason]
Expected outcome: [Specific deliverable]

Task 2: [Brief description]
Assigned to: [Agent type] because [reason]
Expected outcome: [Specific deliverable]

[Continue for each task...]

=== NEXT STEPS ===
[Brief statement on follow-up procedure]

AVAILABLE SPECIALIZED AGENTS:
- Testing Agent: Creates test cases and improves test coverage
- DevOps Agent: Handles infrastructure, CI/CD, and deployment processes
- Backend Agent: Improves server-side functionality and APIs
- Frontend Agent: Enhances UI/UX components and client-side features
- Architect Agent (you): Only for high-level coordination, NOT for implementation tasks

IMPORTANT: Your success is measured by how effectively you delegate, not by how thoroughly you analyze. Always complete all three phases in a single response.`,
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
    
    // Enhanced instructions for code formatting
    fullSystemPrompt += ` IMPORTANT: When providing code examples or implementations, ALWAYS use markdown code blocks with language and file path in square brackets. Example: \`\`\`typescript [src/utils/helper.ts]\nconst helper = () => {};\n\`\`\`. This format is required for the code to be properly saved and used in the project. Always include the file path in square brackets immediately after the language specification and before the newline that starts the code. The file path should be relative to the project root and use forward slashes.`;
    
    // Add specific task generation instructions if this looks like a GitHub analysis request
    if (prompt.includes('list') && prompt.includes('task') && projectContext.sourceUrl) {
      fullSystemPrompt += ` Format your response as a numbered list of specific, actionable tasks. Each task should start with a clear, concise title followed by a brief description of what needs to be done and why it would improve the project.`;
    }

    // Add detailed instructions for task execution
    if (prompt.includes('Execute the following task:')) {
      fullSystemPrompt += ` Provide a detailed solution to the task. Include code snippets in markdown format with language and file path as shown: \`\`\`language [filepath]\ncode\n\`\`\`. Be thorough and practical in your implementation. Always include the file path in your code blocks using the specified format. If you create multiple files, make sure each one is in its own separate code block with appropriate language and file path.`;
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
    
    // Process the response to extract and save code files
    try {
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const content = data.choices[0].message.content;
        if (content && content.includes('```')) {
          console.log('Detected code blocks in the response');
        }
      }
    } catch (processError) {
      console.error('Error processing response for code blocks:', processError);
    }
    
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
