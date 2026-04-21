/**
 * routes/scheduled-tasks.ts — CRUD for scheduled_tasks rows.
 *
 * Endpoints (all require auth):
 *   POST   /api/scheduled-tasks
 *     body: { name, cronExpr, taskSpec: { taskType, params? }, projectId?, enabled? }
 *   GET    /api/scheduled-tasks
 *   GET    /api/scheduled-tasks/:id
 *   PATCH  /api/scheduled-tasks/:id
 *   DELETE /api/scheduled-tasks/:id
 *
 * Response envelope: `{ success: boolean, data?, error? }`.
 */
import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { getKnex } from '../storage/knex-client.js';
import { computeNextRun } from '../scheduler/runner.js';

interface ScheduledTaskRow {
  id: string;
  user_id: string;
  workspace_id: string | null;
  project_id: string | null;
  name: string;
  cron_expr: string;
  task_spec: unknown;
  enabled: number | boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

const specSchema = z.object({
  taskType: z.string().min(1).max(100),
  params: z.record(z.unknown()).optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  cronExpr: z.string().min(1).max(200),
  taskSpec: specSchema,
  projectId: z.string().optional(),
  enabled: z.boolean().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  cronExpr: z.string().min(1).max(200).optional(),
  taskSpec: specSchema.optional(),
  enabled: z.boolean().optional(),
});

function rowOut(r: ScheduledTaskRow) {
  let spec: unknown = null;
  try {
    spec = typeof r.task_spec === 'string' ? JSON.parse(r.task_spec) : r.task_spec;
  } catch {
    spec = null;
  }
  return {
    id: r.id,
    name: r.name,
    cronExpr: r.cron_expr,
    taskSpec: spec,
    projectId: r.project_id,
    enabled: Boolean(r.enabled),
    nextRunAt: r.next_run_at,
    lastRunAt: r.last_run_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export default async function scheduledTaskRoutes(fastify: FastifyInstance): Promise<void> {
  // POST
  fastify.post('/api/scheduled-tasks', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }
    const next = computeNextRun(parsed.data.cronExpr);
    if (!next) {
      return reply.code(400).send({ success: false, error: 'cronExpr が不正です' });
    }

    try {
      const db = getKnex();
      const id = randomBytes(16).toString('hex');
      const now = new Date().toISOString();
      await db('scheduled_tasks').insert({
        id,
        user_id: userEmail,
        workspace_id: null,
        project_id: parsed.data.projectId ?? null,
        name: parsed.data.name,
        cron_expr: parsed.data.cronExpr,
        task_spec: JSON.stringify(parsed.data.taskSpec),
        enabled: parsed.data.enabled ?? true,
        next_run_at: next.toISOString(),
        last_run_at: null,
        created_at: now,
        updated_at: now,
      });
      const row = (await db('scheduled_tasks').where({ id }).first()) as ScheduledTaskRow;
      return reply.code(201).send({ success: true, data: { task: rowOut(row) } });
    } catch (err) {
      request.log.error({ err }, '[scheduled-tasks POST] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });

  // GET list
  fastify.get('/api/scheduled-tasks', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

    try {
      const db = getKnex();
      const rows = (await db('scheduled_tasks')
        .where({ user_id: userEmail })
        .orderBy('created_at', 'desc')
        .limit(200)) as ScheduledTaskRow[];
      return reply.send({ success: true, data: { tasks: rows.map(rowOut) } });
    } catch (err) {
      request.log.error({ err }, '[scheduled-tasks GET] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });

  // GET by id
  fastify.get<{ Params: { id: string } }>(
    '/api/scheduled-tasks/:id',
    async (request, reply) => {
      const userEmail = request.user?.email;
      if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

      try {
        const db = getKnex();
        const row = (await db('scheduled_tasks')
          .where({ id: request.params.id, user_id: userEmail })
          .first()) as ScheduledTaskRow | undefined;
        if (!row) return reply.code(404).send({ success: false, error: 'not found' });
        return reply.send({ success: true, data: { task: rowOut(row) } });
      } catch (err) {
        request.log.error({ err }, '[scheduled-tasks GET id] failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );

  // PATCH
  fastify.patch<{ Params: { id: string } }>(
    '/api/scheduled-tasks/:id',
    async (request, reply) => {
      const userEmail = request.user?.email;
      if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

      const parsed = patchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join('; '),
        });
      }

      try {
        const db = getKnex();
        const existing = (await db('scheduled_tasks')
          .where({ id: request.params.id, user_id: userEmail })
          .first()) as ScheduledTaskRow | undefined;
        if (!existing) return reply.code(404).send({ success: false, error: 'not found' });

        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (parsed.data.name) patch.name = parsed.data.name;
        if (parsed.data.cronExpr) {
          const next = computeNextRun(parsed.data.cronExpr);
          if (!next) {
            return reply.code(400).send({ success: false, error: 'cronExpr が不正です' });
          }
          patch.cron_expr = parsed.data.cronExpr;
          patch.next_run_at = next.toISOString();
        }
        if (parsed.data.taskSpec) patch.task_spec = JSON.stringify(parsed.data.taskSpec);
        if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;

        await db('scheduled_tasks').where({ id: existing.id }).update(patch);
        const row = (await db('scheduled_tasks').where({ id: existing.id }).first()) as ScheduledTaskRow;
        return reply.send({ success: true, data: { task: rowOut(row) } });
      } catch (err) {
        request.log.error({ err }, '[scheduled-tasks PATCH] failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );

  // DELETE
  fastify.delete<{ Params: { id: string } }>(
    '/api/scheduled-tasks/:id',
    async (request, reply) => {
      const userEmail = request.user?.email;
      if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

      try {
        const db = getKnex();
        const deleted = await db('scheduled_tasks')
          .where({ id: request.params.id, user_id: userEmail })
          .del();
        if (deleted === 0) {
          return reply.code(404).send({ success: false, error: 'not found' });
        }
        return reply.send({ success: true });
      } catch (err) {
        request.log.error({ err }, '[scheduled-tasks DELETE] failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );
}
