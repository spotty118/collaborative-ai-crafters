
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useGitHub } from '@/contexts/GitHubContext';
import { Loader2, CheckCircle, XCircle, GithubIcon } from 'lucide-react';
import { toast } from 'sonner';
import { isGitHubServiceInitialized } from '@/lib/services/GitHubService';

export const GitHubTester: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testDetails, setTestDetails] = useState<string>('');
  const github = useGitHub();

  const runGitHubTest = async () => {
    if (!github.isConnected) {
      toast.error('GitHub is not connected. Please configure GitHub access in project settings.');
      return;
    }

    // Double-check that the service is initialized
    if (!isGitHubServiceInitialized()) {
      toast.error('GitHub service is not properly initialized. Please reconnect in project settings.');
      setTestResult('error');
      setTestDetails('GitHub service is not properly initialized. Try reconnecting in the project settings.');
      return;
    }

    setIsLoading(true);
    setTestResult(null);
    setTestDetails('');

    try {
      // Generate a timestamp to make each test unique
      const timestamp = new Date().toISOString();
      const testContent = `# GitHub Integration Test\n\nThis file was created by the GitHub integration test on ${timestamp}.\n\nIf you're seeing this file in your repository, the test was successful!`;
      const testFilePath = `test/github-test-${Date.now()}.md`;
      
      // Log details to help with debugging
      console.log(`Running GitHub push test with the following parameters:`);
      console.log(`- Repository Branch: ${github.currentBranch}`);
      console.log(`- Test File Path: ${testFilePath}`);
      
      // Try to create the test file
      await github.createOrUpdateFile(
        testFilePath, 
        testContent,
        `test: Verify GitHub integration on ${timestamp}`
      );
      
      setTestResult('success');
      setTestDetails(`Successfully pushed test file to ${testFilePath} on branch ${github.currentBranch}.`);
      toast.success('GitHub test successful! Test file was pushed to your repository.');
    } catch (error) {
      console.error('GitHub test failed:', error);
      setTestResult('error');
      setTestDetails(error instanceof Error ? error.message : 'Unknown error occurred');
      toast.error(`GitHub test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GithubIcon className="h-5 w-5" />
          GitHub Integration Test
        </CardTitle>
        <CardDescription>
          Test if the application can successfully push changes to your GitHub repository.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 border rounded-md bg-gray-50">
            <p className="text-sm">
              This test will create a simple markdown file in your repository to verify that the GitHub integration is working correctly.
            </p>
          </div>

          {testResult && (
            <div className={`p-4 border rounded-md ${testResult === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start gap-2">
                {testResult === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                )}
                <div>
                  <h3 className={`font-medium ${testResult === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                    {testResult === 'success' ? 'Test Succeeded' : 'Test Failed'}
                  </h3>
                  <p className="text-sm mt-1">
                    {testDetails}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={runGitHubTest}
          disabled={isLoading || !github.isConnected}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Test...
            </>
          ) : (
            'Run GitHub Push Test'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default GitHubTester;
