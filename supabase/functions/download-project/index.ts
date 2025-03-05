
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabase } from "../_shared/supabase-client.ts";
import * as zip from "https://deno.land/x/zipjs@v2.7.30/index.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Download project function called");
    
    // Parse request to get project ID
    const { projectId } = await req.json();
    
    if (!projectId) {
      console.error("No project ID provided in request");
      return new Response(
        JSON.stringify({ error: 'Project ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Preparing download for project: ${projectId}`);
    
    // Fetch project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
      
    if (projectError) {
      console.error('Error fetching project:', projectError);
      return new Response(
        JSON.stringify({ error: `Project not found: ${projectError.message}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!project) {
      console.error('Project not found, but no error returned');
      return new Response(
        JSON.stringify({ error: 'Project not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found project: ${project.name}`);
    
    // Fetch all code files for the project
    const { data: files, error: filesError } = await supabase
      .from('code_files')
      .select('*')
      .eq('project_id', projectId);
      
    if (filesError) {
      console.error('Error fetching code files:', filesError);
      return new Response(
        JSON.stringify({ error: `Failed to fetch project files: ${filesError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Files query returned: ${files ? files.length : 0} files`);
    
    // If no files found, create a simple README to explain
    if (!files || files.length === 0) {
      console.log('No files found, creating a simple zip with just a README');
      
      const zipWriter = new zip.ZipWriter(new zip.Data64URIWriter("application/zip"));
      
      const readmeContent = `# ${project.name}
    
${project.description || ''}

## Project Information
- Created: ${new Date(project.created_at).toLocaleDateString()}
- Last Updated: ${new Date(project.updated_at).toLocaleDateString()}
- Tech Stack: ${project.tech_stack ? project.tech_stack.join(', ') : ''}

${project.requirements ? `## Requirements\n${project.requirements}` : ''}

## Note
This project does not have any code files stored in the system yet.
`;

      await zipWriter.add("README.md", new zip.TextReader(readmeContent));
      
      // Close the zip and get the data URL
      const dataURI = await zipWriter.close();
      
      console.log('Empty project ZIP file created successfully');
      
      // Return the data URI
      return new Response(
        JSON.stringify({ 
          success: true, 
          dataURI,
          filename: `${project.name.replace(/\s+/g, '-').toLowerCase()}-project.zip`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found ${files.length} files for project ${projectId}`);
    
    // Create a new zip file
    const zipWriter = new zip.ZipWriter(new zip.Data64URIWriter("application/zip"));
    
    // Add each file to the zip
    for (const file of files) {
      try {
        if (!file.path || !file.content) {
          console.log(`Skipping file with invalid path or content: ${file.id}`);
          continue;
        }
        await zipWriter.add(file.path, new zip.TextReader(file.content));
        console.log(`Added file: ${file.path}`);
      } catch (fileError) {
        console.error(`Error adding file ${file.path} to zip:`, fileError);
        // Continue with other files even if one fails
      }
    }
    
    // Add a README.md file with project information
    const readmeContent = `# ${project.name}
    
${project.description || ''}

## Project Information
- Created: ${new Date(project.created_at).toLocaleDateString()}
- Last Updated: ${new Date(project.updated_at).toLocaleDateString()}
- Tech Stack: ${project.tech_stack ? project.tech_stack.join(', ') : ''}

${project.requirements ? `## Requirements\n${project.requirements}` : ''}
`;

    await zipWriter.add("README.md", new zip.TextReader(readmeContent));
    
    // Close the zip and get the data URL
    const dataURI = await zipWriter.close();
    
    console.log('ZIP file created successfully');
    
    // Return the data URI
    return new Response(
      JSON.stringify({ 
        success: true, 
        dataURI,
        filename: `${project.name.replace(/\s+/g, '-').toLowerCase()}-project.zip`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in download-project function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
