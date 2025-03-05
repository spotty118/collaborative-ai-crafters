import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ProjectCard } from "@/components/ProjectCard";
import { AuthButton } from "@/components/auth/AuthButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface ImportProjectFormValues {
  name: string;
  description: string;
  sourceUrl: string;
}

interface CreateProjectFormValues {
  name: string;
  description: string;
  techStack: string;
}

const importProjectSchema = z.object({
  name: z.string().min(3, {
    message: "Project name must be at least 3 characters."
  }),
  description: z.string().optional(),
  sourceUrl: z.string().url({
    message: "Please enter a valid URL."
  })
});

const createProjectSchema = z.object({
  name: z.string().min(3, {
    message: "Project name must be at least 3 characters."
  }),
  description: z.string().optional(),
  techStack: z.string().optional()
});

const Index = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
    };
    
    checkUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
      }
    );
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      if (user) {
        const { data, error } = await supabase.from("projects").select("*").eq("owner_id", user.id).order("created_at", {
          ascending: false
        });
        
        if (error) {
          console.error("Error fetching projects:", error);
          toast.error("Failed to load projects.");
        } else {
          setProjects(data || []);
        }
      }
    };
    
    fetchProjects();
  }, [user]);

  const importProjectForm = useForm<ImportProjectFormValues>({
    resolver: zodResolver(importProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      sourceUrl: ""
    }
  });

  const createProjectForm = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      techStack: ""
    }
  });

  const handleImportProject = async (values: ImportProjectFormValues) => {
    try {
      setImporting(true);
      
      const { data, error } = await supabase.from('projects').insert({
        name: values.name,
        description: values.description,
        source_url: values.sourceUrl,
        source_type: 'github',
        owner_id: user?.id,
        status: 'active',
        tech_stack: []
      }).select().single();
      
      if (error) throw error;
      
      if (data) {
        navigate(`/project/${data.id?.toString()}`);
        toast.success('Project imported successfully');
      }
    } catch (error: any) {
      console.error('Error importing project:', error);
      toast.error('Failed to import project: ' + (error.message || 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  const handleCreateProject = async (values: CreateProjectFormValues) => {
    try {
      setCreating(true);
      
      const techStackArray = values.techStack ? 
        values.techStack.split(',').map(item => item.trim()) : 
        [];
      
      const { data, error } = await supabase.from('projects').insert({
        name: values.name,
        description: values.description,
        tech_stack: techStackArray,
        owner_id: user?.id,
        status: 'active'
      }).select().single();
      
      if (error) throw error;
      
      if (data) {
        navigate(`/project/${data.id?.toString()}`);
        toast.success('Project created successfully');
      }
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project: ' + (error.message || 'Unknown error'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Projects</h1>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Import Project</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Import Project</DialogTitle>
                <DialogDescription>
                  Import an existing project from a GitHub repository.
                </DialogDescription>
              </DialogHeader>
              <Form {...importProjectForm}>
                <form
                  onSubmit={importProjectForm.handleSubmit(handleImportProject)}
                  className="space-y-4"
                >
                  <FormField
                    control={importProjectForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input placeholder="My Project" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={importProjectForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="A brief description of the project"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={importProjectForm.control}
                    name="sourceUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GitHub Repository URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://github.com/username/repo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={importing}>
                    {importing ? (
                      <>
                        Importing <span className="animate-spin">...</span>
                      </>
                    ) : (
                      "Import"
                    )}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                New Project <PlusCircle className="ml-2 h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Start a new project from scratch.
                </DialogDescription>
              </DialogHeader>
              <Form {...createProjectForm}>
                <form
                  onSubmit={createProjectForm.handleSubmit(handleCreateProject)}
                  className="space-y-4"
                >
                  <FormField
                    control={createProjectForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input placeholder="My Project" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createProjectForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="A brief description of the project"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createProjectForm.control}
                    name="techStack"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tech Stack</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., React, Node.js, PostgreSQL"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Comma-separated list of technologies
                        </p>
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={creating}>
                    {creating ? (
                      <>
                        Creating <span className="animate-spin">...</span>
                      </>
                    ) : (
                      "Create"
                    )}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <AuthButton />
        </div>
      </div>
      {projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No projects yet. Create or import one to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Index;
