import React, { useState } from 'react';
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
  const github = useGitHub();

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setContent(file.content || '');
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!github.isConnected) {
      toast.error('GitHub connection not configured');
      return;
    }

    try {
      setIsSaving(true);
      await github.createOrUpdateFile(
        file.path,
        content,
        `Update ${file.path}`
      );
      setIsEditing(false);
      toast.success('File saved successfully');
    } catch (error) {
      toast.error('Failed to save file: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
            <Button
              size="sm"
              onClick={handleEdit}
            >
              Edit
            </Button>
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
          <pre className="font-mono text-sm whitespace-pre-wrap">
            {content}
          </pre>
        )}
      </div>
    </Card>
  );
};