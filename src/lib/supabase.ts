
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Using existing Supabase URL and key from the integrations/supabase/client.ts
const SUPABASE_URL = "https://igzuqirgmwgxfpbtpsdc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenVxaXJnbXdneGZwYnRwc2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgzNjc5OTAsImV4cCI6MjA1Mzk0Mzk5MH0.FgHcJys1LDlJIVbFSOHKb0fepKdKge0Ai5SGMB0vJlg";

// Export the supabase client directly to avoid duplicate client warnings
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
