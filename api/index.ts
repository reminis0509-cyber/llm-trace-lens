import type { VercelRequest, VercelResponse } from '@vercel/node';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from '../src/proxy/routes.js';
import { settingsRoutes } from '../src/routes/settings.js';
import { storageRoutes } from '../src/routes/storage.js';
import feedbackRoutes from '../src/routes/feedback.js';
import membersRoutes from '../src/routes/members.js';
import rbacPlugin from '../src/middleware/rbac.js';
import { budgetGuardMiddleware } from '../src/middleware/budget-guard.js';

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

    // Register RBAC plugin (role-based access control)
    await app.register(rbacPlugin);

    // Budget guard middleware - blocks requests when budget exceeded
    app.addHook('preHandler', budgetGuardMiddleware);

    // Register member management routes
    await membersRoutes(app);

    // Register settings routes
    await settingsRoutes(app);

    // Register storage routes (usage stats)
    await storageRoutes(app);

    // Register feedback routes
    await feedbackRoutes(app);

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
