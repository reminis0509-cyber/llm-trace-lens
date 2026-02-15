import type { VercelRequest, VercelResponse } from '@vercel/node';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from '../src/proxy/routes.js';
import { settingsRoutes } from '../src/routes/settings.js';

let app: ReturnType<typeof Fastify> | null = null;

async function getApp() {
  if (!app) {
    app = Fastify({
      logger: process.env.NODE_ENV !== 'production',
    });

    await app.register(cors, {
      origin: true,
      credentials: true,
    });

    // Register settings routes
    await settingsRoutes(app);

    // Register main routes
    await registerRoutes(app);

    await app.ready();
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fastify = await getApp();
  fastify.server.emit('request', req, res);
}
