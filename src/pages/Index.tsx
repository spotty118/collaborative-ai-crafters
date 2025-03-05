
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProjects, createProject } from "@/lib/api";

import Header from "@/components/layout/Header";
import ProjectList from "@/components/ProjectList";
import ProjectSetup from "@/components/layout/ProjectSetup";
import { ProjectDB } from "@/lib/types";
import { toast } from "sonner";

// Define form schema with Zod
const projectFormSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters" }),
  description: z.string().optional(),
  requirements: z.string().optional(),
  source_type: z.string().optional(),
  source_url: z.string().url({ message: "Please enter a valid URL" }).optional().or(z.literal("")),
  tech_stack: z.array(z.string()).optional(),
});

// Define interface for form values
interface ProjectFormValues {
  name: string;
  description?: string;
  requirements?: string;
  source_type?: string;
  source_url?: string;
  tech_stack?: string[];
}

const Index: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"new" | "existing">("new");

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects
  });

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      requirements: "",
      source_type: "",
      source_url: "",
      tech_stack: [],
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: (data: ProjectDB) => createProject(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/project/${data.id}`);
      toast.success(`Project "${data.name}" created successfully`);
    },
    onError: (error) => {
      console.error('Error creating project:', error);
      toast.error(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  const onSubmit = (data: ProjectFormValues) => {
    const projectData: ProjectDB = {
      name: data.name,
      description: data.description || "",
      requirements: data.requirements || "",
      source_type: formType === "existing" ? "github" : "",
      source_url: formType === "existing" ? data.source_url || "" : "",
      tech_stack: data.tech_stack || [],
      status: "planning",
      progress: 0
    };

    createProjectMutation.mutate(projectData);
  };

  const handleNewProject = () => {
    setFormType("new");
    setShowForm(true);
  };

  const handleImportProject = () => {
    setFormType("existing");
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    form.reset();
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header 
        onNewProject={handleNewProject} 
        onImportProject={handleImportProject} 
      />
      
      <main className="flex-1">
        {showForm ? (
          <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
            <h2 className="text-2xl font-bold mb-6">
              {formType === "new" ? "Create New Project" : "Import from GitHub"}
            </h2>
            
            <ProjectSetup
              isOpen={showForm}
              onClose={handleCancel}
              onCreateProject={(projectData) => {
                const newProjectData: ProjectDB = {
                  name: projectData.name,
                  description: projectData.description,
                  requirements: "",
                  source_type: projectData.mode === "existing" ? "github" : "",
                  source_url: projectData.repoUrl || "",
                  tech_stack: [
                    projectData.techStack.frontend,
                    projectData.techStack.backend,
                    projectData.techStack.database,
                    projectData.techStack.deployment
                  ],
                  status: "planning",
                  progress: 0
                };
                createProjectMutation.mutate(newProjectData);
              }}
            />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Projects</h1>
              <p className="text-gray-500">
                Manage your development projects with AI assistance
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <button
                onClick={handleNewProject}
                className="flex-1 bg-primary text-white px-6 py-3 rounded-lg shadow-sm hover:bg-primary/90 transition"
              >
                New Project
              </button>
              <button
                onClick={handleImportProject}
                className="flex-1 bg-white text-gray-800 px-6 py-3 rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition"
              >
                Import from GitHub
              </button>
            </div>
            
            <ProjectList projects={projects} isLoading={loadingProjects} />
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
