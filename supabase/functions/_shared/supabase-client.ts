
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

export const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export async function deleteProject(projectId: string): Promise<void> {
  // Delete related records first (due to foreign key constraints)
  // Delete agent statuses
  const { error: agentError } = await supabase
    .from('agent_statuses')
    .delete()
    .eq('project_id', projectId);
    
  if (agentError) throw agentError;
  
  // Delete tasks
  const { error: taskError } = await supabase
    .from('tasks')
    .delete()
    .eq('project_id', projectId);
    
  if (taskError) throw taskError;
  
  // Delete chat messages
  const { error: messageError } = await supabase
    .from('chat_messages')
    .delete()
    .eq('project_id', projectId);
    
  if (messageError) throw messageError;
  
  // Delete code files
  const { error: codeFileError } = await supabase
    .from('code_files')
    .delete()
    .eq('project_id', projectId);
    
  if (codeFileError) throw codeFileError;
  
  // Finally delete the project
  const { error: projectError } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);
    
  if (projectError) throw projectError;
}
