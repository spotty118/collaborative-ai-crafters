
import { supabase } from "@/integrations/supabase/client";

/**
 * Generate a completion using the LLM
 * @param prompt - The prompt to send to the LLM
 * @returns - The generated text
 */
export async function generateCompletion(prompt: string): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('agent-llm', {
      body: { type: 'completion', prompt },
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
 * Generate embeddings for a text
 * @param text - The text to embed
 * @returns - The embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const { data, error } = await supabase.functions.invoke('agent-llm', {
      body: { type: 'embedding', text },
    });

    if (error) {
      console.error('Error calling agent-llm function for embedding:', error);
      throw new Error(`Embedding function error: ${error.message}`);
    }

    return data.embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
