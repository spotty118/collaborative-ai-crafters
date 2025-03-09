
import { useState, useEffect } from 'react';
import { SDKService } from '@/services/openRouterSDK';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { openRouterClient } from '@/lib/openrouter-client';

interface UseOpenRouterSDKProps {
  redirectToSettingsIfNoApiKey?: boolean;
}

export function useOpenRouterSDK({ redirectToSettingsIfNoApiKey = true }: UseOpenRouterSDKProps = {}) {
  const [isApiKeySet, setIsApiKeySet] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [models, setModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = () => {
    setIsChecking(true);
    const apiKey = SDKService.getApiKey();
    const hasApiKey = !!apiKey;
    setIsApiKeySet(hasApiKey);
    
    if (!hasApiKey && redirectToSettingsIfNoApiKey) {
      toast.error('OpenRouter API key is not set. Please configure your settings.');
      navigate('/sdk/settings');
    } else if (hasApiKey) {
      // Set the API key for the client
      openRouterClient.setApiKey(apiKey);
      fetchModels();
    }
    
    setIsChecking(false);
    return hasApiKey;
  };
  
  const fetchModels = async () => {
    try {
      setIsLoadingModels(true);
      const fetchedModels = await openRouterClient.getModels();
      setModels(fetchedModels);
      setIsLoadingModels(false);
    } catch (error) {
      console.error('Error fetching models:', error);
      setIsLoadingModels(false);
    }
  };

  return {
    sdkService: SDKService,
    isApiKeySet,
    isChecking,
    checkApiKey,
    models,
    isLoadingModels,
    fetchModels
  };
}
