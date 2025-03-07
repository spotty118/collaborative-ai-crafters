
/**
 * LLM Service
 * 
 * Handles interaction with the Large Language Model API.
 * Supports multiple providers (OpenAI, Anthropic, etc.)
 */
import { supabase } from "@/integrations/supabase/client";

export type LLMProvider = 'openai' | 'anthropic';

export interface LLMConfig {
  apiKey?: string;
  model?: string;
  provider?: LLMProvider;
  timeout?: number;
  maxRetries?: number;
}

export interface LLMRequestOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  model?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type LLMPrompt = string | Message[] | { messages: Message[], system?: string };

class LLMService {
  private apiKey: string;
  private model: string;
  private provider: LLMProvider;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(config: LLMConfig = {}) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-4o';
    this.provider = config.provider || 'openai';
    this.baseUrl = this._getBaseUrl(this.provider);
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
  }

  /**
   * Get the base URL for the chosen provider
   */
  private _getBaseUrl(provider: LLMProvider): string {
    switch (provider) {
      case 'anthropic':
        return 'https://api.anthropic.com/v1';
      case 'openai':
      default:
        return 'https://api.openai.com/v1';
    }
  }

  /**
   * Generate a completion from the LLM
   */
  async generateCompletion(prompt: LLMPrompt, options: LLMRequestOptions = {}): Promise<string> {
    // For Supabase edge function implementation
    try {
      const { data, error } = await supabase.functions.invoke('agent-llm', {
        body: { 
          type: 'completion', 
          prompt: this._formatPromptForEdgeFunction(prompt),
          options
        },
      });

      if (error) {
        console.error('Error calling agent-llm function:', error);
        throw new Error(`LLM function error: ${error.message}`);
      }

      return data.completion;
    } catch (error) {
      console.error('Error generating completion:', error);
      throw error;
    }
  }

  /**
   * Format the prompt for the edge function
   */
  private _formatPromptForEdgeFunction(prompt: LLMPrompt): any {
    if (typeof prompt === 'string') {
      return { messages: [{ role: 'user', content: prompt }] };
    }
    
    if (Array.isArray(prompt)) {
      return { messages: prompt };
    }
    
    return prompt;
  }

  /**
   * Direct API implementation (used when not using edge functions)
   */
  async generateCompletionDirect(prompt: LLMPrompt, options: LLMRequestOptions = {}): Promise<string> {
    const requestOptions = {
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens,
      top_p: options.top_p ?? 1,
      frequency_penalty: options.frequency_penalty ?? 0,
      presence_penalty: options.presence_penalty ?? 0,
      stop: options.stop,
      ...options
    };

    let attemptCount = 0;
    let lastError: Error | null = null;

    while (attemptCount < this.maxRetries) {
      try {
        return await this._makeRequest(prompt, requestOptions);
      } catch (error: any) {
        lastError = error;
        attemptCount++;
        
        // Only retry on specific error types
        if (!this._isRetryableError(error)) {
          throw error;
        }

        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attemptCount) * 1000)
        );
      }
    }

    throw lastError || new Error('Failed to generate completion after multiple attempts');
  }

  /**
   * Check if an error is retryable
   */
  private _isRetryableError(error: any): boolean {
    // Retry on rate limits, timeout, or server errors
    if (error.status >= 500 || error.status === 429 || error.code === 'ETIMEDOUT') {
      return true;
    }
    return false;
  }

  /**
   * Make the actual API request to the LLM provider
   */
  private async _makeRequest(prompt: LLMPrompt, options: LLMRequestOptions): Promise<string> {
    // Prepare the request based on the provider
    let requestData;
    let endpoint;
    
    switch (this.provider) {
      case 'anthropic':
        endpoint = `${this.baseUrl}/messages`;
        requestData = this._prepareAnthropicRequest(prompt, options);
        break;
      case 'openai':
      default:
        endpoint = `${this.baseUrl}/chat/completions`;
        requestData = this._prepareOpenAIRequest(prompt, options);
    }

    // Use fetch for HTTP request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error: any = new Error(
          `LLM API error (${response.status}): ${errorData.error?.message || response.statusText}`
        );
        error.status = response.status;
        error.data = errorData;
        throw error;
      }

      const data = await response.json();
      return this._extractResponseText(data);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get request headers for the API call
   */
  private _getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Add authorization based on provider
    switch (this.provider) {
      case 'anthropic':
        headers['x-api-key'] = this.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'openai':
      default:
        headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Prepare request data for OpenAI API
   */
  private _prepareOpenAIRequest(prompt: LLMPrompt, options: LLMRequestOptions): any {
    // Handle different prompt formats
    let messages: Message[];
    
    if (typeof prompt === 'string') {
      messages = [{
        role: 'user',
        content: prompt
      }];
    } else if (Array.isArray(prompt)) {
      messages = prompt;
    } else if ('messages' in prompt) {
      messages = prompt.messages;
    } else {
      messages = [{
        role: 'user',
        content: String(prompt)
      }];
    }

    return {
      model: options.model || this.model,
      messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      top_p: options.top_p,
      frequency_penalty: options.frequency_penalty,
      presence_penalty: options.presence_penalty,
      stop: options.stop,
      stream: false
    };
  }

  /**
   * Prepare request data for Anthropic API
   */
  private _prepareAnthropicRequest(prompt: LLMPrompt, options: LLMRequestOptions): any {
    // Handle different prompt formats
    let messages: Message[];
    let system: string | undefined;
    
    if (typeof prompt === 'string') {
      messages = [{
        role: 'user',
        content: prompt
      }];
    } else if (Array.isArray(prompt)) {
      messages = prompt;
    } else if ('messages' in prompt) {
      messages = prompt.messages;
      system = prompt.system;
    } else {
      messages = [{
        role: 'user',
        content: String(prompt)
      }];
    }

    const requestData: any = {
      model: options.model || this.model,
      messages,
      max_tokens: options.max_tokens || 1024,
      temperature: options.temperature,
      top_p: options.top_p,
      stop_sequences: options.stop
    };

    if (system) {
      requestData.system = system;
    }

    return requestData;
  }

  /**
   * Extract the generated text from the API response
   */
  private _extractResponseText(data: any): string {
    // Extract text based on provider format
    if (this.provider === 'anthropic') {
      return data.content?.length > 0
        ? data.content[0].text
        : '';
    } else {
      // OpenAI format
      return data.choices?.length > 0
        ? data.choices[0].message?.content || ''
        : '';
    }
  }
}

export default LLMService;
