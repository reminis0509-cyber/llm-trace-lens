/**
 * routes/external-api/v1/tasks.ts — programmatic task endpoints.
 *
 * All endpoints require `Authorization: Bearer fjk_<...>` (see
 * `src/middleware/api-key-auth.ts`). The mount prefix is
 * `/api/external-api/v1` and is applied by the parent `register`.
 *
 * Endpoints:
 *   GET  /tasks           → list recent task_timeline rows for the caller
 *   POST /tasks/run       → body { query } — enqueues a Wide Research pass
 *                           (synchronous until finalised). Returns the task id.
 *   GET  /tasks/:id       → fetch a single row
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { getKnex } from '../../../storage/knex-client.js';
import { enqueue } from '../../../queue/task-queue.js';
import { runWideResearch } from '../../../agent/wide-research.js';

interface TaskTimelineRow {
  id: string;
  user_id: string;
  task_type: string;
  title: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  result_ref: string | null;
  connector_refs: string | null;
  project_id?: string | null;
  workspace_id?: string | null;
}

const runSchema = z.object({
  query: z.string().min(2).max(1000),
});

function rowOut(r: TaskTimelineRow) {
  return {
    id: r.id,
    taskType: r.task_type,
    title: r.title,
    status: r.status,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    resultRef: r.result_ref,
  };
}

export default async function externalTasksRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/tasks', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: 'unauthenticated' });
    try {
      const db = getKnex();
      const rows = (await db('task_timeline')
        .where({ user_id: userEmail })
        .orderBy('created_at', 'desc')
        .limit(100)) as TaskTimelineRow[];
      return reply.send({ success: true, data: { tasks: rows.map(rowOut) } });
    } catch (err) {
      request.log.error({ err }, '[external/tasks GET] failed');
      return reply.code(500).send({ success: false, error: 'internal error' });
    }
  });

  fastify.post('/tasks/run', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: 'unauthenticated' });

    const parsed = runSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }

    try {
      const taskId = randomBytes(16).toString('hex');
      const db = getKnex();
      const now = new Date().toISOString();
      await db('task_timeline').insert({
        id: taskId,
        user_id: userEmail,
        task_type: 'external_api_run',
        title: `external-api: ${parsed.data.query}`.slice(0, 200),
        status: 'pending',
        created_at: now,
        completed_at: null,
        result_ref: null,
        connector_refs: null,
      });

      // Enqueue the actual work, bounded by the global task queue.
      enqueue(
        { label: `external-api:${taskId}`, userId: userEmail },
        async () => {
          for await (const _ev of runWideResearch({
            query: parsed.data.query,
            userId: userEmail,
          })) {
            // events are persisted to task_timeline inside runWideResearch
          }
          return true;
        },
      ).catch((err: unknown) => {
        request.log.error({ err }, '[external/tasks/run] async run failed');
      });

      return reply.code(201).send({
        success: true,
        data: { taskId },
      });
    } catch (err) {
      request.log.error({ err }, '[external/tasks/run] failed');
      return reply.code(500).send({ success: false, error: 'internal error' });
    }
  });

  fastify.get<{ Params: { id: string } }>('/tasks/:id', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: 'unauthenticated' });
    try {
      const db = getKnex();
      const row = (await db('task_timeline')
        .where({ id: request.params.id, user_id: userEmail })
        .first()) as TaskTimelineRow | undefined;
      if (!row) return reply.code(404).send({ success: false, error: 'not found' });
      return reply.send({ success: true, data: { task: rowOut(row) } });
    } catch (err) {
      request.log.error({ err }, '[external/tasks GET id] failed');
      return reply.code(500).send({ success: false, error: 'internal error' });
    }
  });
}
