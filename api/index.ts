import type { VercelRequest, VercelResponse } from '@vercel/node';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { registerRoutes } from '../src/proxy/routes.js';
import { settingsRoutes } from '../src/routes/settings.js';
import { storageRoutes } from '../src/routes/storage.js';
import feedbackRoutes from '../src/routes/feedback.js';
import chatbotRoutes from '../src/routes/chatbot.js';
import researchRoutes from '../src/routes/research.js';
import membersRoutes from '../src/routes/members.js';
import adminDashboardRoutes from '../src/routes/admin-dashboard.js';
import chatbotPlatformRoutes from '../src/routes/chatbot-platform.js';
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

    // Multipart support (file uploads for chatbot documents)
    await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

    // Register RBAC plugin (role-based access control)
    await app.register(rbacPlugin);

    // Budget guard middleware - blocks requests when budget exceeded
    app.addHook('preHandler', budgetGuardMiddleware);

    // Register member management routes
    await membersRoutes(app);

    // Register admin dashboard routes
    await adminDashboardRoutes(app);

    // Register settings routes
    await settingsRoutes(app);

    // Register storage routes (usage stats)
    await storageRoutes(app);

    // Register feedback routes
    await feedbackRoutes(app);

    // Register chatbot routes (public, no auth)
    await chatbotRoutes(app);

    // Register chatbot platform routes (dashboard + widget APIs)
    await chatbotPlatformRoutes(app);

    // Register research agent routes (public, SSE endpoint)
    await researchRoutes(app);

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
