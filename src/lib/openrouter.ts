import { Agent, Project, Task, TaskPriority, CodeFile } from '@/lib/types';
import { createMessage, createTask, createCodeFile } from '@/lib/api';
import { broadcastMessage } from './agent/messageBroker';
import { toast } from "sonner";

/**
 * Send a prompt to the agent using OpenRouter
 */
export const sendAgentPrompt = async (
  agent: Agent,
  prompt: string,
  project: Project,
  model: string = "anthropic/claude-3.7-sonnet:thinking",
  multipartContent = null
): Promise<string> => {
  try {
    console.log(`Sending prompt to ${agent.name}`);
    if (multipartContent) {
      console.log("Using multimodal content (e.g., text+image)");
    } else {
      console.log(`Prompt excerpt: ${prompt.substring(0, 50)}...`);
    }
    console.log(`Using model: ${model}`);
    
    // Add timestamp for debugging
    console.log(`Request started at: ${new Date().toISOString()}`);
    
    // Prepare the request body based on whether we have multipart content
    const requestBody = multipartContent 
      ? {
          agentType: agent.type,
          model: "anthropic/claude-3.7-sonnet:thinking", // Ensure consistent model usage
          multipartContent: multipartContent,
          projectContext: {
            name: project.name,
            description: project.description,
            sourceUrl: project.sourceUrl,
            sourceType: project.sourceType,
            id: project.id,
            created_at: project.created_at
          }
        }
      : {
          prompt,
          agentType: agent.type,
          model: "anthropic/claude-3.7-sonnet:thinking", // Ensure consistent model usage
          projectContext: {
            name: project.name,
            description: project.description,
            sourceUrl: project.sourceUrl,
            sourceType: project.sourceType,
            id: project.id,
            created_at: project.created_at
          }
        };
    
    // Log the request body for debugging
    console.log(`Request body: ${JSON.stringify(requestBody).substring(0, 500)}...`);
    
    // Send the request to our Supabase Edge Function for OpenRouter
    console.log(`Making direct fetch to ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openrouter`);
    
    // Add retry logic for resilience
    let attempts = 0;
    const maxAttempts = 2;
    let lastError = null;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`Attempt ${attempts} of ${maxAttempts}`);
        
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openrouter`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        console.log(`Response received at: ${new Date().toISOString()}`);
        console.log(`Response status: ${response.status}`);

        if (!response.ok) {
          const responseText = await response.text();
          console.error('Raw error response:', responseText);
          
          let errorMessage = `OpenRouter API request failed with status ${response.status}`;
          try {
            const errorData = JSON.parse(responseText);
            console.error('OpenRouter API Error:', errorData);
            
            // Check if the error is an OpenRouter or upstream provider error
            if (errorData.error) {
              if (typeof errorData.error === 'string') {
                errorMessage = `OpenRouter API request failed: ${errorData.error}`;
              } else if (errorData.error.message) {
                errorMessage = `OpenRouter API request failed: ${errorData.error.message}`;
              } else {
                errorMessage = `OpenRouter API request failed: ${JSON.stringify(errorData.error)}`;
              }
            } else if (errorData.stack) {
              errorMessage = `OpenRouter API request failed: Internal error with stack trace`;
              console.error('Error stack:', errorData.stack);
            }
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError);
            errorMessage = `OpenRouter API request failed with status ${response.status}: ${responseText.substring(0, 200)}`;
          }
          
          // If we're on the last attempt, show toast notification for the error
          if (attempts >= maxAttempts) {
            toast.error(errorMessage);
            throw new Error(errorMessage);
          }
          
          // Otherwise, continue to the next attempt
          lastError = new Error(errorMessage);
          console.log(`Retrying after error: ${errorMessage}`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a second before retrying
          continue;
        }

        const responseData = await response.json();
        console.log(`Response parsed at: ${new Date().toISOString()}`);
        console.log('Response type:', typeof responseData);
        console.log('Response structure:', Object.keys(responseData).join(', '));
        
        // Handle direct responses from multimodal requests differently
        if (multipartContent) {
          if (!responseData.choices || !responseData.choices[0]) {
            console.error('Unexpected multimodal response format:', responseData);
            throw new Error('Received an invalid response format from OpenRouter');
          }
          
          const agentResponse = responseData.choices[0].message.content;
          
          // Create a message with the response
          await createMessage({
            project_id: project.id,
            content: agentResponse,
            sender: agent.name,
            type: "text"
          });
          
          return agentResponse;
        }
        
        // Standard response processing
        if (!responseData.choices || !responseData.choices[0]) {
          console.error('Unexpected response format:', responseData);
          throw new Error('Received an invalid response format from OpenRouter');
        }
        
        const agentResponse = responseData.choices[0].message.content;
        const thinkingResponse = responseData.choices[0].thinking || '';
        
        if (thinkingResponse) {
          console.log(`Agent ${agent.name} thinking:`, thinkingResponse.substring(0, 100) + '...');
          
          // Create a message with the thinking process (if you want to show it in UI)
          await createMessage({
            project_id: project.id,
            content: `Thinking process: ${thinkingResponse}`,
            sender: `${agent.name} (Thinking)`,
            type: "thinking"
          });
        }
        
        console.log(`Agent ${agent.name} response:`, agentResponse.substring(0, 100) + '...');
        
        // Check if the response contains any markers of non-production code
        if (agentResponse.includes("let's implement") || 
            agentResponse.includes("Let's implement") ||
            agentResponse.includes("would look something like") ||
            agentResponse.includes("might look like")) {
          console.warn("Response contains descriptive language instead of real code");
        }
        
        // Create a message in the chat with the agent's response
        await createMessage({
          project_id: project.id,
          content: agentResponse,
          sender: agent.name,
          type: "text"
        });
        
        // Process any code snippets that were returned
        const codeSnippets = responseData.codeSnippets || extractCodeSnippets(agentResponse);
        if (codeSnippets && codeSnippets.length > 0) {
          console.log(`Agent ${agent.name} generated ${codeSnippets.length} code snippets`);
          
          for (const snippet of codeSnippets) {
            const fileName = snippet.filePath.split('/').pop();
            
            // Skip code snippets that appear to be descriptive rather than real code
            if (isDescriptiveCode(snippet.code)) {
              console.warn(`Skipping non-implementation code for ${snippet.filePath}`);
              await createMessage({
                project_id: project.id,
                content: `Warning: I detected that the code for ${snippet.filePath} was descriptive rather than a real implementation. I've skipped creating this file. Please ask me to implement it properly.`,
                sender: agent.name,
                type: "error"
              });
              continue;
            }
            
            // Create a code file entry in the database
            await createCodeFile({
              project_id: project.id,
              name: fileName,
              path: snippet.filePath,
              content: snippet.code,
              language: determineLanguage(snippet.filePath),
              created_by: agent.name,
              last_modified_by: agent.name
            });
            
            // Add a message about the created file
            await createMessage({
              project_id: project.id,
              content: `I've created a new file: ${snippet.filePath}`,
              sender: agent.name,
              type: "code",
              code_language: determineLanguage(snippet.filePath)
            });
          }
        }
        
        // Process any tasks that were created
        const tasksInfo = responseData.tasksInfo || extractTasksInfo(agentResponse);
        if (tasksInfo && tasksInfo.length > 0) {
          console.log(`Agent ${agent.name} created ${tasksInfo.length} tasks`);
          
          // Create a short summary message about task creation
          const taskSummary = `I've identified ${tasksInfo.length} tasks that need to be completed for this project.`;
          await createMessage({
            project_id: project.id,
            content: taskSummary,
            sender: agent.name,
            type: "text"
          });
          
          for (const taskInfo of tasksInfo) {
            // Get the right agent ID based on the assigned agent type
            let assignedAgentId = agent.id; // Default to the current agent
            let assignedAgentType = taskInfo.assignedTo.toLowerCase();
            
            if (assignedAgentType !== agent.type.toLowerCase()) {
              // Try to find matching agent based on various possible formats
              if (assignedAgentType.includes('front')) assignedAgentType = 'frontend';
              else if (assignedAgentType.includes('back')) assignedAgentType = 'backend';
              else if (assignedAgentType.includes('test')) assignedAgentType = 'testing';
              else if (assignedAgentType.includes('dev') && assignedAgentType.includes('ops')) assignedAgentType = 'devops';
              else if (assignedAgentType.includes('arch')) assignedAgentType = 'architect';
              
              console.log(`Looking for agent type: ${assignedAgentType}`);
              
              // Fetch agents for this project
              try {
                const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/agent_statuses?project_id=eq.${project.id}&agent_type=ilike.${assignedAgentType}%`, {
                  headers: {
                    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                    'Content-Type': 'application/json'
                  }
                });
                
                if (response.ok) {
                  const agents = await response.json();
                  if (agents && agents.length > 0) {
                    assignedAgentId = agents[0].id;
                    console.log(`Found matching agent: ${agents[0].name} (${assignedAgentId})`);
                  }
                }
              } catch (error) {
                console.error("Error finding matching agent:", error);
              }
            }
            
            // Create a descriptive title that includes the agent name
            const taskTitle = agent.type === 'architect' ? 
              taskInfo.title : // Keep architect's task titles clean
              `[${agent.name}] ${taskInfo.title}`; // Add creator prefix for other agents
              
            console.log(`Creating task: ${taskTitle} assigned to agent ${assignedAgentId}`);
            
            try {
              // Create the task
              await createTask({
                project_id: project.id,
                title: taskTitle,
                description: taskInfo.description,
                assigned_to: assignedAgentId,
                status: 'pending',
                priority: taskInfo.priority as TaskPriority || 'medium'
              });
            } catch (error) {
              console.error(`Error creating task ${taskTitle}:`, error);
              await createMessage({
                project_id: project.id,
                content: `Failed to create task: "${taskInfo.title}" - ${error instanceof Error ? error.message : 'Unknown error'}`,
                sender: agent.name,
                type: "error"
              });
            }
          }
        }
        
        return agentResponse;
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempts} failed:`, error);
        
        if (attempts >= maxAttempts) {
          throw error;
        }
        
        // Wait a bit longer before the next retry
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    // If we get here, we've exhausted all attempts
    throw lastError || new Error("Failed to connect to OpenRouter after multiple attempts");
    
  } catch (error: any) {
    console.error("Error in sendAgentPrompt:", error);
    console.error("Error stack:", error.stack);
    
    // Create an error message in chat
    if (project.id) {
      await createMessage({
        project_id: project.id,
        content: `I encountered an error: ${error.message}`,
        sender: agent.name,
        type: "error"
      });
    }
    
    throw error;
  }
};

/**
 * Send a multimodal prompt to the agent (text + images)
 */
export const sendMultimodalPrompt = async (
  agent: Agent,
  messages: any[],
  project: Project,
  model: string = "anthropic/claude-3.7-sonnet"
): Promise<string> => {
  // Validate that the messages format is correct for multimodal
  const isValidMultimodal = messages.some(msg => 
    msg.content && Array.isArray(msg.content) && 
    msg.content.some(item => item.type === 'image_url')
  );
  
  if (!isValidMultimodal) {
    throw new Error("Invalid multimodal format. Must include at least one image.");
  }
  
  console.log("Sending multimodal request with messages:", 
    JSON.stringify(messages.map(msg => ({
      role: msg.role,
      content: Array.isArray(msg.content) ? 
        msg.content.map(item => 
          item.type === 'image_url' ? {type: 'image_url', url: 'image-url-hidden'} : 
          {type: item.type, text: item.text?.substring(0, 30) + '...'}) : 
        'string content'
    }))));
  
  // Use the sendAgentPrompt function but with multipartContent and force the model to be the thinking model
  return sendAgentPrompt(agent, "", project, "anthropic/claude-3.7-sonnet:thinking", messages);
};

/**
 * Check if code appears to be descriptive rather than an actual implementation
 */
function isDescriptiveCode(code: string): boolean {
  // Check for tell-tale signs that this is describing code rather than being code
  const descriptiveKeywords = [
    "let's", "Let's", 
    "we need to", "We need to", 
    "We'll", "we'll", 
    "I'll", "i'll",
    "would look something like", 
    "might look like",
    "For example", "for example"
  ];
  
  // Check for presence of descriptive keywords
  for (const keyword of descriptiveKeywords) {
    if (code.includes(keyword)) return true;
  }
  
  // Check for absence of common code syntax (for JS/TS files)
  if (code.length > 20 && 
      !code.includes(";") && 
      !code.includes("=") && 
      !code.includes("{") && 
      !code.includes("}") && 
      !code.includes("import") && 
      !code.includes("export") &&
      !code.includes("<") && // For HTML/JSX
      !code.includes(">")) {
    return true;
  }
  
  return false;
}

/**
 * Extract code snippets from content
 */
function extractCodeSnippets(content: string): { filePath: string; code: string }[] {
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

/**
 * Extract task information from content
 */
function extractTasksInfo(content: string): { title: string; assignedTo: string; description: string; priority: string }[] {
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

/**
 * Determine the language of a file based on its extension
 */
function determineLanguage(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'js':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'jsx':
      return 'jsx';
    case 'tsx':
      return 'tsx';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'py':
      return 'python';
    case 'rb':
      return 'ruby';
    case 'go':
      return 'go';
    case 'java':
      return 'java';
    case 'php':
      return 'php';
    case 'c':
      return 'c';
    case 'cpp':
      return 'cpp';
    case 'cs':
      return 'csharp';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'sh':
      return 'bash';
    case 'sql':
      return 'sql';
    default:
      return 'plaintext';
  }
}

/**
 * Send a team collaborative prompt to multiple agents
 */
export const sendTeamPrompt = async (
  agents: Agent[],
  prompt: string,
  project: Project,
  model: string = "anthropic/claude-3.7-sonnet:thinking"
): Promise<Record<string, string>> => {
  try {
    console.log(`Sending team prompt to ${agents.length} agents: ${prompt.substring(0, 50)}...`);
    console.log(`Using model: ${model}`);
    
    // Create a map to store each agent's response
    const responses: Record<string, string> = {};
    
    // Process agents in sequence for a more coherent conversation flow
    for (const agent of agents) {
      try {
        // Add context about which agents are participating
        const teamContext = {
          team: agents.map(a => ({ name: a.name, type: a.type })),
          currentAgent: { name: agent.name, type: agent.type }
        };
        
        // Create an enhanced prompt that includes team context
        const enhancedPrompt = `
As part of a development team that includes ${agents.map(a => a.name).join(', ')}, 
please respond to the following request from the user:

${prompt}

Remember that you are the ${agent.name} (${agent.type}) and should focus on your specialty 
while acknowledging the roles of your teammates.

IMPORTANT: If you identify any tasks that need to be done, please list them in this format:
TASK: [Task name]
ASSIGNED TO: [Agent type, e.g. Frontend]
DESCRIPTION: [Detailed description]
PRIORITY: [high/medium/low]`;
        
        console.log(`Sending request for team member ${agent.name}`);
        
        // Send the request to our Supabase Edge Function for OpenRouter
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openrouter`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            agentType: agent.type,
            model: "anthropic/claude-3.7-sonnet:thinking", // Ensure consistent model usage
            projectContext: {
              name: project.name,
              description: project.description,
              sourceUrl: project.sourceUrl,
              sourceType: project.sourceType,
              id: project.id,
              created_at: project.created_at,
              teamContext
            }
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`OpenRouter API Error for ${agent.name}:`, errorData);
          responses[agent.id] = `I couldn't process this request due to an error: ${errorData.error || response.statusText}`;
          continue;
        }

        const responseData = await response.json();
        console.log(`Response received for team member ${agent.name}`);
        
        const agentResponse = responseData.choices[0].message.content;
        
        // Store the response
        responses[agent.id] = agentResponse;
        
        // Send the message to the chat
        await createMessage({
          project_id: project.id,
          content: agentResponse,
          sender: agent.name,
          type: "text"
        });
        
        // Process any code snippets and tasks
        const codeSnippets = responseData.codeSnippets || extractCodeSnippets(agentResponse);
        if (codeSnippets && codeSnippets.length > 0) {
          for (const snippet of codeSnippets) {
            const fileName = snippet.filePath.split('/').pop();
            
            // Create a code file entry in the database
            await createCodeFile({
              project_id: project.id,
              name: fileName,
              path: snippet.filePath,
              content: snippet.code,
              language: determineLanguage(snippet.filePath),
              created_by: agent.name,
              last_modified_by: agent.name
            });
            
            // Add a message about the created file
            await createMessage({
              project_id: project.id,
              content: `I've created a new file: ${snippet.filePath}`,
              sender: agent.name,
              type: "code",
              code_language: determineLanguage(snippet.filePath)
            });
          }
        }
        
        // Process any tasks that were created
        const tasksInfo = responseData.tasksInfo || extractTasksInfo(agentResponse);
        if (tasksInfo && tasksInfo.length > 0) {
          console.log(`Agent ${agent.name} created ${tasksInfo.length} tasks in team collaboration`);
          
          for (const taskInfo of tasksInfo) {
            let assignedAgentId = agent.id; // Default to the current agent
            
            // Try to find the correct agent by type
            if (taskInfo.assignedTo !== agent.type && taskInfo.assignedTo.toLowerCase().includes('agent')) {
              const agentType = taskInfo.assignedTo.replace(/\s+agent/i, '').toLowerCase();
              const assignedAgent = agents.find(a => a.type.toLowerCase() === agentType);
              if (assignedAgent) {
                assignedAgentId = assignedAgent.id;
                console.log(`Found agent match: ${assignedAgent.name} (${assignedAgent.id})`);
              } else {
                console.log(`Could not find agent for type: ${agentType}`);
              }
            } else if (!taskInfo.assignedTo.toLowerCase().includes('agent')) {
              // Try to match just the agent type without the word "agent"
              const agentType = taskInfo.assignedTo.toLowerCase().trim();
              const assignedAgent = agents.find(a => a.type.toLowerCase() === agentType);
              if (assignedAgent) {
                assignedAgentId = assignedAgent.id;
                console.log(`Found agent match by type only: ${assignedAgent.name} (${assignedAgent.id})`);
              }
            }
            
            // Create the task with a more descriptive title that includes the agent name
            const taskTitle = `[${agent.name}] ${taskInfo.title}`;
            console.log(`Creating team task: ${taskTitle} for agent ${assignedAgentId}`);
            
            try {
              // Create the task
              await createTask({
                project_id: project.id,
                title: taskTitle,
                description: taskInfo.description,
                assigned_to: assignedAgentId,
                status: 'pending',
                priority: taskInfo.priority as TaskPriority || 'medium'
              });
              
              // Add a message about the created task
              await createMessage({
                project_id: project.id,
                content: `I've created a new task: "${taskInfo.title}" with ${taskInfo.priority} priority, assigned to ${taskInfo.assignedTo}`,
                sender: agent.name,
                type: "text"
              });
            } catch (error) {
              console.error(`Error creating team task ${taskTitle}:`, error);
              await createMessage({
                project_id: project.id,
                content: `Failed to create task: "${taskInfo.title}" - ${error instanceof Error ? error.message : 'Unknown error'}`,
                sender: agent.name,
                type: "error"
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error processing team request for ${agent.name}:`, error);
        // Continue with other agents even if one fails
        responses[agent.id] = `I encountered an error while processing this request: ${error instanceof Error ? error.message : String(error)}`;
        
        await createMessage({
          project_id: project.id,
          content: `I encountered an error while processing this request: ${error instanceof Error ? error.message : String(error)}`,
          sender: agent.name,
          type: "error"
        });
      }
      
      // Small delay between agent responses to make the conversation more natural
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return responses;
  } catch (error: any) {
    console.error("Error in sendTeamPrompt:", error);
    
    // Create an error message in chat
    if (project.id) {
      await createMessage({
        project_id: project.id,
        content: `Team communication error: ${error.message}`,
        sender: "System",
        type: "error"
      });
    }
    
    throw error;
  }
};

/**
 * Add a direct test function to check if OpenRouter is accessible
 */
export const testOpenRouterConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('Testing OpenRouter connection...');
    
    // Make a direct fetch to the edge function
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openrouter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        prompt: "This is a test prompt. Please respond with 'OpenRouter is working correctly.'",
        agentType: "test",
        projectContext: {
          name: "Test Project",
          description: "Testing OpenRouter connection"
        },
        model: "anthropic/claude-3.7-sonnet:thinking"
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter test error:', errorText);
      
      let errorMessage = "OpenRouter test failed";
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || `Status ${response.status}: ${response.statusText}`;
      } catch (e) {
        errorMessage = `Status ${response.status}: ${errorText.substring(0, 100)}`;
      }
      
      return { 
        success: false, 
        message: `OpenRouter test failed: ${errorMessage}` 
      };
    }
    
    const data = await response.json();
    console.log('OpenRouter test response:', data);
    
    // Check if the response has the expected format
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return { 
        success: false, 
        message: 'OpenRouter returned an unexpected response format' 
      };
    }
    
    return { 
      success: true, 
      message: 'OpenRouter is accessible and responding correctly' 
    };
  } catch (error) {
    console.error('Exception testing OpenRouter:', error);
    return { 
      success: false, 
      message: `Exception testing OpenRouter: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};
