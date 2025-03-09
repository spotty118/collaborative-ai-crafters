
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Database, Search } from 'lucide-react';
import { SDKService } from '@/services/openRouterSDK';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const KnowledgeBaseView: React.FC = () => {
  const [knowledgeBases, setKnowledgeBases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadKnowledgeBases = async () => {
      try {
        setLoading(true);
        const data = await SDKService.getKnowledgeBases();
        setKnowledgeBases(data);
      } catch (error) {
        console.error('Error loading knowledge bases:', error);
        toast.error('Failed to load knowledge bases');
      } finally {
        setLoading(false);
      }
    };
    
    loadKnowledgeBases();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Knowledge Bases</h1>
        <Button className="flex items-center">
          <Plus size={16} className="mr-2" />
          New Knowledge Base
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Card key={i} className="p-6">
              <div className="space-y-4">
                <div className="flex items-center">
                  <Skeleton className="h-6 w-6 mr-2" />
                  <Skeleton className="h-6 w-32" />
                </div>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-40" />
                <div className="flex space-x-2 pt-2">
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-32" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : knowledgeBases.length === 0 ? (
        <Card className="p-8 text-center">
          <Database size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">No knowledge bases available</h3>
          <p className="text-gray-500 mb-6">Create a knowledge base to store and retrieve information</p>
          <Button>
            <Plus size={16} className="mr-2" />
            Create First Knowledge Base
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {knowledgeBases.map(kb => (
            <Card key={kb.id} className="p-6 border border-gray-200">
              <div className="flex items-center mb-4">
                <Database size={20} className="text-blue-600 mr-2" />
                <h3 className="text-lg font-bold text-gray-800">{kb.name}</h3>
              </div>
              <p className="text-sm text-gray-600 mb-1">{kb.description}</p>
              <p className="text-sm text-gray-600 mb-1">Documents: {kb.documents_count}</p>
              <p className="text-sm text-gray-600 mb-4">Created: {formatDate(kb.created_at)}</p>
              <div className="flex space-x-2">
                <Button size="sm" className="flex items-center">
                  <Search size={14} className="mr-1" />
                  Search
                </Button>
                <Button variant="outline" size="sm" className="flex items-center">
                  <Plus size={14} className="mr-1" />
                  Add Documents
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgeBaseView;
