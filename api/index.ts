import type { VercelRequest, VercelResponse } from '@vercel/node';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { registerRoutes } from '../src/proxy/routes.js';
import { settingsRoutes } from '../src/routes/settings.js';
import { webhookSettingsRoutes } from '../src/routes/webhook-settings.js';
import { budgetSettingsRoutes } from '../src/routes/budget-settings.js';
import customRulesRoutes from '../src/routes/custom-rules.js';
import authRoutes from '../src/routes/auth.js';
import adminRoutes from '../src/routes/admin.js';
import { storageRoutes } from '../src/routes/storage.js';
import { secretsRoutes } from '../src/routes/secrets.js';
import feedbackRoutes from '../src/routes/feedback.js';
import integrationsRoutes from '../src/routes/integrations.js';
import planRoutes from '../src/routes/plans.js';
import benchmarkRoutes from '../src/routes/benchmarks.js';
import chatbotRoutes from '../src/routes/chatbot.js';
import researchRoutes from '../src/routes/research.js';
import membersRoutes from '../src/routes/members.js';
import adminDashboardRoutes from '../src/routes/admin-dashboard.js';
import billingRoutes from '../src/routes/billing.js';
import chatbotPlatformRoutes from '../src/routes/chatbot-platform.js';
import toolsRoutes from '../src/routes/tools/index.js';
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

    // Register routes (mirroring src/server.ts registration order)
    await membersRoutes(app);
    await settingsRoutes(app);
    await webhookSettingsRoutes(app);
    await budgetSettingsRoutes(app);
    await customRulesRoutes(app);
    await authRoutes(app);
    await adminRoutes(app);
    await feedbackRoutes(app);
    await integrationsRoutes(app);
    await storageRoutes(app);
    await secretsRoutes(app);
    await planRoutes(app);
    await benchmarkRoutes(app);
    await adminDashboardRoutes(app);
    await billingRoutes(app);
    await chatbotRoutes(app);
    await researchRoutes(app);
    await chatbotPlatformRoutes(app);
    await toolsRoutes(app);
    await registerRoutes(app);

    await app.ready();
  }
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fastify = await getApp();
  fastify.server.emit('request', req, res);
}
