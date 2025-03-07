
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Log the request for debugging
  console.log('Agent-LLM function received request:', req.method);

  // Verify API key is available
  if (!OPENAI_API_KEY) {
    console.error('OpenAI API key is not set');
    return new Response(
      JSON.stringify({ error: 'OpenAI API key is not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { type, prompt, text, model = "gpt-4o-mini" } = await req.json();
    console.log(`Processing request of type: ${type} with model: ${model}`);

    if (type === 'completion') {
      // Handle completion request
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: 'You are an AI assistant that helps with agent reasoning and planning.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${data.error?.message || JSON.stringify(data)}`);
      }
      
      const completion = data.choices[0].message.content;
      console.log('Successfully generated completion');

      return new Response(JSON.stringify({ completion }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } 
    else if (type === 'embedding') {
      // Handle embedding request
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${data.error?.message || JSON.stringify(data)}`);
      }
      
      const embedding = data.data[0].embedding;
      console.log('Successfully generated embedding');

      return new Response(JSON.stringify({ embedding }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    else {
      throw new Error(`Unsupported request type: ${type}`);
    }
  } catch (error) {
    console.error('Error in agent-llm function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
