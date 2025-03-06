
// Import necessary dependencies
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabase-client.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get necessary environment variables
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Add request logging
  console.log('CrewAI Orchestrator function received request:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });
  
  try {
    // Log the raw request body for debugging
    const rawBody = await req.text();
    console.log('Request body:', rawBody);
    
    // Parse body again after reading text
    const { projectId, agentId, taskId, action = 'start', agents, projectContext, autostart = false, verbose = true } = JSON.parse(rawBody);
    
    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'Missing projectId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing ${action} request for project ${projectId}, agent ${agentId || 'all'}, verbose=${verbose}`);
    
    // Fetch project to send as context
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
      
    if (projectError) {
      console.error('Error fetching project:', projectError);
      return new Response(
        JSON.stringify({ error: `Failed to fetch project: ${projectError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch agent if agentId is provided
    let agentData = null;
    if (agentId) {
      const { data, error } = await supabase
        .from('agent_statuses')
        .select('*')
        .eq('id', agentId)
        .single();
        
      if (error) {
        console.error('Error fetching agent:', error);
        return new Response(
          JSON.stringify({ error: `Failed to fetch agent: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      agentData = data;
    }
    
    // Fetch tasks for the agent if specified
    let tasksData = [];
    if (agentId) {
      const query = supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .eq('assigned_to', agentId);
        
      if (taskId) {
        query.eq('id', taskId);
      } else {
        query.in('status', ['pending', 'in_progress']);
      }
      
      const { data, error } = await query;
        
      if (error) {
        console.error('Error fetching tasks:', error);
        return new Response(
          JSON.stringify({ error: `Failed to fetch tasks: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      tasksData = data || [];
    }
    
    // Create initialization message based on action
    if (action === 'start') {
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content: agentId 
            ? `Starting ${agentData?.name || 'Agent'} for project: ${projectData.name} (verbose=${verbose})`
            : `CrewAI orchestration started for project: ${projectData.name} (verbose=${verbose})`,
          sender: agentId ? agentData?.name : 'System',
          type: 'text'
        }]);
    } else if (action === 'stop') {
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content: agentId 
            ? `Stopping ${agentData?.name || 'Agent'} for project: ${projectData.name}`
            : `CrewAI orchestration stopped for project: ${projectData.name}`,
          sender: agentId ? agentData?.name : 'System',
          type: 'text'
        }]);
    } else if (action === 'team_collaborate') {
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content: `The team is now collaborating on project: ${projectData.name} (verbose=${verbose}). Agents will automatically assign and work on tasks.`,
          sender: "Architect Agent",
          type: 'text'
        }]);
        
      // Auto-start all agents if the flag is set
      if (autostart === true) {
        setTimeout(async () => {
          if (agents && agents.length > 0) {
            // Start all agents
            for (const agent of agents) {
              // Skip architect as it's already running
              if (agent.type === 'architect') continue;
              
              console.log(`Auto-starting agent ${agent.name} (${agent.id}) with verbose=${verbose}`);
              try {
                processAgentWorkflow(projectId, agent.id, agent, [], verbose).catch(err => {
                  console.error(`Error auto-starting agent ${agent.name}:`, err);
                });
              } catch (error) {
                console.error(`Failed to auto-start agent ${agent.name}:`, error);
              }
            }
          }
        }, 1000); // Short delay before autostarting
      }
    }
    
    // Generate immediate response to client
    const response = new Response(
      JSON.stringify({ 
        success: true, 
        message: `CrewAI orchestration ${action} initiated for ${agentId ? 'agent' : 'project'} ${agentId || projectId} (verbose=${verbose})`,
        project: projectData?.name || 'Unknown Project',
        agent: agentData?.name || null,
        tasks: tasksData?.length || 0,
        verbose: verbose
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
    // Process orchestration asynchronously (don't await this)
    if (action === 'team_collaborate') {
      processTeamCollaboration(projectId, projectData, agents || [], projectContext, verbose).catch(error => {
        console.error('Error in team collaboration processing:', error);
      });
    } else {
      processOrchestration(projectId, projectData, agentId, agentData, tasksData, action, verbose).catch(error => {
        console.error('Error in asynchronous orchestration processing:', error);
      });
    }
    
    return response;
    
  } catch (error) {
    console.error('Error in CrewAI Orchestrator function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: `Failed to process request: ${error.message}` 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * Process team collaboration
 */
async function processTeamCollaboration(projectId, projectData, agents, projectContext, verbose = false) {
  console.log(`Starting team collaboration for project ${projectId} with ${agents.length} agents (verbose=${verbose})`);
  
  if (!agents || agents.length === 0) {
    console.error('No agents provided for team collaboration');
    return;
  }
  
  try {
    // Start with architect planning
    const architect = agents.find(a => a.type === 'architect');
    if (!architect) {
      console.error('No architect agent found for team collaboration');
      return;
    }
    
    // Generate initial plan with the architect - UPDATED PROMPT
    const architectPlan = await callOpenRouter(
      'architect',
      `You are the lead architect for project "${projectData.name}". ${projectData.description || ''}
      
      Create a concise plan with specific tasks for each team member.
      
      TASK FORMAT - FOLLOW THIS EXACTLY:
      TASK: [Clear task title]
      ASSIGNED TO: [Agent Type] 
      DESCRIPTION: [Brief description]
      PRIORITY: [High/Medium/Low]
      
      Assign at least one task to each agent type: Frontend, Backend, DevOps, Testing.
      Keep your analysis brief and focus on creating well-defined tasks.`,
      { projectId, projectName: projectData.name, projectDescription: projectData.description },
      null,
      verbose
    );
    
    // Add the architect's plan to chat - SIMPLIFIED
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: "I've analyzed the project requirements and am assigning initial tasks to the team.",
        sender: architect.name,
        type: 'text'
      }]);
    
    // Extract tasks from the plan
    const tasksInfo = extractTasksInfo(architectPlan);
    
    if (tasksInfo.length > 0) {
      console.log(`Extracted ${tasksInfo.length} tasks from architect's plan`);
      
      // Create the tasks in the database
      for (const taskInfo of tasksInfo) {
        const agentType = taskInfo.assignedTo.replace(' Agent', '').toLowerCase();
        const assignedAgent = agents.find(a => a.type.toLowerCase() === agentType || 
                                              a.type.toLowerCase().includes(agentType));
        
        if (assignedAgent) {
          await supabase
            .from('tasks')
            .insert([{
              project_id: projectId,
              title: taskInfo.title,
              description: taskInfo.description,
              assigned_to: assignedAgent.id,
              status: 'pending',
              priority: taskInfo.priority.toLowerCase()
            }]);
            
          console.log(`Created task "${taskInfo.title}" for ${assignedAgent.name}`);
        }
      }
      
      // Add a message about task creation
      await supabase
        .from('chat_messages')
        .insert([{
          project_id: projectId,
          content: `I've created ${tasksInfo.length} initial tasks and assigned them to the appropriate team members.`,
          sender: architect.name,
          type: 'text'
        }]);
      
      // Auto-start all agents immediately after task creation
      for (const agent of agents) {
        if (agent.type !== 'architect') {
          // Fetch the agent's tasks
          const { data: agentTasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId)
            .eq('assigned_to', agent.id)
            .eq('status', 'pending');
            
          if (agentTasks && agentTasks.length > 0) {
            // Update agent status to working
            await supabase
              .from('agent_statuses')
              .update({ status: 'working', progress: 10 })
              .eq('id', agent.id);
              
            // Generate brief acknowledgment
            const acknowledgment = `I've received ${agentTasks.length} task(s) and will begin working on them immediately.`;
            
            await supabase
              .from('chat_messages')
              .insert([{
                project_id: projectId,
                content: acknowledgment,
                sender: agent.name,
                type: 'text'
              }]);
              
            console.log(`${agent.name} acknowledged tasks`);
            
            // Start working on the first task immediately
            console.log(`${agent.name} starting work on task: ${agentTasks[0].title} (verbose=${verbose})`);
            processTask(projectId, agent.id, { name: agent.name, agent_type: agent.type }, agentTasks[0], verbose).catch(error => {
              console.error(`Error processing task: ${error}`);
            });
          }
        }
      }
    } else {
      console.error('No tasks could be extracted from architect plan');
      
      // Create default tasks if no tasks could be extracted
      await createInitialTasks(projectId, agents);
      
      // Auto-start all agents after default task creation
      for (const agent of agents) {
        if (agent.type !== 'architect') {
          const { data: agentTasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId)
            .eq('assigned_to', agent.id)
            .eq('status', 'pending');
            
          if (agentTasks && agentTasks.length > 0) {
            // Update agent status to working
            await supabase
              .from('agent_statuses')
              .update({ status: 'working', progress: 10 })
              .eq('id', agent.id);
              
            // Start working on the first task
            console.log(`Starting ${agent.name} on default task (verbose=${verbose})`);
            processTask(projectId, agent.id, { name: agent.name, agent_type: agent.type }, agentTasks[0], verbose).catch(error => {
              console.error(`Error processing default task: ${error}`);
            });
          }
        }
      }
    }
    
    // Set up more frequent check for pending tasks
    setTimeout(() => {
      checkAndAssignPendingTasks(projectId, agents, verbose);
    }, 15000); // Check after 15 seconds
    
  } catch (error) {
    console.error('Error in team collaboration:', error);
    
    // Add error message to chat
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `Team collaboration encountered an error: ${error.message}`,
        sender: "System",
        type: "error"
      }]);
  }
}

/**
 * Create initial default tasks for agents if architect doesn't provide them
 */
async function createInitialTasks(projectId, agents) {
  console.log(`Creating default tasks for project ${projectId}`);
  
  const defaultTasks = {
    'frontend': {
      title: 'Create initial UI components',
      description: 'Design and implement the core UI components for the project interface.',
      priority: 'high'
    },
    'backend': {
      title: 'Set up API endpoints',
      description: 'Create the necessary API endpoints for the frontend to interact with.',
      priority: 'high'
    },
    'devops': {
      title: 'Configure deployment pipeline',
      description: 'Set up the CI/CD pipeline for automated testing and deployment.',
      priority: 'medium'
    },
    'testing': {
      title: 'Develop test strategy',
      description: 'Create a comprehensive testing strategy for the project.',
      priority: 'medium'
    }
  };
  
  for (const agent of agents) {
    if (agent.type !== 'architect') {
      const agentType = agent.type.toLowerCase();
      const taskConfig = defaultTasks[agentType] || {
        title: `Initial ${agentType} task`,
        description: `Start work on ${agentType} implementation for the project.`,
        priority: 'medium'
      };
      
      await supabase
        .from('tasks')
        .insert([{
          project_id: projectId,
          title: taskConfig.title,
          description: taskConfig.description,
          assigned_to: agent.id,
          status: 'pending',
          priority: taskConfig.priority
        }]);
        
      console.log(`Created default task for ${agent.name}`);
    }
  }
}

/**
 * Periodically check for pending tasks and assign them to agents
 */
async function checkAndAssignPendingTasks(projectId, agents, verbose = false) {
  try {
    console.log(`Checking for pending tasks in project ${projectId}`);
    
    // Get all pending tasks
    const { data: pendingTasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'pending');
      
    if (error) {
      console.error('Error fetching pending tasks:', error);
      return;
    }
    
    if (pendingTasks && pendingTasks.length > 0) {
      console.log(`Found ${pendingTasks.length} pending tasks`);
      
      // Check which agents are idle
      const { data: agentStatuses } = await supabase
        .from('agent_statuses')
        .select('*')
        .eq('project_id', projectId);
        
      if (agentStatuses) {
        const idleAgents = agentStatuses.filter(a => a.status !== 'working');
        
        if (idleAgents.length > 0) {
          // Assign a task to the first idle agent
          const agent = idleAgents[0];
          const task = pendingTasks.find(t => t.assigned_to === agent.id) || pendingTasks[0];
          
          if (task) {
            console.log(`Assigning task "${task.title}" to ${agent.name} (verbose=${verbose})`);
            
            // Update agent status
            await supabase
              .from('agent_statuses')
              .update({ status: 'working', progress: 10 })
              .eq('id', agent.id);
              
            // Process the task
            await processTask(projectId, agent.id, agent, task, verbose);
          }
        }
      }
    }
    
    // Schedule next check
    setTimeout(() => {
      checkAndAssignPendingTasks(projectId, agents, verbose);
    }, 60000); // Check every minute
    
  } catch (error) {
    console.error('Error checking pending tasks:', error);
    
    // Schedule next check even if there was an error
    setTimeout(() => {
      checkAndAssignPendingTasks(projectId, agents, verbose);
    }, 60000);
  }
}

/**
 * Process the orchestration asynchronously
 */
async function processOrchestration(projectId, projectData, agentId, agentData, tasksData, action, verbose = false) {
  console.log(`Starting asynchronous orchestration processing for project ${projectId} (verbose=${verbose})`);
  
  try {
    if (action === 'start') {
      if (agentId) {
        // Single agent workflow
        await processAgentWorkflow(projectId, agentId, agentData, tasksData, verbose);
      } else {
        // Full project workflow
        await processProjectWorkflow(projectId, projectData, verbose);
      }
    } else if (action === 'stop') {
      if (agentId) {
        // Stop single agent
        await stopAgent(projectId, agentId);
      } else {
        // Stop all agents in the project
        await stopProject(projectId);
      }
    }
  } catch (error) {
    console.error('Error in asynchronous orchestration processing:', error);
    
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `Error in orchestration: ${error.message}`,
        sender: 'System',
        type: 'text'
      }]);
      
    // Reset agent status on error if agentId provided
    if (agentId) {
      await supabase
        .from('agent_statuses')
        .update({ status: 'idle', progress: 0 })
        .eq('id', agentId);
    }
  }
}

/**
 * Process workflow for a project (multi-agent)
 */
async function processProjectWorkflow(projectId, projectData, verbose = false) {
  console.log(`Processing workflow for project ${projectId} (verbose=${verbose})`);
  
  // Full project implementation would go here
  // This is a placeholder for now as we're focusing on single agent workflows
  
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: `Project workflow for ${projectData.name} is starting. Individual agents will be initialized and assigned tasks. (verbose=${verbose})`,
      sender: "System",
      type: "text"
    }]);
}

/**
 * Call OpenRouter API to generate agent response
 */
async function callOpenRouter(agentType, prompt, projectContext = {}, taskId = null, verbose = false) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is not configured');
  }

  console.log(`Calling OpenRouter API for ${agentType} agent with prompt: ${prompt.substring(0, 100)}... (verbose=${verbose})`);

  const systemPrompts = {
    'architect': `You are the Architect Agent in a software development team. You analyze requirements and delegate tasks to specialized agents. 
    Respond in character as a seasoned software architect. Your expertise is in designing scalable, maintainable systems.
    You work with other agents: Frontend Agent, Backend Agent, Testing Agent, and DevOps Agent.
    IMPORTANT: Always provide REAL, PRODUCTION-READY code. Never use placeholder comments or descriptive text about what code would do.
    When you create code files, they will be DIRECTLY INTEGRATED into the project and must be fully functional.`,
    
    'frontend': `You are the Frontend Agent in a software development team.
    Respond in character as an expert frontend developer. Your expertise is in creating intuitive user interfaces and responsive designs.
    You work with other agents, particularly looking to the Architect Agent for direction and collaborating with the Backend Agent for integration.
    IMPORTANT: Always provide REAL, PRODUCTION-READY code. Never use placeholder comments or descriptive text about what code would do.
    When you create code files, they will be DIRECTLY INTEGRATED into the project and must be fully functional.`,
    
    'backend': `You are the Backend Agent in a software development team.
    Respond in character as a skilled backend developer. Your expertise is in creating robust APIs, database design, and server-side logic.
    You work with other agents, implementing the architectural design from the Architect Agent and providing APIs for the Frontend Agent.
    IMPORTANT: Always provide REAL, PRODUCTION-READY code. Never use placeholder comments or descriptive text about what code would do.
    When you create code files, they will be DIRECTLY INTEGRATED into the project and must be fully functional.`,
    
    'testing': `You are the Testing Agent in a software development team.
    Respond in character as a meticulous QA engineer. Your expertise is in ensuring code quality, writing test cases, and finding potential issues.
    You work with all other agents to verify their work meets requirements and is free of defects.
    IMPORTANT: Always provide REAL, PRODUCTION-READY code. Never use placeholder comments or descriptive text about what code would do.
    When you create code files, they will be DIRECTLY INTEGRATED into the project and must be fully functional.`,
    
    'devops': `You are the DevOps Agent in a software development team.
    Respond in character as an experienced DevOps engineer. Your expertise is in deployment pipelines, infrastructure, and system reliability.
    You work with all other agents to ensure the project can be deployed and scaled effectively.
    IMPORTANT: Always provide REAL, PRODUCTION-READY code. Never use placeholder comments or descriptive text about what code would do.
    When you create code files, they will be DIRECTLY INTEGRATED into the project and must be fully functional.`
  };

  let fullSystemPrompt = systemPrompts[agentType] || 'You are an AI assistant helping with software development.';
  
  if (projectContext && Object.keys(projectContext).length > 0) {
    fullSystemPrompt += `\n\nProject context: ${JSON.stringify(projectContext)}`;
  }

  if (verbose) {
    fullSystemPrompt += `\n\nDETAILED VERBOSE OUTPUT: Your responses should include a detailed step-by-step reasoning process. Explain exactly what you're doing and why.`;
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://lovable.dev', 
      'X-Title': 'Agentic Development Platform',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-thinking-exp:free',
      messages: [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      thinking: {
        enabled: true
      }
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('OpenRouter API error:', errorData);
    throw new Error(`OpenRouter API returned status ${response.status}: ${errorData}`);
  }

  const data = await response.json();
  
  if (verbose) {
    console.log('OpenRouter API full response:', JSON.stringify(data, null, 2));
  }
  
  const content = data.choices[0].message.content;
  
  // Filter out descriptive content that isn't real code
  const filteredContent = filterForProductionCode(content, verbose);
  
  return filteredContent;
}

/**
 * Filter content to ensure it contains real code and not just descriptions
 */
function filterForProductionCode(content, verbose = false) {
  // Check if content has code blocks
  const hasCodeBlocks = content.includes('```');
  
  if (!hasCodeBlocks) {
    console.log('Warning: Generated content doesn\'t contain any code blocks');
    // We still return the content as it might be useful text
    return content;
  }
  
  // Check for descriptive statements that indicate non-implementation
  const descriptivePatterns = [
    /I would implement this|I would create|we would need to|we should implement|should be implemented/i,
    /let\'s design|let\'s create|let\'s implement|let\'s style/i,
    /First, we need to|Next, we would|This would require/i,
    /I\'m going to use|We\'re going to use|I would use/i,
    /This is just a mockup|This is a simplified/i
  ];
  
  let hasDescriptiveWarnings = false;
  
  for (const pattern of descriptivePatterns) {
    if (pattern.test(content)) {
      console.log(`Warning: Generated content contains descriptive language that may indicate non-implementation: ${pattern}`);
      hasDescriptiveWarnings = true;
      
      if (verbose) {
        console.log('Pattern match details:', {
          pattern: pattern.toString(),
          matches: content.match(pattern)
        });
      }
    }
  }
  
  // Modify content to warn about potential non-implementation if needed
  if (hasDescriptiveWarnings) {
    // We'll still return the content, but log a warning
    console.log('WARNING: Generated content may contain descriptive rather than implementational code');
    
    if (verbose) {
      console.log('Full content with descriptive warnings:', content);
    }
  }
  
  return content;
}

/**
 * Extract tasks from agent response
 */
function extractTasksInfo(content) {
  const taskPattern = /TASK:(.+?)(?:ASSIGNED TO|ASSIGNEE):(.+?)(?:DESCRIPTION|DESC):(.+?)(?:PRIORITY):(.+?)(?=\n\s*TASK:|\n\s*$|$)/gsi;
  const tasks = [];
  let match;
  
  while ((match = taskPattern.exec(content)) !== null) {
    tasks.push({
      title: match[1].trim(),
      assignedTo: match[2].trim(),
      description: match[3].trim(),
      priority: match[4].trim()
    });
  }
  
  return tasks;
}

/**
 * Extract code snippets from agent response
 */
function extractCodeSnippets(content) {
  const codeSnippets = [];
  
  // Match code blocks with filepath format: ```filepath:/path/to/file
  const filepathPattern = /```(?:filepath:|\s*)([\w\/\.-]+)\s*\n([\s\S]*?)\n```/g;
  let match;
  
  while ((match = filepathPattern.exec(content)) !== null) {
    const filePath = match[1].trim();
    const code = match[2].trim();
    
    if (filePath && code) {
      codeSnippets.push({ filePath, code });
    }
  }
  
  // If no filepath-specific code blocks found, look for language-specific blocks
  if (codeSnippets.length === 0) {
    const languagePattern = /```(?:([\w\+]+)\n)?([\s\S]*?)\n```/g;
    
    while ((match = languagePattern.exec(content)) !== null) {
      const language = match[1] ? match[1].trim().toLowerCase() : '';
      const code = match[2].trim();
      
      if (code) {
        // Use default filenames based on language
        let filePath = '';
        
        if (language === 'javascript' || language === 'js') {
          filePath = 'script.js';
        } else if (language === 'typescript' || language === 'ts') {
          filePath = 'script.ts';
        } else if (language === 'html') {
          filePath = 'index.html';
        } else if (language === 'css') {
          filePath = 'styles.css';
        } else if (language === 'python' || language === 'py') {
          filePath = 'script.py';
        } else if (language === 'json') {
          filePath = 'data.json';
        } else if (language === 'jsx' || language === 'tsx') {
          filePath = `component.${language}`;
        } else {
          // Skip non-code blocks like markdown
          if (['markdown', 'md', ''].includes(language)) continue;
          filePath = `file.${language || 'txt'}`;
        }
        
        codeSnippets.push({ filePath, code });
      }
    }
  }
  
  return codeSnippets;
}

/**
 * Determine language from file path
 */
function determineLanguage(filePath) {
  const extension = filePath.split('.').pop().toLowerCase();
  
  switch (extension) {
    case 'js': return 'javascript';
    case 'ts': return 'typescript';
    case 'jsx': return 'jsx';
    case 'tsx': return 'tsx';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'py': return 'python';
    case 'json': return 'json';
    case 'md': return 'markdown';
    default: return extension;
  }
}

/**
 * Get a default task title based on agent type
 */
function getDefaultTaskTitle(agentType) {
  const typeNormalized = agentType.toLowerCase();
  
  if (typeNormalized.includes('front')) {
    return 'Implement initial user interface components';
  } else if (typeNormalized.includes('back')) {
    return 'Create core API endpoints and database models';
  } else if (typeNormalized.includes('devops')) {
    return 'Set up CI/CD pipeline and deployment configuration';
  } else if (typeNormalized.includes('test')) {
    return 'Develop test strategy and initial test cases';
  } else if (typeNormalized.includes('architect')) {
    return 'Design system architecture and component breakdown';
  } else {
    return 'Complete initial development tasks';
  }
}

/**
 * Get a default task description based on agent type
 */
function getDefaultTaskDescription(agentType) {
  const typeNormalized = agentType.toLowerCase();
  
  if (typeNormalized.includes('front')) {
    return 'Create the core UI components needed for the application. Focus on responsive design, accessibility, and a clean user experience. Implement key screens and navigation flow.';
  } else if (typeNormalized.includes('back')) {
    return 'Develop the essential API endpoints and database models required for the application. Ensure proper data validation, error handling, and security measures are implemented.';
  } else if (typeNormalized.includes('devops')) {
    return 'Configure the CI/CD pipeline for automated testing and deployment. Set up infrastructure as code, monitoring, and alerting systems to ensure reliable operations.';
  } else if (typeNormalized.includes('test')) {
    return 'Create a comprehensive testing strategy including unit, integration, and end-to-end tests. Implement initial test cases for critical application features.';
  } else if (typeNormalized.includes('architect')) {
    return 'Design the overall system architecture, component breakdown, and technical specifications. Define technology stack, integration points, and data flow throughout the application.';
  } else {
    return 'Complete initial development tasks required for the project. Follow best practices for code quality, documentation, and collaboration with the team.';
  }
}

/**
 * Stop all agents in a project
 */
async function stopProject(projectId) {
  // Update project status
  await supabase
    .from('projects')
    .update({ status: 'idle' })
    .eq('id', projectId);
    
  // Update all agents in the project to idle status
  await supabase
    .from('agent_statuses')
    .update({ status: 'idle' })
    .eq('project_id', projectId);
    
  console.log(`Stopped all agents for project ${projectId}`);
}

/**
 * Stop a specific agent
 */
async function stopAgent(projectId, agentId) {
  // Update the agent to idle status
  await supabase
    .from('agent_statuses')
    .update({ status: 'idle' })
    .eq('id', agentId);
    
  // Update any in-progress tasks for this agent to pending
  await supabase
    .from('tasks')
    .update({ status: 'pending' })
    .eq('assigned_to', agentId)
    .eq('status', 'in_progress');
    
  console.log(`Stopped agent ${agentId} for project ${projectId}`);
}

/**
 * Process workflow for a single agent
 */
async function processAgentWorkflow(projectId, agentId, agentData, tasksData, verbose = false) {
  console.log(`Processing workflow for agent ${agentId} with ${tasksData.length} tasks (verbose=${verbose})`);
  
  // If no tasks, create a default task for the agent
  if (tasksData.length === 0) {
    // Create a default task based on agent type with real descriptions
    const taskTitle = getDefaultTaskTitle(agentData.agent_type);
    const taskDesc = getDefaultTaskDescription(agentData.agent_type);
    
    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert([{
        project_id: projectId,
        title: taskTitle,
        description: taskDesc,
        assigned_to: agentId,
        status: 'pending',
        priority: 'high'
      }])
      .select()
      .single();
      
    if (error) {
      console.error('Error creating default task:', error);
      throw new Error(`Failed to create default task: ${error.message}`);
    }
    
    tasksData = [newTask];
    
    // Generate an AI response about the task creation
    const response = await callOpenRouter(
      agentData.agent_type,
      `You've been assigned a new task: ${taskTitle}. Briefly describe how you will approach this task.`,
      { projectId, taskTitle, taskDescription: taskDesc },
      null,
      verbose
    );
    
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: response,
        sender: agentData.name,
        type: 'text'
      }]);
  }
  
  // Update agent status to working
  await supabase
    .from('agent_statuses')
    .update({ status: 'working', progress: 10 })
    .eq('id', agentId);
    
  // Process each task in sequence with real AI responses
  for (const task of tasksData) {
    await processTask(projectId, agentId, agentData, task, verbose);
  }
  
  // Final update to agent
  await supabase
    .from('agent_statuses')
    .update({ status: 'completed', progress: 100 })
    .eq('id', agentId);
    
  // Add completion message
  const completionResponse = await callOpenRouter(
    agentData.agent_type,
    `You've completed all your assigned tasks for project ${projectId}. Summarize what you've accomplished.`,
    { projectId },
    null,
    verbose
  );
  
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: completionResponse,
      sender: agentData.name,
      type: 'text'
    }]);
}

/**
 * Process a specific task
 */
async function processTask(projectId, agentId, agentData, task, verbose = false) {
  console.log(`Processing task ${task.id}: ${task.title} (verbose=${verbose})`);
  
  // Update task status to in_progress
  await supabase
    .from('tasks')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', task.id);
    
  // Generate a message about starting the task using AI with stronger instructions for real code
  const startResponse = await callOpenRouter(
    agentData.agent_type,
    `Execute the following task: "${task.title}". ${task.description} 
    Provide REAL, PRODUCTION-READY implementation with functional code that will be directly added to the project.
    Your code must be complete and ready to run - not pseudocode or explanations of what code would do.
    
    Use the filepath format for code: \`\`\`filepath:/path/to/file\`\`\`
    
    If your task involves creating other tasks for team members, format them as:
    TASK: [Title]
    ASSIGNED TO: [Agent Type] Agent
    DESCRIPTION: [Details]
    PRIORITY: [High/Medium/Low]
    
    Think about how your work integrates with the rest of the team. Consider dependencies and collaborations needed.`,
    { projectId, taskId: task.id, taskTitle: task.title, taskDescription: task.description },
    task.id,
    verbose
  );
  
  // Extract code snippets and create code files
  const codeSnippets = extractCodeSnippets(startResponse);
  if (codeSnippets.length > 0) {
    for (const snippet of codeSnippets) {
      const fileName = snippet.filePath.split('/').pop();
      
      // Check if file already exists
      const { data: existingFiles } = await supabase
        .from('code_files')
        .select('id')
        .eq('path', snippet.filePath)
        .eq('project_id', projectId);
        
      if (existingFiles && existingFiles.length > 0) {
        // Update existing file
        await supabase
          .from('code_files')
          .update({
            content: snippet.code,
            last_modified_by: agentData.name,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingFiles[0].id);
          
        console.log(`Updated existing file: ${snippet.filePath}`);
      } else {
        // Create new file
        await supabase
          .from('code_files')
          .insert([{
            project_id: projectId,
            name: fileName,
            path: snippet.filePath,
            content: snippet.code,
            language: determineLanguage(snippet.filePath),
            created_by: agentData.name,
            last_modified_by: agentData.name
          }]);
          
        console.log(`Created new file: ${snippet.filePath}`);
      }
    }
    
    // Add a message about the created files
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `I've created/updated ${codeSnippets.length} code files as part of this task.`,
        sender: agentData.name,
        type: "text"
      }]);
  } else {
    console.log('No valid code snippets found in the response - this may indicate a problem');
    
    // Alert about the issue
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `Warning: I couldn't extract any valid code snippets from my work on task "${task.title}". This may indicate an issue with my implementation approach.`,
        sender: agentData.name,
        type: "text"
      }]);
  }
  
  // Extract and create tasks
  const tasksInfo = extractTasksInfo(startResponse);
  if (tasksInfo.length > 0) {
    for (const taskInfo of tasksInfo) {
      // Find the agent for the task
      const agentType = taskInfo.assignedTo.replace(' Agent', '').toLowerCase();
      const { data: agents } = await supabase
        .from('agent_statuses')
        .select('id')
        .eq('project_id', projectId)
        .eq('agent_type', agentType);
        
      const assignedToId = agents && agents.length > 0 ? agents[0].id : agentId;
      
      // Create the task
      await supabase
        .from('tasks')
        .insert([{
          project_id: projectId,
          title: taskInfo.title,
          description: taskInfo.description,
          assigned_to: assignedToId,
          status: 'pending',
          priority: taskInfo.priority.toLowerCase(),
          parent_task_id: task.id
        }]);
    }
    
    // Add a message about the created tasks
    await supabase
      .from('chat_messages')
      .insert([{
        project_id: projectId,
        content: `I've created ${tasksInfo.length} new tasks based on my work.`,
        sender: agentData.name,
        type: "text"
      }]);
  }
  
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: startResponse,
      sender: agentData.name,
      type: "text"
    }]);
    
  // Update agent progress to show we're working on the task
  await supabase
    .from('agent_statuses')
    .update({ progress: 70 })
    .eq('id', agentId);
    
  // Wait some time to simulate work
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Complete the task
  await supabase
    .from('tasks')
    .update({ 
      status: 'completed', 
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    })
    .eq('id', task.id);
    
  // Generate completion message using AI
  const completionResponse = await callOpenRouter(
    agentData.agent_type,
    `You've completed task: "${task.title}". Provide a summary of what you've accomplished and any recommendations for future improvements.`,
    { projectId, taskId: task.id },
    task.id,
    verbose
  );
  
  await supabase
    .from('chat_messages')
    .insert([{
      project_id: projectId,
      content: completionResponse,
      sender: agentData.name,
      type: "text"
    }]);
    
  // Update agent progress
  await supabase
    .from('agent_statuses')
    .update({ progress: 90 })
    .eq('id', agentId);
    
  console.log(`Completed task ${task.id}`);
  
  // Check for additional pending tasks for this agent
  const { data: pendingTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .eq('assigned_to', agentId)
    .eq('status', 'pending')
    .limit(1);
    
  if (pendingTasks && pendingTasks.length > 0) {
    console.log(`Agent ${agentId} has more pending tasks. Processing next task: ${pendingTasks[0].id}`);
    await processTask(projectId, agentId, agentData, pendingTasks[0], verbose);
  } else {
    console.log(`Agent ${agentId} has completed all tasks`);
  }
}
