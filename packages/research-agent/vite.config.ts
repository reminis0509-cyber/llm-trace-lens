import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      // DuckDuckGo search proxy to avoid CORS issues
      '/api/search': {
        target: 'https://html.duckduckgo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/search/, '/html/'),
      },
      // FujiTrace proxy passthrough for local development
      '/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
