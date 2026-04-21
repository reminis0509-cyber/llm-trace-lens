/**
 * routes/queue-status.ts — diagnostic endpoints for the concurrent task queue.
 *
 * Endpoints:
 *   GET /api/queue/status             → { running, queued, total, maxConcurrent }
 *                                       scoped to the caller by default
 *                                       (?scope=global is reserved for admin)
 *   GET /api/queue/tasks              → { tasks: RunningTask[] }
 *                                       scoped to the caller by default
 *                                       (?scope=global is reserved for admin)
 *
 * Both endpoints require a verified user session (same auth model as the
 * rest of the agent routes).
 *
 * Response format:
 *   { success: true, data: <payload> } on success
 *   { success: false, error: <message> } on 401/403
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  getQueueStatus,
  getQueueStatusForUser,
  getRunningTasks,
} from '../queue/task-queue.js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

function wantsGlobalScope(request: FastifyRequest): boolean {
  const q = request.query as { scope?: string } | undefined;
  return q?.scope === 'global';
}

export default async function queueStatusRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/queue/status', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

    if (wantsGlobalScope(request)) {
      if (!isAdmin(userEmail)) {
        return reply
          .code(403)
          .send({ success: false, error: 'この操作には管理者権限が必要です' });
      }
      return reply.send({ success: true, data: getQueueStatus() });
    }

    return reply.send({ success: true, data: getQueueStatusForUser(userEmail) });
  });

  fastify.get('/api/queue/tasks', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

    if (wantsGlobalScope(request)) {
      if (!isAdmin(userEmail)) {
        return reply
          .code(403)
          .send({ success: false, error: 'この操作には管理者権限が必要です' });
      }
      return reply.send({ success: true, data: { tasks: getRunningTasks() } });
    }

    return reply.send({
      success: true,
      data: { tasks: getRunningTasks(userEmail) },
    });
  });
}
