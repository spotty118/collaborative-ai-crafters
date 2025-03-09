
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Modified to support vector operations
export const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-deno/0.0.1',
      },
    },
  }
);
