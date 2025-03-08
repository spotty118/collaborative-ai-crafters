
import { supabase } from '@/integrations/supabase/client';
import { Agent, Project } from '@/lib/types';
import { createTask } from './api';
import { parseCodeBlocks, inferFilePath } from './codeParser';
import { getGitHubService } from './services/GitHubService';
import { toast } from 'sonner';

export interface OpenRouterResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    index: number;
    finish_reason: string;
  }[];
  error?: string;
}

/**
 * Send a prompt to an agent and get a response via OpenRouter
 */
export const sendAgentPrompt = async (
  agent: Agent,
  prompt: string,
  project?: Project
): Promise<string> => {
  try {
    console.log(`Sending prompt to ${agent.name} (${agent.type}) agent using google/gemini-2.0-flash-thinking-exp:free model`);
    
    // Prepare detailed project context including GitHub repo if available
    const projectContext = project ? {
      id: project.id,
      name: project.name,
      description: project.description,
      techStack: project.techStack,
      status: project.status,
      sourceType: project.sourceType,
      sourceUrl: project.sourceUrl
    } : {};
    
    // Add GitHub-specific analysis instructions if repo URL is available
    let enhancedPrompt = prompt;
    if (project?.sourceUrl && project.sourceUrl.includes('github.com')) {
      if (!enhancedPrompt.includes('analyze') && !enhancedPrompt.includes('repository')) {
        enhancedPrompt = `For the GitHub repository at ${project.sourceUrl}, ${enhancedPrompt}. When providing code solutions, use markdown code blocks with language and optional file path in square brackets. Example: \`\`\`typescript [src/example.ts]\`.`;
      }
    }
    
    console.log('Calling OpenRouter function with body:', {
      agentType: agent.type, 
      prompt: enhancedPrompt,
      projectContext
    });
    
    const { data, error } = await supabase.functions.invoke('openrouter', {
      body: {
        agentType: agent.type,
        prompt: enhancedPrompt,
        projectContext
      }
    });

    if (error) {
      console.error('Error calling OpenRouter function:', error);
      return `Error: ${error.message}`;
    }

    console.log('Response from OpenRouter function:', data);
    
    const response = data as OpenRouterResponse;
    
    if (response.error) {
      console.error('OpenRouter API error:', response.error);
      return `Error: ${response.error}`;
    }

    if (response.choices && response.choices.length > 0) {
      const content = response.choices[0].message.content;
      
      // Look for code blocks in the response
      const codeBlocks = parseCodeBlocks(content);
      
      // If we have code blocks and project has a source URL, try to commit them
      if (codeBlocks.length > 0 && project?.sourceUrl) {
        try {
          const github = getGitHubService();
          for (const block of codeBlocks) {
            const path = block.path || inferFilePath(block);
            await github.createOrUpdateFile(
              path,
              block.content,
              `feat: ${agent.name} generated ${path}`
            );
            console.log(`Successfully committed ${path} to GitHub`);
            toast.success(`Created/updated ${path}`);
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('not initialized')) {
            console.warn('GitHub service not initialized - skipping code commits');
          } else {
            console.error('Error committing code to GitHub:', error);
            toast.error('Failed to commit code to GitHub: ' + 
              (error instanceof Error ? error.message : 'Unknown error')
            );
          }
        }
      }
      
      return content;
    }

    return 'No response generated. Please try again.';
  } catch (error) {
    console.error('Exception when calling OpenRouter:', error);
    return `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
  }
};

/**
 * Analyze GitHub repository and create tasks
 */
export const analyzeGitHubAndCreateTasks = async (
  agent: Agent,
  project: Project
): Promise<boolean> => {
  if (!project.sourceUrl || !project.sourceUrl.includes('github.com')) {
    console.error('No GitHub repository URL found for this project');
    return false;
  }

  try {
    // Create an analysis prompt based on the agent type
    const analysisPrompts: Record<string, string> = {
      'architect': `Analyze the GitHub repository architecture at ${project.sourceUrl} and list 3-5 specific tasks to improve the overall architecture and project structure.`,
      'frontend': `Analyze the GitHub repository frontend at ${project.sourceUrl} and list 3-5 specific tasks to improve UI/UX, performance, and code quality.`,
      'backend': `Analyze the GitHub repository backend at ${project.sourceUrl} and list 3-5 specific tasks to improve API design, database optimization, and security.`,
      'testing': `Analyze the GitHub repository testing at ${project.sourceUrl} and list 3-5 specific tasks to improve test coverage and quality assurance.`,
      'devops': `Analyze the GitHub repository DevOps setup at ${project.sourceUrl} and list 3-5 specific tasks to improve CI/CD, deployment, and infrastructure.`
    };
    
    const prompt = analysisPrompts[agent.type] || `Analyze the GitHub repository at ${project.sourceUrl} and list 3-5 specific tasks to improve it.`;
    
    console.log(`Agent ${agent.name} analyzing GitHub repository: ${project.sourceUrl}`);
    
    // Get analysis response from AI
    const analysisResponse = await sendAgentPrompt(agent, prompt, project);
    
    // Parse tasks from the response and create them
    const tasks = parseTasksFromAIResponse(analysisResponse, agent, project);
    
    // Create each task in the database
    for (const task of tasks) {
      await createTask({
        title: task.title,
        description: task.description,
        priority: 'medium',
        status: 'pending',
        assigned_to: agent.id,
        project_id: project.id
      });
    }
    
    console.log(`Agent ${agent.name} created ${tasks.length} tasks from GitHub analysis`);
    return true;
  } catch (error) {
    console.error('Error analyzing GitHub repository:', error);
    return false;
  }
};

/**
 * Parse tasks from AI response
 */
function parseTasksFromAIResponse(
  response: string,
  agent: Agent,
  project: Project
): Array<{title: string, description: string}> {
  const tasks: Array<{title: string, description: string}> = [];
  
  // Split response by common list markers and newlines
  const lines = response.split(/\n+/);
  
  let currentTask: {title: string, description: string} | null = null;
  
  for (const line of lines) {
    // Check if line starts with a number or bullet point, indicating a new task
    const taskMatch = line.match(/^(\d+[.)]|-|\*)\s+(.+)$/);
    
    if (taskMatch) {
      // If we have a current task, add it to the collection
      if (currentTask) {
        tasks.push(currentTask);
      }
      
      // Start a new task with this line as the title
      currentTask = {
        title: taskMatch[2].trim(),
        description: `Task suggested by ${agent.name} for ${project.name}`
      };
    } else if (currentTask && line.trim() && !line.startsWith('#')) {
      // Add non-empty, non-header lines to the current task description
      currentTask.description += '\n' + line.trim();
    }
  }
  
  // Add the last task if we have one
  if (currentTask) {
    tasks.push(currentTask);
  }
  
  // If we couldn't parse any tasks, create a general task based on the agent type
  if (tasks.length === 0) {
    const fallbackTasks: Record<string, string> = {
      'architect': 'Improve project architecture',
      'frontend': 'Enhance user interface components',
      'backend': 'Optimize API and database operations',
      'testing': 'Increase test coverage',
      'devops': 'Streamline deployment process'
    };
    
    tasks.push({
      title: fallbackTasks[agent.type] || `${agent.name} improvement task`,
      description: `General improvement task from ${agent.name}:\n\n${response}`
    });
  }
  
  return tasks;
}
