
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useGitHub } from '@/contexts/GitHubContext';
import { toast } from 'sonner';
import { Loader2, Save, X, Edit, Check, AlertTriangle } from 'lucide-react';

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
  onSave?: (path: string, content: string) => void;
}

export const FileEditor: React.FC<FileEditorProps> = ({ file, onClose, onSave }) => {
  const [content, setContent] = useState(file.content || '');
  const [originalContent, setOriginalContent] = useState(file.content || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const github = useGitHub();

  useEffect(() => {
    setContent(file.content || '');
    setOriginalContent(file.content || '');
  }, [file.content, file.path]);

  useEffect(() => {
    setHasChanges(content !== originalContent);
  }, [content, originalContent]);

  const handleEdit = () => {
    setIsEditing(true);
    setErrorMessage(null);
  };

  const handleCancel = () => {
    setContent(originalContent);
    setIsEditing(false);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (!github.isConnected) {
      setErrorMessage('GitHub connection not configured');
      toast.error('GitHub connection not configured');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      console.log(`Saving file: ${file.path}`);
      
      await github.createOrUpdateFile(
        file.path,
        content,
        `Update ${file.path}`
      );
      
      // Update local state
      setOriginalContent(content);
      
      setIsEditing(false);
      toast.success('File saved successfully');
      
      // Notify parent component if onSave callback is provided
      if (onSave) {
        onSave(file.path, content);
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Failed to save: ${errorMsg}`);
      toast.error('Failed to save file: ' + errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="w-full h-full flex flex-col">
      <div className="border-b px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <h3 className="font-medium truncate max-w-[200px]">{file.name}</h3>
          {file.language && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
              {file.language}
            </span>
          )}
          {hasChanges && !isEditing && (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded flex items-center">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Unsaved
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
                className="flex items-center"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="flex items-center"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={handleEdit}
              className="flex items-center"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="flex items-center"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {errorMessage && (
        <div className="bg-red-50 text-red-700 p-3 text-sm flex items-start border-b">
          <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      <div className="flex-1 p-4 overflow-auto">
        {isEditing ? (
          <textarea
            className="w-full h-full min-h-[300px] font-mono text-sm p-2 border rounded resize-none"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isSaving}
            spellCheck={false}
          />
        ) : (
          <pre className="font-mono text-sm whitespace-pre-wrap overflow-auto max-h-[calc(100vh-200px)] p-2">
            {content}
          </pre>
        )}
      </div>
      <div className="border-t px-4 py-2 text-xs text-gray-500">
        <span className="block">Path: {file.path}</span>
        <span className="block">Created by: {file.created_by}</span>
      </div>
    </Card>
  );
};
