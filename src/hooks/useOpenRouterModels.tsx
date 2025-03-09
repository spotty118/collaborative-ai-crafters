
import { useState, useEffect } from 'react';
import { openRouterClient } from '@/lib/openrouter-client';
import { toast } from 'sonner';

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: number;
    completion: number;
  };
  features?: string[];
}

export function useOpenRouterModels() {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchModels = async () => {
    if (!openRouterClient.hasApiKey()) {
      setError('OpenRouter API key is not set');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      const modelData = await openRouterClient.getModels();
      setModels(modelData || []);
    } catch (err: any) {
      console.error('Error fetching models:', err);
      setError(err.message || 'Failed to fetch models');
      toast.error('Failed to fetch OpenRouter models');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (openRouterClient.hasApiKey()) {
      fetchModels();
    }
  }, []);
  
  return {
    models,
    isLoading,
    error,
    fetchModels,
    hasApiKey: openRouterClient.hasApiKey()
  };
}
