import type { FastifyInstance } from 'fastify';
import {
  getWebhookConfig,
  saveWebhookConfig,
  deleteWebhookConfig,
} from '../kv/client.js';
import { webhookManager, type WebhookConfig } from '../webhook/sender.js';

export async function webhookSettingsRoutes(fastify: FastifyInstance) {
  // Get webhook configuration
  fastify.get('/api/webhook/config', async (_request, reply) => {
    try {
      const config = await getWebhookConfig();
      return { config };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to get webhook config' });
    }
  });

  // Save webhook configuration
  fastify.post('/api/webhook/config', async (request, reply) => {
    try {
      const body = request.body as { url: string; events: string[] };

      if (!body.url || !body.events || !Array.isArray(body.events)) {
        return reply.status(400).send({ error: 'Invalid request body. Required: url (string), events (array)' });
      }

      // Validate URL format
      try {
        new URL(body.url);
      } catch {
        return reply.status(400).send({ error: 'Invalid URL format' });
      }

      // Validate event types
      const validEvents = ['BLOCK', 'WARN', 'COST_ALERT'];
      const invalidEvents = body.events.filter(e => !validEvents.includes(e));
      if (invalidEvents.length > 0) {
        return reply.status(400).send({
          error: `Invalid event types: ${invalidEvents.join(', ')}. Valid types: ${validEvents.join(', ')}`,
        });
      }

      const config: WebhookConfig = {
        url: body.url,
        events: body.events as ('BLOCK' | 'WARN' | 'COST_ALERT')[],
        retries: 3,
        timeout: 5000,
      };

      await saveWebhookConfig(config);

      // Re-register with manager
      webhookManager.clear();
      webhookManager.register('default', config);

      return { success: true, config };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to save webhook config' });
    }
  });

  // Delete webhook configuration
  fastify.delete('/api/webhook/config', async (_request, reply) => {
    try {
      await deleteWebhookConfig();
      webhookManager.clear();
      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to delete webhook config' });
    }
  });

  // Test webhook
  fastify.post('/api/webhook/test', async (_request, reply) => {
    try {
      const config = await getWebhookConfig();
      if (!config) {
        return reply.status(400).send({ error: 'No webhook configured' });
      }

      const testEvent = {
        event: 'WARN' as const,
        timestamp: new Date().toISOString(),
        traceId: 'test_' + Date.now(),
        provider: 'test',
        model: 'test-model',
        risk: 'Test webhook notification',
        details: { message: 'This is a test notification from LLM Trace Lens' },
      };

      // Re-register to ensure latest config
      webhookManager.clear();
      webhookManager.register('default', config);
      await webhookManager.sendAll(testEvent);

      return { success: true, message: 'Test webhook sent' };
    } catch (error) {
      fastify.log.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send({
        error: 'Failed to send test webhook',
        details: errorMessage,
      });
    }
  });
}
