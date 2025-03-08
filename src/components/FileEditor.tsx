
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useGitHub } from '@/contexts/GitHubContext';
import { toast } from 'sonner';

interface FileEditorProps {
  file: {
    id: string;
    name: string;
    path: string;
    content?: string;
    language?: string;
    created_by: string;
  };
  onClose?: () => void;
}

export const FileEditor: React.FC<FileEditorProps> = ({ file, onClose }) => {
  const [content, setContent] = useState(file.content || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState(file.content || '');
  const github = useGitHub();

  useEffect(() => {
    // Update content if file prop changes
    setContent(file.content || '');
    setLastSavedContent(file.content || '');
  }, [file.content, file.id]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setContent(lastSavedContent);
    setIsEditing(false);
  };

  const verifyContent = async (path: string, expectedContent: string): Promise<boolean> => {
    try {
      if (!github.isConnected) {
        return false;
      }
      
      const savedContent = await github.getFileContent(path);
      if (savedContent !== expectedContent) {
        console.warn('GitHub content verification failed - content mismatch');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Failed to verify saved file:', error);
      return false;
    }
  };

  const handleSave = async () => {
    if (!github.isConnected) {
      toast.error('GitHub connection not configured. Changes will be saved locally only.');
      // Still update the local content
      file.content = content;
      setLastSavedContent(content);
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      console.log(`Saving file: ${file.path}`);
      
      await github.createOrUpdateFile(
        file.path,
        content,
        `Update ${file.path}`
      );
      
      // Update local state
      file.content = content;
      setLastSavedContent(content);
      
      setIsEditing(false);
      toast.success('File saved successfully to GitHub');
      
      // Verify the file was saved
      const verified = await verifyContent(file.path, content);
      if (!verified) {
        toast.warning('File saved but content verification failed');
      } else {
        console.log('GitHub content verification successful');
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      toast.error('Failed to save file: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePushToGitHub = async () => {
    if (!github.isConnected) {
      toast.error('GitHub connection not configured');
      return;
    }

    try {
      setIsSaving(true);
      console.log(`Explicitly pushing file to GitHub: ${file.path}`);
      
      await github.createOrUpdateFile(
        file.path,
        content,
        `Explicit push: ${file.path}`
      );
      
      setLastSavedContent(content);
      toast.success('File pushed to GitHub successfully');
      
      // Verify the push
      const verified = await verifyContent(file.path, content);
      if (!verified) {
        toast.warning('File pushed but content verification failed');
      }
    } catch (error) {
      console.error('Failed to push file to GitHub:', error);
      toast.error('Failed to push to GitHub: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="w-full h-full flex flex-col">
      <div className="border-b px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <h3 className="font-medium">{file.name}</h3>
          {file.language && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
              {file.language}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={handleEdit}
              >
                Edit
              </Button>
              {github.isConnected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePushToGitHub}
                  disabled={isSaving}
                >
                  Push to GitHub
                </Button>
              )}
            </>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 p-4">
        {isEditing ? (
          <textarea
            className="w-full h-full min-h-[300px] font-mono text-sm p-2 border rounded"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isSaving}
          />
        ) : (
          <pre className="font-mono text-sm whitespace-pre-wrap overflow-auto">
            {content}
          </pre>
        )}
      </div>
    </Card>
  );
};
