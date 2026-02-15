import type { FastifyInstance } from 'fastify';
import {
  getBudgetConfig,
  saveBudgetConfig,
  getCostStats,
} from '../kv/client.js';

export async function budgetSettingsRoutes(fastify: FastifyInstance) {
  // Get budget configuration
  fastify.get('/api/budget/config', async (_request, reply) => {
    try {
      const config = await getBudgetConfig();
      return {
        config: config || {
          monthlyLimit: 100,
          alertThresholds: [0.8, 0.95],
        },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to get budget config' });
    }
  });

  // Save budget configuration
  fastify.post('/api/budget/config', async (request, reply) => {
    try {
      const body = request.body as {
        monthlyLimit: number;
        alertThresholds: number[];
      };

      if (typeof body.monthlyLimit !== 'number' || body.monthlyLimit < 0) {
        return reply.status(400).send({
          error: 'Invalid monthlyLimit. Must be a non-negative number.',
        });
      }

      if (!Array.isArray(body.alertThresholds)) {
        return reply.status(400).send({
          error: 'Invalid alertThresholds. Must be an array of numbers between 0 and 1.',
        });
      }

      // Validate thresholds are between 0 and 1
      const invalidThresholds = body.alertThresholds.filter(
        t => typeof t !== 'number' || t < 0 || t > 1
      );
      if (invalidThresholds.length > 0) {
        return reply.status(400).send({
          error: 'Alert thresholds must be numbers between 0 and 1.',
        });
      }

      const config = {
        monthlyLimit: body.monthlyLimit,
        alertThresholds: body.alertThresholds.sort((a, b) => a - b),
      };

      await saveBudgetConfig(config);

      return { success: true, config };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to save budget config' });
    }
  });

  // Get cost statistics
  fastify.get('/api/budget/stats', async (_request, reply) => {
    try {
      const month = new Date().toISOString().slice(0, 7); // YYYY-MM
      const stats = await getCostStats(month);
      const config = await getBudgetConfig();

      const percentage = config && config.monthlyLimit > 0
        ? (stats.totalCost / config.monthlyLimit) * 100
        : 0;

      return {
        stats,
        budget: config,
        percentage,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to get cost stats' });
    }
  });

  // Get historical cost stats (for a specific month)
  fastify.get('/api/budget/stats/:month', async (request, reply) => {
    try {
      const { month } = request.params as { month: string };

      // Validate month format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return reply.status(400).send({
          error: 'Invalid month format. Use YYYY-MM.',
        });
      }

      const stats = await getCostStats(month);
      const config = await getBudgetConfig();

      const percentage = config && config.monthlyLimit > 0
        ? (stats.totalCost / config.monthlyLimit) * 100
        : 0;

      return {
        stats,
        budget: config,
        percentage,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to get cost stats' });
    }
  });
}
