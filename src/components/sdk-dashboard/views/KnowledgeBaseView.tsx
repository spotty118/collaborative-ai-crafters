
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Database, Search, X } from 'lucide-react';
import { SDKService } from '@/services/openRouterSDK';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const KnowledgeBaseView: React.FC = () => {
  const [knowledgeBases, setKnowledgeBases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddDocumentDialogOpen, setIsAddDocumentDialogOpen] = useState(false);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [newKbName, setNewKbName] = useState('');
  const [newKbDescription, setNewKbDescription] = useState('');
  const [currentKbId, setCurrentKbId] = useState<string | null>(null);
  const [documentText, setDocumentText] = useState('');
  const [documentMetadata, setDocumentMetadata] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

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

  const handleCreateKnowledgeBase = async () => {
    if (!newKbName.trim()) {
      toast.error('Please enter a name for the knowledge base');
      return;
    }

    try {
      const newKb = await SDKService.createKnowledgeBase({
        name: newKbName.trim(),
        description: newKbDescription.trim(),
      });
      
      setKnowledgeBases(prev => [...prev, newKb]);
      setIsCreateDialogOpen(false);
      setNewKbName('');
      setNewKbDescription('');
      toast.success(`Knowledge base "${newKb.name}" created successfully`);
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      toast.error('Failed to create knowledge base');
    }
  };

  const handleAddDocument = async () => {
    if (!documentText.trim() || !currentKbId) {
      toast.error('Please enter document text');
      return;
    }

    try {
      let metadata = {};
      
      if (documentMetadata.trim()) {
        try {
          metadata = JSON.parse(documentMetadata);
        } catch (e) {
          toast.error('Invalid JSON metadata. Using empty metadata instead.');
        }
      }

      await SDKService.addDocument(currentKbId, {
        text: documentText.trim(),
        metadata
      });
      
      // Update the document count in the KB list
      setKnowledgeBases(prevKbs => 
        prevKbs.map(kb => 
          kb.id === currentKbId 
            ? {...kb, documents_count: kb.documents_count + 1} 
            : kb
        )
      );
      
      setIsAddDocumentDialogOpen(false);
      setDocumentText('');
      setDocumentMetadata('');
      setCurrentKbId(null);
      toast.success('Document added successfully');
    } catch (error) {
      console.error('Error adding document:', error);
      toast.error('Failed to add document');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentKbId) {
      toast.error('Please enter a search query');
      return;
    }

    try {
      setSearching(true);
      const results = await SDKService.searchDocuments(currentKbId, searchQuery.trim());
      setSearchResults(results);
      
      if (results.length === 0) {
        toast.info('No results found');
      }
    } catch (error) {
      console.error('Error searching documents:', error);
      toast.error('Failed to search documents');
    } finally {
      setSearching(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const openAddDocumentDialog = (kbId: string) => {
    setCurrentKbId(kbId);
    setIsAddDocumentDialogOpen(true);
  };

  const openSearchDialog = (kbId: string) => {
    setCurrentKbId(kbId);
    setSearchResults([]);
    setSearchQuery('');
    setIsSearchDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Knowledge Bases</h1>
        <Button className="flex items-center" onClick={() => setIsCreateDialogOpen(true)}>
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
          <Button onClick={() => setIsCreateDialogOpen(true)}>
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
                <Button 
                  size="sm" 
                  className="flex items-center"
                  onClick={() => openSearchDialog(kb.id)}
                >
                  <Search size={14} className="mr-1" />
                  Search
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center"
                  onClick={() => openAddDocumentDialog(kb.id)}
                >
                  <Plus size={14} className="mr-1" />
                  Add Documents
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Knowledge Base Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Knowledge Base</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Knowledge Base Name"
                value={newKbName}
                onChange={(e) => setNewKbName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Enter a description for your knowledge base"
                value={newKbDescription}
                onChange={(e) => setNewKbDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateKnowledgeBase}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Document Dialog */}
      <Dialog open={isAddDocumentDialogOpen} onOpenChange={setIsAddDocumentDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="documentText">Document Text</Label>
              <Textarea
                id="documentText"
                placeholder="Enter the document text"
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                rows={6}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="metadata">Metadata (Optional JSON)</Label>
              <Textarea
                id="metadata"
                placeholder='{"source": "example", "category": "documentation"}'
                value={documentMetadata}
                onChange={(e) => setDocumentMetadata(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-gray-500">Enter valid JSON metadata for this document (optional)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDocumentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDocument}>Add Document</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search Dialog */}
      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Search Knowledge Base</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter search query"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={searching}>
                {searching ? (
                  <>Searching...</>
                ) : (
                  <>
                    <Search size={16} className="mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
            
            {searchResults.length > 0 && (
              <div className="border rounded-md p-4 max-h-[300px] overflow-y-auto">
                <h3 className="font-medium mb-2">Results</h3>
                <div className="space-y-3">
                  {searchResults.map((result, index) => (
                    <div key={index} className="border-b pb-2 last:border-b-0">
                      <p className="text-sm">
                        {result.text || result.content || 'No text content'}
                      </p>
                      {result.score && (
                        <p className="text-xs text-gray-500 mt-1">
                          Relevance: {(result.score * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSearchDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KnowledgeBaseView;
