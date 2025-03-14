
import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import SDKDashboardLayout from '@/components/sdk-dashboard/SDKDashboardLayout';
import AgentsView from '@/components/sdk-dashboard/views/AgentsView';
import TasksView from '@/components/sdk-dashboard/views/TasksView';
import WorkflowsView from '@/components/sdk-dashboard/views/WorkflowsView';
import KnowledgeBaseView from '@/components/sdk-dashboard/views/KnowledgeBaseView';
import FunctionsView from '@/components/sdk-dashboard/views/FunctionsView';
import SettingsView from '@/components/sdk-dashboard/views/SettingsView';
import DashboardHomeView from '@/components/sdk-dashboard/views/DashboardHomeView';
import OpenRouterSDKTester from '@/components/openrouter/OpenRouterSDKTester';
import { useOpenRouterSDK } from '@/hooks/useOpenRouterSDK';

const SDKDashboard: React.FC = () => {
  const { view } = useParams<{ view?: string }>();
  const location = useLocation();
  const [activeView, setActiveView] = useState<string>('dashboard');
  const navigate = useNavigate();
  
  useEffect(() => {
    // Initialize with the view from URL params or from the path for backward compatibility
    if (view) {
      setActiveView(view);
    } else if (location.pathname === '/sdk-dashboard') {
      setActiveView('dashboard');
    }
  }, [view, location.pathname]);

  const { isApiKeySet, isChecking } = useOpenRouterSDK({ 
    redirectToSettingsIfNoApiKey: activeView !== 'settings' 
  });

  const handleViewChange = (newView: string) => {
    setActiveView(newView);
    navigate(`/sdk/${newView}`);
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardHomeView />;
      case 'agents':
        return <AgentsView />;
      case 'tasks':
        return <TasksView />;
      case 'workflows':
        return <WorkflowsView />;
      case 'knowledge':
        return <KnowledgeBaseView />;
      case 'functions':
        return <FunctionsView />;
      case 'settings':
        return <SettingsView />;
      case 'tester':
        return <OpenRouterSDKTester />;
      default:
        return <DashboardHomeView />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <SDKDashboardLayout activeView={activeView} onChangeView={handleViewChange}>
        {renderActiveView()}
      </SDKDashboardLayout>
    </div>
  );
};

export default SDKDashboard;
