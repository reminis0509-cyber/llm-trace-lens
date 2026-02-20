import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
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
import { secretsRoutes } from './routes/secrets.js';
import { webhookManager } from './webhook/sender.js';
import { getWebhookConfig } from './kv/client.js';

/**
 * Get allowed CORS origins from environment variable
 * Falls back to localhost only in development
 */
function getAllowedOrigins(): string[] {
  const originsEnv = process.env.CORS_ALLOWED_ORIGINS;
  if (originsEnv) {
    return originsEnv.split(',').map(o => o.trim()).filter(Boolean);
  }
  // Default: only allow localhost in development
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'];
  }
  // In production, require explicit configuration
  return [];
}

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

  // Security headers (helmet)
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for some API clients
  });

  // CORS support - whitelist-based
  const allowedOrigins = getAllowedOrigins();
  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }
      // Check if origin is in whitelist
      if (allowedOrigins.length === 0) {
        // No origins configured - deny all cross-origin requests in production
        if (process.env.NODE_ENV === 'production') {
          return callback(new Error('CORS not allowed'), false);
        }
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Admin-API-Key', 'X-User-ID'],
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

  // Register secrets management routes (encrypted API key storage)
  await secretsRoutes(fastify);

  // Register main routes
  await registerRoutes(fastify);

  // Serve dashboard static files (for Railway/production deployment)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dashboardPath = path.join(__dirname, '..', '..', 'packages', 'dashboard', 'dist');

  try {
    await fastify.register(fastifyStatic, {
      root: dashboardPath,
      prefix: '/',
      decorateReply: false,
    });

    // SPA fallback - serve index.html for non-API routes
    fastify.setNotFoundHandler(async (request, reply) => {
      // Don't serve index.html for API routes
      if (request.url.startsWith('/api/') ||
          request.url.startsWith('/v1/') ||
          request.url.startsWith('/health') ||
          request.url.startsWith('/admin/') ||
          request.url.startsWith('/auth/')) {
        return reply.code(404).send({ error: 'Not Found' });
      }
      return reply.sendFile('index.html');
    });

    fastify.log.info(`[Server] Serving dashboard from ${dashboardPath}`);
  } catch (err) {
    fastify.log.warn(`[Server] Dashboard not found at ${dashboardPath}, API-only mode`);
  }

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
