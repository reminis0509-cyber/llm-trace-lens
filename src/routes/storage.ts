import { FastifyInstance } from 'fastify';
import { getStorageAdapter, KVStorageAdapter } from '../storage/adapter.js';

interface StorageUsageResponse {
  currentCount: number;
  maxCount: number;
  maxAgeDays: number;
  oldestDate: string | null;
  usagePercent: number;
  storageType: string;
}

/**
 * Storage routes - Usage statistics and management
 */
export async function storageRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/storage/usage - Get storage usage statistics
   */
  fastify.get<{
    Reply: StorageUsageResponse;
  }>('/api/storage/usage', async (request, reply) => {
    try {
      const adapter = getStorageAdapter();

      // Check if using KV storage
      if (adapter instanceof KVStorageAdapter) {
        // For KV, get the default workspace stats
        // In a multi-tenant setup, you would get the workspaceId from the request
        const workspaceId = 'default';
        const stats = await adapter.getStats(workspaceId);
        const usagePercent = stats.maxCount > 0
          ? Math.round((stats.currentCount / stats.maxCount) * 100)
          : 0;

        return reply.send({
          ...stats,
          usagePercent,
          storageType: 'kv',
        });
      }

      // For PostgreSQL, return unlimited stats
      return reply.send({
        currentCount: 0,
        maxCount: -1, // -1 indicates unlimited
        maxAgeDays: -1,
        oldestDate: null,
        usagePercent: 0,
        storageType: 'postgres',
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get storage usage');
      return reply.code(500).send({
        currentCount: 0,
        maxCount: -1,
        maxAgeDays: -1,
        oldestDate: null,
        usagePercent: 0,
        storageType: 'unknown',
      });
    }
  });

  /**
   * GET /api/storage/info - Get storage configuration info
   */
  fastify.get('/api/storage/info', async (request, reply) => {
    const adapter = getStorageAdapter();
    const isKV = adapter instanceof KVStorageAdapter;

    return reply.send({
      type: adapter.type,
      isKV,
      hasLimits: isKV,
    });
  });
}
