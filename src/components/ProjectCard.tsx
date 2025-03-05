
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface ProjectCardProps {
  project: {
    id: string | number;
    name: string;
    description?: string;
    status?: string;
    progress?: number;
    techStack?: {
      frontend?: string;
      backend?: string;
      database?: string;
      deployment?: string;
    };
    tech_stack?: string[];
    created_at?: string;
  };
  onClick?: () => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="truncate">{project.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {project.description || "No description provided"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {project.status && (
          <Badge className="mb-2" variant={project.status === 'active' ? 'default' : 'secondary'}>
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </Badge>
        )}
        
        {(project.tech_stack && project.tech_stack.length > 0) && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-1">Tech Stack:</p>
            <div className="flex flex-wrap gap-1">
              {project.tech_stack.map((tech, index) => (
                tech && <Badge key={index} variant="outline">{tech}</Badge>
              ))}
            </div>
          </div>
        )}
        
        {project.created_at && (
          <p className="text-xs text-muted-foreground mt-4">
            Created on {new Date(project.created_at).toLocaleDateString()}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          asChild 
          className="w-full" 
          size="sm"
          onClick={onClick}
        >
          <Link to={`/project/${project.id}`}>
            View Project <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};
