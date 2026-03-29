import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'FujiTraceWidget',
      formats: ['iife'],
      fileName: () => 'embed.js',
    },
    outDir: 'dist',
    minify: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
