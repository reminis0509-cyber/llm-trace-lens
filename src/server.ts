import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './proxy/routes.js';
import { setupRateLimit } from './middleware/rate-limit.js';
import { authMiddleware } from './middleware/auth.js';
import { settingsRoutes } from './routes/settings.js';
import { webhookSettingsRoutes } from './routes/webhook-settings.js';
import { budgetSettingsRoutes } from './routes/budget-settings.js';
import customRulesRoutes from './routes/custom-rules.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import feedbackRoutes from './routes/feedback.js';
import integrationsRoutes from './routes/integrations.js';
import { storageRoutes } from './routes/storage.js';
import { webhookManager } from './webhook/sender.js';
import { getWebhookConfig } from './kv/client.js';

export async function build(options?: { enableAuth?: boolean; enableRateLimit?: boolean }) {
  const fastify = Fastify({
    logger: process.env.NODE_ENV !== 'production' ? {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    } : true,
  });

  // CORS support
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Rate Limiting (optional)
  if (options?.enableRateLimit !== false) {
    await setupRateLimit(fastify);
  }

  // Authentication middleware (optional)
  if (options?.enableAuth !== false && process.env.ENABLE_AUTH === 'true') {
    fastify.addHook('onRequest', authMiddleware);
  }

  // Register settings routes (for SaaS setup)
  await settingsRoutes(fastify);

  // Register webhook settings routes
  await webhookSettingsRoutes(fastify);

  // Register budget settings routes
  await budgetSettingsRoutes(fastify);

  // Register custom validation rules routes
  await customRulesRoutes(fastify);

  // Register OAuth/SSO auth routes
  await authRoutes(fastify);

  // Register admin routes (protected by ADMIN_API_KEY)
  await adminRoutes(fastify);

  // Register feedback routes
  await feedbackRoutes(fastify);

  // Register integrations routes (Slack, Teams)
  await integrationsRoutes(fastify);

  // Register storage routes (usage stats)
  await storageRoutes(fastify);

  // Register main routes
  await registerRoutes(fastify);

  return fastify;
}

export async function start() {
  const fastify = await build();

  // Load webhook config at startup
  try {
    const webhookConfig = await getWebhookConfig();
    if (webhookConfig) {
      webhookManager.register('default', webhookConfig);
      fastify.log.info('[Server] Webhook config loaded');
    }
  } catch (error) {
    fastify.log.warn(`[Server] Failed to load webhook config: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      fastify.log.info(`Received ${signal}, shutting down...`);
      await fastify.close();
      process.exit(0);
    });
  }

  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    await fastify.listen({
      port,
      host: '0.0.0.0',
    });

    fastify.log.info('='.repeat(50));
    fastify.log.info(`LLM Trace Lens v0.4.0`);
    fastify.log.info(`Server running on http://localhost:${port}`);
    fastify.log.info(`Health: http://localhost:${port}/health`);
    fastify.log.info(`Chat:   POST http://localhost:${port}/v1/chat/completions`);
    fastify.log.info(`Setup:  http://localhost:${port}/setup`);
    fastify.log.info('='.repeat(50));
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
