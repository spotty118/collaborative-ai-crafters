
import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getProject, getAgents, getTasks, getCodeFiles } from "@/lib/api";
import Header from "@/components/layout/Header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Dashboard from "@/components/layout/Dashboard";

const Project = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  
  const { 
    data: project,
    isLoading: loadingProject,
    error: projectError 
  } = useQuery({
    queryKey: ['project', id],
    queryFn: () => id ? getProject(id) : Promise.resolve(null),
    enabled: !!id
  });

  const { 
    data: agents = [], 
    isLoading: loadingAgents 
  } = useQuery({
    queryKey: ['agents', id],
    queryFn: () => id ? getAgents(id) : Promise.resolve([]),
    enabled: !!id
  });

  const { 
    data: tasks = [], 
    isLoading: loadingTasks 
  } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => id ? getTasks(id) : Promise.resolve([]),
    enabled: !!id
  });

  const { 
    data: files = [], 
    isLoading: loadingFiles 
  } = useQuery({
    queryKey: ['files', id],
    queryFn: () => id ? getCodeFiles(id) : Promise.resolve([]),
    enabled: !!id && activeTab === "code"
  });

  if (!id || loadingProject || projectError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 border-4 border-t-primary rounded-full animate-spin mb-4"></div>
          <p>{projectError ? "Error loading project" : "Loading project..."}</p>
          {projectError && (
            <button 
              className="mt-4 px-4 py-2 bg-primary text-white rounded" 
              onClick={() => navigate("/")}
            >
              Back to Projects
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Project Not Found</h2>
          <p className="mb-4">The project you're looking for doesn't exist.</p>
          <button 
            className="px-4 py-2 bg-primary text-white rounded" 
            onClick={() => navigate("/")}
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header
        onNewProject={() => navigate("/")}
        onImportProject={() => navigate("/")}
      />
      
      <div className="bg-white border-b px-4 py-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="code">Code Files</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <TabsContent value="dashboard" className="flex-1 mt-0" defaultChecked={activeTab === "dashboard"}>
        <Dashboard
          agents={agents}
          tasks={tasks}
          messages={[]}
          activeChat={null}
          onStartAgent={() => {}}
          onStopAgent={() => {}}
          onChatWithAgent={() => {}}
          onSendMessage={() => {}}
          project={{
            name: project.name,
            description: project.description,
            mode: project.source_type ? 'existing' : 'new'
          }}
          isLoading={{
            agents: loadingAgents,
            tasks: loadingTasks,
            messages: false
          }}
        />
      </TabsContent>

      <TabsContent value="code" className="flex-1 p-4" defaultChecked={activeTab === "code"}>
        <div className="bg-white rounded-lg border h-full">
          <div className="border-b px-4 py-3 flex justify-between items-center">
            <h2 className="font-semibold">Code Files</h2>
          </div>
          
          {loadingFiles ? (
            <div className="flex items-center justify-center h-64">
              <div className="h-8 w-8 border-4 border-t-primary rounded-full animate-spin"></div>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6">
              <p className="text-gray-500 mb-4">No code files have been generated yet.</p>
              <p className="text-sm text-gray-400">Files will appear here as the agents generate code.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4 p-4">
              {files.map(file => (
                <div key={file.id} className="border rounded-md p-3 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{file.name}</h3>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">{file.language || 'Unknown'}</span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">{file.path}</p>
                  <div className="mt-2 text-xs text-gray-500">
                    Created by: {file.created_by}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="settings" className="flex-1 p-4" defaultChecked={activeTab === "settings"}>
        <div className="bg-white rounded-lg border p-6 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold mb-6">Project Settings</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-medium mb-2">Project Information</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <span className="font-medium w-32">Name:</span>
                  <span>{project.name}</span>
                </div>
                <div className="flex items-start">
                  <span className="font-medium w-32">Description:</span>
                  <span>{project.description || 'No description'}</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium w-32">Status:</span>
                  <span className="capitalize">{project.status}</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium w-32">Progress:</span>
                  <span>{project.progress}%</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-base font-medium mb-2">Tech Stack</h3>
              <div className="flex flex-wrap gap-2">
                {project.tech_stack?.map((tech, index) => (
                  <span key={index} className="px-2 py-1 bg-gray-100 rounded text-sm">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
            
            {project.source_type && (
              <div>
                <h3 className="text-base font-medium mb-2">Source Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="font-medium w-32">Type:</span>
                    <span className="capitalize">{project.source_type}</span>
                  </div>
                  {project.source_url && (
                    <div className="flex items-center">
                      <span className="font-medium w-32">URL:</span>
                      <a 
                        href={project.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate max-w-md"
                      >
                        {project.source_url}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </TabsContent>
    </div>
  );
};

export default Project;
