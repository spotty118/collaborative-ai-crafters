import { Agent, Project, Task, TaskPriority, CodeFile } from '@/lib/types';
import { createMessage, createTask, createCodeFile } from '@/lib/api';
import { broadcastMessage } from './agent/messageBroker';

/**
 * Send a prompt to the agent using OpenRouter
 */
export const sendAgentPrompt = async (
  agent: Agent,
  prompt: string,
  project: Project
): Promise<string> => {
  try {
    console.log(`Sending prompt to ${agent.name}: ${prompt.substring(0, 50)}...`);
    
    // Send the request to our Supabase Edge Function for OpenRouter
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openrouter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        agentType: agent.type,
        projectContext: {
          name: project.name,
          description: project.description,
          sourceUrl: project.sourceUrl,
          sourceType: project.sourceType,
          id: project.id,
          created_at: project.created_at
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenRouter API Error:', errorData);
      throw new Error(`OpenRouter API request failed: ${errorData.error || response.statusText}`);
    }

    const responseData = await response.json();
    const agentResponse = responseData.choices[0].message.content;
    
    // Check if the response includes progress update data
    if (responseData.progressUpdate && responseData.progressUpdate.progress) {
      // This would be handled by the orchestrator now, but we could add a fallback here
      console.log(`Agent ${agent.name} progress update:`, responseData.progressUpdate.progress);
    }
    
    console.log(`Agent ${agent.name} response:`, agentResponse.substring(0, 100) + '...');
    
    // Create a message in the chat with the agent's response
    await createMessage({
      project_id: project.id,
      content: agentResponse,
      sender: agent.name,
      type: "text"
    });
    
    // Process any code snippets that were returned
    const codeSnippets = extractCodeSnippets(agentResponse);
    if (codeSnippets && codeSnippets.length > 0) {
      console.log(`Agent ${agent.name} generated ${codeSnippets.length} code snippets`);
      
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
    const tasksInfo = extractTasksInfo(agentResponse);
    if (tasksInfo && tasksInfo.length > 0) {
      console.log(`Agent ${agent.name} created ${tasksInfo.length} tasks`);
      
      for (const taskInfo of tasksInfo) {
        // Get the right agent ID based on the assigned agent type
        let assignedAgentId = agent.id; // Default to the current agent
        
        if (taskInfo.assignedTo !== agent.type && taskInfo.assignedTo.toLowerCase().includes('agent')) {
          // Try to find the correct agent by type
          const agentType = taskInfo.assignedTo.replace(/\s+agent/i, '').toLowerCase();
          // This would need access to all agents, which we don't have here
          console.log(`Task being assigned to ${agentType} agent type`);
          
          // For now, keep it assigned to the current agent and let the UI handle it
        }
        
        // Create the task with a more descriptive title that includes the agent name
        const taskTitle = `[${agent.name}] ${taskInfo.title}`;
        console.log(`Creating task: ${taskTitle} for agent ${assignedAgentId}`);
        
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
            content: `I've created a new task: "${taskInfo.title}" with ${taskInfo.priority} priority`,
            sender: agent.name,
            type: "text"
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
  } catch (error: any) {
    console.error("Error in sendAgentPrompt:", error);
    
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
  const standardRegex = /TASK: (.*?)\nASSIGNED TO: (.*?)\nDESCRIPTION: (.*?)\nPRIORITY: (.*?)(?:\n|$)/gs;
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
    const altRegex = /Task: (.*?)\nAssigned to: (.*?)\nDescription: (.*?)\nPriority: (.*?)(?:\n|$)/gis;
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
    const flexRegex = /(?:task|todo|to-do):\s*(.*?)(?:\n|$).*?(?:assigned|agent):\s*(.*?)(?:\n|$).*?(?:description|details):\s*(.*?)(?:\n|$).*?(?:priority):\s*(.*?)(?:\n|$)/gis;
    while ((match = flexRegex.exec(content)) !== null) {
      tasks.push({
        title: match[1].trim(),
        assignedTo: match[2].trim(),
        description: match[3].trim(),
        priority: match[4].trim().toLowerCase() || 'medium'
      });
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
  project: Project
): Promise<Record<string, string>> => {
  try {
    console.log(`Sending team prompt to ${agents.length} agents: ${prompt.substring(0, 50)}...`);
    
    // Create a map to store each agent's response
    const responses: Record<string, string> = {};
    
    // Process agents in sequence for a more coherent conversation flow
    for (const agent of agents) {
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
      
      // Send the request to our Supabase Edge Function for OpenRouter
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openrouter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          agentType: agent.type,
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
      const codeSnippets = extractCodeSnippets(agentResponse);
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
      const tasksInfo = extractTasksInfo(agentResponse);
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
