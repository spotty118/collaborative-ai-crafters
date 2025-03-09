
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useOpenRouterSDK } from '@/hooks/useOpenRouterSDK';
import OpenRouterSDKTester from '@/components/openrouter/OpenRouterSDKTester';
import { Settings, User, Check, AlertCircle, ExternalLink } from 'lucide-react';

const DashboardHomeView: React.FC = () => {
  const navigate = useNavigate();
  const { isApiKeySet, isChecking } = useOpenRouterSDK({ redirectToSettingsIfNoApiKey: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">OpenRouter SDK Dashboard</h1>
      
      {!isApiKeySet && !isChecking && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5 mr-2" />
              <div>
                <h3 className="font-medium text-orange-800">API Key Required</h3>
                <p className="text-sm text-orange-700 mt-1">
                  You need to configure your OpenRouter API key before using the SDK features.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2 bg-white hover:bg-white"
                  onClick={() => navigate('/sdk/settings')}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Configure Settings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {isApiKeySet && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-start">
              <Check className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
              <div>
                <h3 className="font-medium text-green-800">SDK Connected</h3>
                <p className="text-sm text-green-700 mt-1">
                  Your OpenRouter API key is configured and the SDK is ready to use.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and actions for managing your SDK
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Button 
              variant="outline" 
              className="justify-start" 
              onClick={() => navigate('/sdk/agents')}
            >
              <User className="mr-2 h-4 w-4" />
              Manage Agents
            </Button>
            
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => navigate('/sdk/settings')}
            >
              <Settings className="mr-2 h-4 w-4" />
              Configure Settings
            </Button>
            
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => window.open('https://openrouter.ai/docs', '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Documentation
            </Button>
          </CardContent>
        </Card>
        
        {isApiKeySet && (
          <OpenRouterSDKTester />
        )}
      </div>
    </div>
  );
};

export default DashboardHomeView;
