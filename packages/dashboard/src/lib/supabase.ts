import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Debug: Log environment variables (remove in production after fixing)
console.log('[Supabase Config]', {
  url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : '(empty)',
  keyLength: supabaseAnonKey ? supabaseAnonKey.length : 0,
  mode: import.meta.env.MODE,
});

// Check if Supabase is configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Create a mock client if not configured to prevent crashes
function createSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    console.error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables during build.');
  }
  // Create client even with empty strings - it will fail gracefully on API calls
  return createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');
}

export const supabase = createSupabaseClient();
