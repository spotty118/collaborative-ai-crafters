
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useGitHub } from '@/contexts/GitHubContext';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const GitHubConnectTester: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [filePath, setFilePath] = useState('test/hello.md');
  const [fileContent, setFileContent] = useState('# Hello from Agentic Development Platform\n\nThis is a test file created to verify GitHub integration.');
  const [commitMessage, setCommitMessage] = useState('test: Add test file');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const github = useGitHub();
  
  const handleConnect = async () => {
    if (!repoUrl || !token) {
      toast.error('Please enter GitHub repository URL and token');
      return;
    }
    
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      await github.connect(repoUrl, token);
      toast.success('Successfully connected to GitHub repository');
    } catch (error) {
      console.error('Failed to connect to GitHub:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`GitHub connection failed: ${message}`);
      toast.error('Failed to connect to GitHub: ' + message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTestWrite = async () => {
    if (!github.isConnected) {
      toast.error('Not connected to GitHub. Please connect first.');
      return;
    }
    
    if (!filePath || !fileContent || !commitMessage) {
      toast.error('Please fill all fields');
      return;
    }
    
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      await github.createOrUpdateFile(filePath, fileContent, commitMessage);
      toast.success(`Successfully wrote to ${filePath}`);
    } catch (error) {
      console.error('Failed to write to GitHub:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`GitHub write failed: ${message}`);
      toast.error('Failed to write to GitHub: ' + message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDisconnect = () => {
    github.disconnect();
    toast.info('Disconnected from GitHub');
  };

  return (
    <Card className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">GitHub Connection Test</h2>
      
      {errorMessage && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span>Connection Status:</span>
          <span 
            className={`px-2 py-1 rounded text-sm ${
              github.isConnected 
                ? 'bg-green-100 text-green-700' 
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {github.isConnected ? 'Connected' : 'Not Connected'}
          </span>
        </div>
        
        {!github.isConnected ? (
          <>
            <div className="space-y-2">
              <label htmlFor="repo-url" className="block text-sm font-medium">
                GitHub Repository URL
              </label>
              <Input
                id="repo-url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repository"
              />
              <p className="text-xs text-gray-500">
                Example: https://github.com/username/repository
              </p>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="github-token" className="block text-sm font-medium">
                GitHub Token
              </label>
              <Input
                id="github-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
              />
              <p className="text-xs text-gray-500">
                Generate a new token with "repo" scope at{" "}
                <a 
                  href="https://github.com/settings/tokens/new" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  GitHub Token Settings
                </a>
              </p>
            </div>
            
            <Button 
              onClick={handleConnect}
              disabled={isLoading || !repoUrl || !token}
              className="w-full"
            >
              {isLoading ? 'Connecting...' : 'Connect to GitHub'}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor="file-path" className="block text-sm font-medium">
                File Path
              </label>
              <Input
                id="file-path"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="e.g., docs/readme.md"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="file-content" className="block text-sm font-medium">
                File Content
              </label>
              <Textarea
                id="file-content"
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                rows={5}
                placeholder="Enter file content..."
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="commit-message" className="block text-sm font-medium">
                Commit Message
              </label>
              <Input
                id="commit-message"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="e.g., Add documentation"
              />
            </div>
            
            <div className="flex space-x-2">
              <Button 
                onClick={handleTestWrite}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Writing...' : 'Test Write'}
              </Button>
              
              <Button 
                onClick={handleDisconnect}
                variant="outline"
              >
                Disconnect
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default GitHubConnectTester;
