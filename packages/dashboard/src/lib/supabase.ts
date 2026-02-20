import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Fallback values for Railway deployment where env vars may not be available at build time
const FALLBACK_SUPABASE_URL = 'https://qbpmfereuhnpuvnjraxt.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFicG1mZXJldWhucHV2bmpyYXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjU5MzYsImV4cCI6MjA4NzAwMTkzNn0.-USgan7-G1kX3sdPuuotZiVpR6dIKOY9XNt82c6i4zg';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

// Check if Supabase is configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Create Supabase client
function createSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = createSupabaseClient();
