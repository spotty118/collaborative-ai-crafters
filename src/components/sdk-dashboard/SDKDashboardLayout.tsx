
import React from 'react';
import { Monitor, User, CheckSquare, GitBranch, Database, Code, Settings, Beaker } from 'lucide-react';

interface SDKDashboardLayoutProps {
  children: React.ReactNode;
  activeView: string;
  onChangeView: (view: string) => void;
}

const SDKDashboardLayout: React.FC<SDKDashboardLayoutProps> = ({ 
  children, 
  activeView, 
  onChangeView 
}) => {
  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <Monitor size={18} /> },
    { id: 'agents', name: 'Agents', icon: <User size={18} /> },
    { id: 'tasks', name: 'Tasks', icon: <CheckSquare size={18} /> },
    { id: 'workflows', name: 'Workflows', icon: <GitBranch size={18} /> },
    { id: 'knowledge', name: 'Knowledge Bases', icon: <Database size={18} /> },
    { id: 'functions', name: 'Functions', icon: <Code size={18} /> },
    { id: 'tester', name: 'SDK Tester', icon: <Beaker size={18} /> },
    { id: 'settings', name: 'Settings', icon: <Settings size={18} /> },
  ];

  return (
    <div className="flex h-screen w-full">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-blue-900 text-white z-10 flex items-center px-6 shadow-md">
        <h1 className="text-xl font-bold">OpenRouter SDK Dashboard</h1>
      </div>

      {/* Sidebar */}
      <div className="fixed top-14 left-0 bottom-0 w-64 bg-white shadow-md z-10">
        <div className="mt-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`flex items-center px-6 py-3 w-full text-left ${
                activeView === item.id 
                  ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="mr-3">{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 mt-14 flex-1 p-6 overflow-auto">
        {children}
      </div>
    </div>
  );
};

export default SDKDashboardLayout;
