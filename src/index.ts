// Main entry point - delegates to server.ts
import { start } from './server.js';

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
