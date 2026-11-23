import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Valeurs publiques (clé « anon », protégée par les règles RLS) : elles servent de repli
// quand le site est compilé sans fichier .env (ex. build automatique Hostinger depuis GitHub).
const DEFAULT_SUPABASE_URL = "https://uyqjgbbgcyxxdrkuxenn.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5cWpnYmJnY3l4eGRya3V4ZW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0NTc4MDYsImV4cCI6MjExMTAzMzgwNn0.Os1yhUGVjY_4TTY3DQG3HSICLq42mrmby85Zx0hXW6I";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});
