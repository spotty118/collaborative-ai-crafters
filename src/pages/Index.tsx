
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/layout/Header';
import GitHubConnectTester from '@/components/GitHubConnectTester';
import OpenRouterTester from '@/components/agents/OpenRouterTester';
import { Monitor } from 'lucide-react';

const Index: React.FC = () => {
  // Add empty handlers for required props
  const handleNewProject = () => {
    // This would typically open a new project dialog
    console.log('New project handler triggered');
  };
  
  const handleImportProject = () => {
    // This would typically open an import project dialog
    console.log('Import project handler triggered');
  };

  return (
    <>
      <Header 
        onNewProject={handleNewProject} 
        onImportProject={handleImportProject}
      />
      <div className="container mx-auto p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-2">OpenRouter SDK Platform</h1>
            <p className="text-xl text-gray-700 mb-8">
              Build, manage, and deploy AI agents for your projects
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>Agent Projects</CardTitle>
                  <CardDescription>Create and manage AI agent-powered projects</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Build applications using AI agents that work together to achieve complex tasks.</p>
                </CardContent>
                <CardFooter>
                  <Link to="/project/demo">
                    <Button>Create Project</Button>
                  </Link>
                </CardFooter>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>SDK Dashboard</CardTitle>
                  <CardDescription>Manage the OpenRouter SDK</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <p>Configure and monitor your OpenRouter SDK integration.</p>
                  <Monitor className="h-8 w-8 text-blue-500" />
                </CardContent>
                <CardFooter>
                  <Link to="/sdk-dashboard">
                    <Button variant="outline">Open Dashboard</Button>
                  </Link>
                </CardFooter>
              </Card>
            </div>
          </div>
          
          <div className="md:w-1/3">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>GitHub Connection</CardTitle>
              </CardHeader>
              <CardContent>
                <GitHubConnectTester />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>OpenRouter Connection</CardTitle>
              </CardHeader>
              <CardContent>
                <OpenRouterTester />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default Index;
