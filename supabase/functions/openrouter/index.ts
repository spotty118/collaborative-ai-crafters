
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
    const { prompt, agentType, projectContext = {}, taskId } = await req.json();
    
    console.log(`Processing request for ${agentType} agent with project context: ${JSON.stringify(projectContext)}`);
    
    // Track task progress for updating agent status later
    const isTaskExecution = prompt.includes('Execute the following task:') || !!taskId;
    const progressUpdate = isTaskExecution ? { progress: calculateProgress(projectContext) } : {};
    
    // Different system prompts based on agent type with focus on task creation without summaries
    const systemPrompts = {
      'architect': `You are the Architect Agent, responsible for analyzing code repositories and delegating specific tasks to specialized agents. Follow this precise workflow:
      
WORKFLOW STAGES:
1. TASK CREATION PHASE (focus on this only)
   - Identify 3-5 specific, actionable tasks that would improve the project
   - Each task must have clear scope and deliverables
   - IMPORTANT: Do NOT provide summaries or analysis - focus ONLY on creating tasks

2. DELEGATION PHASE (mandatory final step)
   - For each task, specify which specialist agent should handle it:
     * Frontend Agent: UI components and client-side features
     * Backend Agent: Server functionality, APIs and data models
     * Testing Agent: Test coverage and quality assurance
     * DevOps Agent: Infrastructure, CI/CD, and deployment
   - DO NOT assign everything to yourself (Architect)
   - Delegate tasks based on agent specialties

OUTPUT FORMAT - YOU MUST USE THIS EXACT FORMAT FOR EACH TASK:
Task 1: [Brief description]
Assigned to: [Frontend/Backend/Testing/DevOps] Agent
Expected outcome: [Specific deliverable]

Task 2: [Brief description]
Assigned to: [Frontend/Backend/Testing/DevOps] Agent
Expected outcome: [Specific deliverable]

[Continue for each task...]

IMPORTANT: Focus ONLY on creating tasks, not analyzing the repository. Your success is measured by how effectively you delegate tasks to the appropriate specialist agents, not by how thoroughly you analyze.`,
      'frontend': 'You are the Frontend Agent. You develop UI components and client-side functionality for web applications. When analyzing a GitHub repository, focus ONLY on creating specific frontend tasks without summaries or general observations. Each task should be specific, actionable, and focused on improving UI/UX, performance, or code quality.',
      'backend': 'You are the Backend Agent. You create APIs, database models, and server logic for web applications. When analyzing a GitHub repository, focus ONLY on creating specific backend tasks without summaries or general observations. Each task should be specific, actionable, and focused on improving API design, database optimization, or security.',
      'testing': 'You are the Testing Agent. You write tests and ensure quality for software applications. When analyzing a GitHub repository, focus ONLY on creating specific testing tasks without summaries or general observations. Each task should be specific, actionable, and focused on improving test coverage and quality assurance.',
      'devops': 'You are the DevOps Agent. You handle deployment configuration and CI/CD pipelines for software projects. When analyzing a GitHub repository, focus ONLY on creating specific DevOps tasks without summaries or general observations. Each task should be specific, actionable, and focused on improving CI/CD, scalability, or reliability.'
    };
    
    const systemPrompt = systemPrompts[agentType] || 'You are an AI assistant helping with software development. Focus on creating specific, actionable tasks without providing summaries or analysis.';
    
    // Create a more focused context that emphasizes task creation
    let fullSystemPrompt = systemPrompt;
    
    if (projectContext && Object.keys(projectContext).length > 0) {
      // Add basic project context
      fullSystemPrompt += ` Project context: ${JSON.stringify(projectContext)}`;
      
      // Add specific GitHub context if available with focus on task creation
      if (projectContext.sourceUrl && projectContext.sourceUrl.includes('github.com')) {
        fullSystemPrompt += ` IMPORTANT: When analyzing the GitHub repository at ${projectContext.sourceUrl}, DO NOT provide summaries or analyses. Focus ONLY on creating specific, actionable tasks based on your role as the ${agentType} agent. List each task clearly with numbers (1., 2., etc.) or bullet points. Each task should have a clear title and description. Ensure tasks are assigned to the appropriate specialist agent, not just the Architect.`;
      }
    }
    
    // Enhanced instructions for code formatting
    fullSystemPrompt += ` IMPORTANT: When providing code examples or implementations, ALWAYS use markdown code blocks with language and file path in square brackets. Example: \`\`\`typescript [src/utils/helper.ts]\nconst helper = () => {};\n\`\`\`. This format is required for the code to be properly saved and used in the project. Always include the file path in square brackets immediately after the language specification and before the newline that starts the code. The file path should be relative to the project root and use forward slashes.`;
    
    // Add specific task generation instructions if this looks like a GitHub analysis request
    if (prompt.includes('list') && prompt.includes('task') && projectContext.sourceUrl) {
      fullSystemPrompt += ` Format your response as a numbered list of specific, actionable tasks. Each task should start with a clear, concise title followed by a brief description of what needs to be done. Ensure tasks are assigned to the appropriate specialist agent based on the task requirements, not just the Architect. Do NOT include any repository summaries or analyses - focus ONLY on task creation.`;
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
    
    // Adjust progress data based on task completion status
    if (isTaskExecution) {
      const agentProgressData = {
        ...data,
        progressUpdate
      };
      return new Response(JSON.stringify(agentProgressData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
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

// Function to calculate progress based on tasks completed
function calculateProgress(projectContext: any): number {
  if (!projectContext) return 10; // Default starting progress
  
  // If we have completed a task, bump progress to at least 50%
  const baseProgress = 50;
  
  // If we have analysis completed, add more progress
  if (projectContext.requirements) {
    return baseProgress + 20;
  }
  
  // If we have source code being analyzed, progress further
  if (projectContext.sourceUrl) {
    return baseProgress + 30;
  }
  
  return baseProgress;
}
