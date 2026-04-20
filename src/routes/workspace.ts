/**
 * routes/workspace.ts — AI Employee Workspace APIs.
 *
 * Endpoints:
 *   GET  /api/workspace/briefing
 *        Morning briefing:
 *        {
 *          today: CalendarEvent[],       // Google Calendar, empty if not linked
 *          yesterdayDone: TaskSummary[], // tasks completed in the last 24h
 *          pending: TaskSummary[]        // tasks in pending or in_progress status
 *        }
 *
 *   GET  /api/workspace/tasks
 *        List entries from `task_timeline`.
 *        Query:
 *          ?status=pending|in_progress|done|failed   (optional)
 *          ?from=ISO   &to=ISO                        (optional date range; inclusive from, exclusive to)
 *          ?limit=100                                 (default 100, max 500)
 *
 *   POST /api/workspace/memory
 *        Body: { key: string, value: unknown }
 *        Upserts a user-scoped key-value pair into `ai_employee_memory`.
 *
 *   GET  /api/workspace/memory/:key
 *        Returns { key, value } or 404 when the key is not set.
 *
 * AUTH: all endpoints require a verified user identity
 * (`request.user.email`). The email is used as `user_id` in the tables.
 *
 * Response format: { success: true, data: T } or { success: false, error }.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { getKnex } from '../storage/knex-client.js';
import { isConnectorLinked } from '../auth/oauth/oauth-flow.js';
import { googleCalendarConnector } from '../connectors/google-calendar.js';

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

interface TaskTimelineRow {
  id: string;
  user_id: string;
  task_type: string;
  title: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  result_ref: string | null;
  connector_refs: string | null; // raw JSON string from sqlite
}

interface MemoryRow {
  id: string;
  user_id: string;
  key: string;
  value: string | null; // raw JSON string from sqlite
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const memoryPutSchema = z.object({
  key: z
    .string()
    .min(1, 'key is required')
    .max(128, 'key must be 128 chars or fewer')
    .regex(/^[A-Za-z0-9_.:-]+$/, 'key allows A-Z a-z 0-9 _ . : -'),
  value: z.unknown(),
});

const taskStatusSchema = z.enum(['pending', 'in_progress', 'done', 'failed']);

const tasksQuerySchema = z.object({
  status: taskStatusSchema.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((s) => Number.parseInt(s, 10))
    .refine((n) => n > 0 && n <= 500, 'limit must be between 1 and 500')
    .optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJsonColumn(raw: string | null): unknown {
  if (raw == null) return null;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function taskRowToSummary(row: TaskTimelineRow) {
  return {
    id: row.id,
    taskType: row.task_type,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    resultRef: row.result_ref,
    connectorRefs: parseJsonColumn(row.connector_refs),
  };
}

// DB task_type → Frontend DocumentKind mapping.
// DBはsnake_case/singular、Frontendはkebab-case。
type DocumentKind =
  | 'estimate'
  | 'invoice'
  | 'delivery-note'
  | 'purchase-order'
  | 'cover-letter'
  | 'other';

function kindFromTaskType(t: string): DocumentKind {
  switch (t) {
    case 'estimate':
    case 'invoice':
    case 'other':
      return t;
    case 'delivery':
    case 'delivery_note':
    case 'delivery-note':
      return 'delivery-note';
    case 'purchase_order':
    case 'purchase-order':
      return 'purchase-order';
    case 'cover_letter':
    case 'cover-letter':
      return 'cover-letter';
    default:
      return 'other';
  }
}

type TaskBoardColumn = 'completed-yesterday' | 'today' | 'pending';

function columnForRow(row: TaskTimelineRow, nowMs: number): TaskBoardColumn {
  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  if (row.status === 'done') {
    if (row.completed_at) {
      const doneMs = new Date(row.completed_at).getTime();
      if (doneMs < todayStartMs) return 'completed-yesterday';
      return 'today';
    }
    return 'completed-yesterday';
  }
  if (row.status === 'in_progress') return 'today';
  return 'pending';
}

function rowToCompletedTask(row: TaskTimelineRow) {
  return {
    id: row.id,
    title: row.title,
    kind: kindFromTaskType(row.task_type),
    completedAt: row.completed_at ?? row.created_at,
  };
}

function rowToPendingTask(row: TaskTimelineRow) {
  // Frontend PendingTask.status は 'pending' | 'failed' のみ。
  // DB の 'in_progress' は briefing 表示上「未完了」に畳む。
  const status: 'pending' | 'failed' = row.status === 'failed' ? 'failed' : 'pending';
  return {
    id: row.id,
    title: row.title,
    kind: kindFromTaskType(row.task_type),
    status,
    updatedAt: row.completed_at ?? row.created_at,
  };
}

function rowToTaskItem(row: TaskTimelineRow, nowMs: number) {
  // TaskBoardの TaskStatus は 'completed' | 'in_progress' | 'pending' | 'failed'。
  // DB の 'done' は 'completed' に変換。
  const status: 'completed' | 'in_progress' | 'pending' | 'failed' =
    row.status === 'done'
      ? 'completed'
      : row.status === 'in_progress'
        ? 'in_progress'
        : row.status === 'failed'
          ? 'failed'
          : 'pending';
  return {
    id: row.id,
    title: row.title,
    kind: kindFromTaskType(row.task_type),
    status,
    column: columnForRow(row, nowMs),
    updatedAt: row.completed_at ?? row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export default async function workspaceRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------
  // GET /api/workspace/briefing
  // -------------------------------------------------------------------
  fastify.get('/api/workspace/briefing', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) {
      return reply.code(401).send({ success: false, error: '認証が必要です' });
    }

    try {
      // 1) Connector status + today's events (empty if Google not connected)
      const calendarConnected = await isConnectorLinked(userEmail, 'google');
      let todayEvents: unknown[] = [];
      if (calendarConnected) {
        const res = await googleCalendarConnector.execute(userEmail, 'listEventsToday', {});
        if (res.ok) {
          const data = res.data as { events?: unknown[] };
          todayEvents = Array.isArray(data.events) ? data.events : [];
        } else {
          request.log.warn({ err: res.error }, '[briefing] calendar fetch failed');
        }
      }

      const db = getKnex();
      const now = new Date();
      const yesterdayIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      // 2) Tasks completed in the last 24h
      const completedYesterdayRows = (await db('task_timeline')
        .where({ user_id: userEmail, status: 'done' })
        .andWhere('completed_at', '>=', yesterdayIso)
        .orderBy('completed_at', 'desc')
        .limit(50)) as TaskTimelineRow[];

      // 3) Pending or in_progress tasks
      const pendingRows = (await db('task_timeline')
        .where({ user_id: userEmail })
        .whereIn('status', ['pending', 'in_progress', 'failed'])
        .orderBy('created_at', 'desc')
        .limit(100)) as TaskTimelineRow[];

      return reply.send({
        success: true,
        data: {
          calendarConnected,
          todayEvents,
          completedYesterday: completedYesterdayRows.map(rowToCompletedTask),
          pending: pendingRows.map(rowToPendingTask),
        },
      });
    } catch (err) {
      request.log.error({ err }, '[briefing] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });

  // -------------------------------------------------------------------
  // GET /api/workspace/tasks
  // -------------------------------------------------------------------
  fastify.get('/api/workspace/tasks', async (request: FastifyRequest, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) {
      return reply.code(401).send({ success: false, error: '認証が必要です' });
    }

    const parsed = tasksQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }
    const { status, from, to, limit } = parsed.data;

    try {
      const db = getKnex();
      let q = db('task_timeline').where({ user_id: userEmail });
      if (status) q = q.andWhere({ status });
      if (from) q = q.andWhere('created_at', '>=', from);
      if (to) q = q.andWhere('created_at', '<', to);
      q = q.orderBy('created_at', 'desc').limit(limit ?? 100);

      const rows = (await q) as TaskTimelineRow[];
      const nowMs = Date.now();
      return reply.send({
        success: true,
        data: { tasks: rows.map((r) => rowToTaskItem(r, nowMs)) },
      });
    } catch (err) {
      request.log.error({ err }, '[tasks] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });

  // -------------------------------------------------------------------
  // POST /api/workspace/memory
  // -------------------------------------------------------------------
  fastify.post('/api/workspace/memory', async (request: FastifyRequest, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) {
      return reply.code(401).send({ success: false, error: '認証が必要です' });
    }

    const parsed = memoryPutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }
    const { key, value } = parsed.data;

    try {
      const db = getKnex();
      const now = new Date().toISOString();
      const serialized = JSON.stringify(value ?? null);

      const existing = (await db('ai_employee_memory')
        .where({ user_id: userEmail, key })
        .first()) as MemoryRow | undefined;

      if (existing) {
        await db('ai_employee_memory')
          .where({ id: existing.id })
          .update({ value: serialized, updated_at: now });
      } else {
        await db('ai_employee_memory').insert({
          id: randomBytes(16).toString('hex'),
          user_id: userEmail,
          key,
          value: serialized,
          created_at: now,
          updated_at: now,
        });
      }

      return reply.send({ success: true, data: { key, updatedAt: now } });
    } catch (err) {
      request.log.error({ err }, '[memory POST] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });

  // -------------------------------------------------------------------
  // GET /api/workspace/memory/:key
  // -------------------------------------------------------------------
  fastify.get<{ Params: { key: string } }>(
    '/api/workspace/memory/:key',
    async (request, reply) => {
      const userEmail = request.user?.email;
      if (!userEmail) {
        return reply.code(401).send({ success: false, error: '認証が必要です' });
      }
      const { key } = request.params;
      if (!key || !/^[A-Za-z0-9_.:-]+$/.test(key)) {
        return reply.code(400).send({ success: false, error: 'key が不正です' });
      }

      try {
        const db = getKnex();
        const row = (await db('ai_employee_memory')
          .where({ user_id: userEmail, key })
          .first()) as MemoryRow | undefined;
        if (!row) {
          return reply.code(404).send({ success: false, error: 'not found' });
        }
        return reply.send({
          success: true,
          data: {
            key: row.key,
            value: parseJsonColumn(row.value),
            updatedAt: row.updated_at,
          },
        });
      } catch (err) {
        request.log.error({ err }, '[memory GET] failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );
}
