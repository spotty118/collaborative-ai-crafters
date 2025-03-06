
/**
 * Utility for parsing tasks from architect's response
 */

type ParsedTask = {
  title: string;
  description: string;
  agentType?: string;
};

// Track previously created tasks to avoid duplication within a session
const taskTitleCache = new Set<string>();

/**
 * Clear the task title cache when starting a new analysis session
 */
export function clearTaskTitleCache(): void {
  taskTitleCache.clear();
}

/**
 * Check if a task title has been seen before
 */
export function isTaskTitleDuplicate(title: string): boolean {
  return taskTitleCache.has(title);
}

/**
 * Record a task title as having been created
 */
export function recordTaskTitle(title: string): void {
  taskTitleCache.add(title);
}

/**
 * Parse tasks from architect's response
 */
export function parseTasksFromArchitectResponse(
  response: string,
  concise: boolean = true
): Array<ParsedTask> {
  const tasks: Array<ParsedTask> = [];
  
  // Split the response into lines for processing
  const lines = response.split(/\n+/);
  
  let currentTask: ParsedTask | null = null;
  let parsingAssignment = false;
  
  for (const line of lines) {
    // Check for task headers like "Task 1:" or numbered/bulleted list items
    const taskMatch = line.match(/^(Task \d+:|[*-]\s+|^\d+\.\s+)(.+)$/i);
    
    if (taskMatch) {
      // If we have a current task, add it to the list before starting a new one
      if (currentTask) {
        tasks.push(currentTask);
      }
      
      // Start a new task with the title from the match
      currentTask = {
        title: taskMatch[2].trim(),
        description: concise ? '' : '' // If concise, start with empty description
      };
      parsingAssignment = false;
    } 
    // Look for "Assigned to:" lines
    else if (currentTask && line.toLowerCase().includes('assigned to:')) {
      parsingAssignment = true;
      
      // Extract the agent type from this line
      const agentTypeMatch = line.match(/assigned to:?\s+(\w+)/i);
      if (agentTypeMatch) {
        const agentType = agentTypeMatch[1].toLowerCase();
        
        // Map common agent references to our specific agent types
        if (agentType.includes('front')) {
          currentTask.agentType = 'frontend';
        } else if (agentType.includes('back') || agentType.includes('api')) {
          currentTask.agentType = 'backend';
        } else if (agentType.includes('test') || agentType.includes('qa')) {
          currentTask.agentType = 'testing';
        } else if (agentType.includes('devops') || agentType.includes('deploy')) {
          currentTask.agentType = 'devops';
        } else if (agentType.includes('arch')) {
          currentTask.agentType = 'architect';
        }
      }
    }
    // Look for "Expected outcome:" lines to end the assignment section
    else if (currentTask && line.toLowerCase().includes('expected outcome:')) {
      parsingAssignment = false;
      // Only add to description if not in concise mode
      if (!concise) {
        currentTask.description += line.trim() + '\n';
      }
    }
    // Add content to description, checking for agent type if we're in the assignment section
    else if (currentTask && !concise) {
      currentTask.description += line.trim() + '\n';
      
      // If we're parsing the assignment section, keep looking for agent type
      if (parsingAssignment && !currentTask.agentType) {
        const agentMention = line.match(/(frontend|backend|testing|devops|architect)\s+agent/i);
        if (agentMention) {
          currentTask.agentType = agentMention[1].toLowerCase();
        }
      }
    }
  }
  
  // Add the last task if we have one
  if (currentTask) {
    tasks.push(currentTask);
  }
  
  // Cleanup task descriptions by trimming whitespace
  const parsedTasks = tasks.map(task => ({
    ...task,
    description: concise ? `Task assigned to ${task.agentType || 'unspecified'} agent.` : task.description.trim()
  }));
  
  // Filter out duplicate tasks by title
  const uniqueTasks = parsedTasks.filter(task => {
    if (isTaskTitleDuplicate(task.title)) {
      console.log(`Skipping duplicate parsed task: "${task.title}"`);
      return false;
    }
    return true;
  });
  
  return uniqueTasks;
}

/**
 * Format error object to string for task descriptions
 */
export function formatErrorForTaskDescription(error: unknown): string {
  if (!error) return "Unknown error";
  
  if (error instanceof Error) {
    return error.message || "Error occurred";
  }
  
  if (typeof error === 'object') {
    try {
      // Try to stringify the object for better display
      return JSON.stringify(error) || "Error object";
    } catch (e) {
      return "Error object cannot be displayed";
    }
  }
  
  return String(error);
}
