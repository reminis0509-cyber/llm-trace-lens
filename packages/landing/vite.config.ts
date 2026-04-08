import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api/chatbot': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/api/research': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/api/tools': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/api/hp-generate': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
