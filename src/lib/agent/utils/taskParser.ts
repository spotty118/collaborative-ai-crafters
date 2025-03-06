/**
 * Utility for parsing tasks from architect's response
 */

type ParsedTask = {
  title: string;
  description: string;
  agentType?: string;
};

/**
 * Parse tasks from architect's response
 */
export function parseTasksFromArchitectResponse(
  response: string
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
        description: ''
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
      currentTask.description += line.trim() + '\n';
    }
    // Add content to description, checking for agent type if we're in the assignment section
    else if (currentTask) {
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
  return tasks.map(task => ({
    ...task,
    description: task.description.trim()
  }));
}
