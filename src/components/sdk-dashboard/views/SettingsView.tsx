
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SDKService } from '@/services/openRouterSDK';
import { toast } from 'sonner';
import { Key, Check, AlertCircle } from 'lucide-react';

const SettingsView: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('anthropic/claude-3-5-sonnet');
  const [isSaving, setIsSaving] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'unchecked' | 'valid' | 'invalid'>('unchecked');
  
  useEffect(() => {
    // Load existing settings if available
    const storedApiKey = SDKService.getApiKey();
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setKeyStatus('valid');
    }
    
    const storedModel = localStorage.getItem('OPENROUTER_DEFAULT_MODEL');
    if (storedModel) {
      setDefaultModel(storedModel);
    }
  }, []);
  
  const handleSaveSettings = () => {
    try {
      setIsSaving(true);
      
      if (!apiKey.trim()) {
        toast.error('API key is required');
        return;
      }
      
      // Set the API key in the service
      const success = SDKService.setApiKey(apiKey);
      
      if (success) {
        // Store default model
        localStorage.setItem('OPENROUTER_DEFAULT_MODEL', defaultModel);
        
        toast.success('Settings saved successfully');
        setKeyStatus('valid');
      } else {
        toast.error('Failed to save API key');
        setKeyStatus('invalid');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('An error occurred while saving settings');
      setKeyStatus('invalid');
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>
            Configure your OpenRouter API settings for the SDK
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="api-key">
              OpenRouter API Key
            </label>
            <div className="flex">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type="password"
                  placeholder="sk-or-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  {keyStatus === 'valid' && <Check className="h-4 w-4 text-green-500" />}
                  {keyStatus === 'invalid' && <AlertCircle className="h-4 w-4 text-red-500" />}
                  {keyStatus === 'unchecked' && <Key className="h-4 w-4 text-gray-400" />}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Your OpenRouter API key is stored securely in your browser's local storage.
              Get your key from <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">openrouter.ai/keys</a>.
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Default Model
            </label>
            <Select value={defaultModel} onValueChange={setDefaultModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic/claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                <SelectItem value="anthropic/claude-3-opus">Claude 3 Opus</SelectItem>
                <SelectItem value="openai/gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="openai/gpt-4o-mini">GPT-4o Mini</SelectItem>
                <SelectItem value="google/gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            className="w-full sm:w-auto mt-4" 
            onClick={handleSaveSettings}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Usage & Documentation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            The OpenRouter SDK provides a unified interface to access multiple AI models through a single API.
          </p>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">Documentation</h3>
              <p className="text-sm text-gray-500">
                View the complete documentation for the OpenRouter SDK.
              </p>
              <Button variant="outline" className="mt-2">
                <a href="https://openrouter.ai/docs" target="_blank" rel="noreferrer">
                  View Documentation
                </a>
              </Button>
            </div>
            <div>
              <h3 className="font-medium">SDK Status</h3>
              <div className="flex items-center mt-2">
                <div className={`w-3 h-3 rounded-full mr-2 ${keyStatus === 'valid' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-sm">{keyStatus === 'valid' ? 'Connected' : 'Not Connected'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsView;
