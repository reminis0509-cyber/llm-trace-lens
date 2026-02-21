import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory
  const env = loadEnv(mode, process.cwd(), '');

  // Get environment variables from env file or process.env (for Vercel)
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  console.log('[Vite Build] Environment variables:', {
    VITE_SUPABASE_URL: supabaseUrl ? 'set' : 'not set',
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? 'set' : 'not set',
  });

  // Only define env vars if they have values (don't override with empty strings)
  const defineConfig: Record<string, string> = {};
  if (supabaseUrl) {
    defineConfig['import.meta.env.VITE_SUPABASE_URL'] = JSON.stringify(supabaseUrl);
  }
  if (supabaseAnonKey) {
    defineConfig['import.meta.env.VITE_SUPABASE_ANON_KEY'] = JSON.stringify(supabaseAnonKey);
  }

  return {
    plugins: [react()],
    // Explicitly define environment variables (only if they have values)
    define: defineConfig,
    server: {
      port: 5173,
      proxy: {
        '/v1': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/health': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
