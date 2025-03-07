
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Project from "./pages/Project";
import ExternalCrewAI from "./pages/ExternalCrewAI";
import { GitHubProvider } from "./contexts/GitHubContext";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GitHubProvider>
        <Toaster />
        <Sonner position="top-right" />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/project/:id" element={<Project />} />
            <Route path="/external-crewai" element={<ExternalCrewAI />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </GitHubProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
