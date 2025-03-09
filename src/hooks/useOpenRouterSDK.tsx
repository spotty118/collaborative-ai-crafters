
import { useState, useEffect } from 'react';
import { SDKService } from '@/services/openRouterSDK';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface UseOpenRouterSDKProps {
  redirectToSettingsIfNoApiKey?: boolean;
}

export function useOpenRouterSDK({ redirectToSettingsIfNoApiKey = true }: UseOpenRouterSDKProps = {}) {
  const [isApiKeySet, setIsApiKeySet] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
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
    }
    
    setIsChecking(false);
    return hasApiKey;
  };

  return {
    sdkService: SDKService,
    isApiKeySet,
    isChecking,
    checkApiKey
  };
}
