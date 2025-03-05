
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useGitHub } from '@/contexts/GitHubContext';
import { toast } from 'sonner';

export const GitHubWriteTester: React.FC = () => {
  const [filePath, setFilePath] = useState('test/file.txt');
  const [fileContent, setFileContent] = useState('Test content');
  const [commitMessage, setCommitMessage] = useState('Test commit');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const github = useGitHub();
  
  const handleWriteToGitHub = async () => {
    if (!github.isConnected) {
      toast.error('Not connected to GitHub. Please connect first.');
      setStatus('error');
      setErrorMessage('Not connected to GitHub');
      return;
    }
    
    if (!filePath || !fileContent || !commitMessage) {
      toast.error('Please fill all fields');
      return;
    }
    
    setIsLoading(true);
    setStatus('idle');
    setErrorMessage('');
    
    try {
      console.log(`Writing to ${filePath} with message: ${commitMessage}`);
      await github.createOrUpdateFile(filePath, fileContent, commitMessage);
      
      setStatus('success');
      toast.success(`Successfully wrote to ${filePath}`);
    } catch (error) {
      console.error('Failed to write to GitHub:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
      toast.error('Failed to write to GitHub: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">GitHub Write Test</h2>
      
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
        
        <Button 
          onClick={handleWriteToGitHub}
          disabled={isLoading || !github.isConnected}
          className="w-full"
        >
          {isLoading ? 'Writing...' : 'Write to GitHub'}
        </Button>
        
        {status === 'success' && (
          <div className="p-3 bg-green-50 text-green-700 rounded-md">
            Successfully wrote to {filePath}
          </div>
        )}
        
        {status === 'error' && (
          <div className="p-3 bg-red-50 text-red-700 rounded-md">
            Error: {errorMessage}
          </div>
        )}
      </div>
    </Card>
  );
};

export default GitHubWriteTester;
