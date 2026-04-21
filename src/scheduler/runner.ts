/**
 * scheduler/runner.ts — in-process cron runner for `scheduled_tasks`.
 *
 * Design:
 *   - setInterval polls every 60s (configurable via SCHEDULER_POLL_MS env).
 *   - Picks rows where `enabled=true AND (next_run_at IS NULL OR next_run_at <= now)`.
 *   - Marks `last_run_at = now`, computes the next cron occurrence and
 *     persists it to `next_run_at`, then dispatches the workload.
 *   - Dispatch writes a row into `task_timeline` (status pending → done/failed).
 *
 * Execution path: the spec allows "Contract-β runtime or existing
 * office-task pipeline". For v2 we keep the dispatcher minimal — it writes
 * a timeline entry and logs; running the actual Contract-β generator inside
 * the scheduler would require full Fastify context. That extension is
 * tracked as a follow-up (Founder wiring task: real runtime invocation).
 */
import { randomBytes } from 'crypto';
import { CronExpressionParser } from 'cron-parser';
import { getKnex } from '../storage/knex-client.js';

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

const DEFAULT_POLL_MS = 60_000;

let intervalHandle: NodeJS.Timeout | null = null;
let running = false;

export function computeNextRun(cronExpr: string, base?: Date): Date | null {
  try {
    const it = CronExpressionParser.parse(cronExpr, {
      currentDate: base ?? new Date(),
    });
    return it.next().toDate();
  } catch {
    return null;
  }
}

/** Hook used by the runner. Exported for unit tests. */
export async function runDueTasks(now: Date = new Date()): Promise<number> {
  const db = getKnex();
  // Fetch candidates. On sqlite boolean is stored as 0/1 — we accept both.
  const candidates = (await db('scheduled_tasks')
    .where((b) => b.where('enabled', true).orWhere('enabled', 1))
    .andWhere((b) =>
      b
        .whereNull('next_run_at')
        .orWhere('next_run_at', '<=', now.toISOString()),
    )
    .limit(50)) as ScheduledTaskRow[];

  let executed = 0;
  for (const row of candidates) {
    const next = computeNextRun(row.cron_expr, now);
    const nowIso = now.toISOString();
    await db('scheduled_tasks')
      .where({ id: row.id })
      .update({
        last_run_at: nowIso,
        next_run_at: next ? next.toISOString() : null,
        updated_at: nowIso,
        // disable rows whose cron expression can't be parsed any more
        enabled: next ? 1 : 0,
      });

    // Dispatch: record a task_timeline row so the Kanban/briefing surface it.
    let spec: { taskType?: string } = {};
    try {
      spec = typeof row.task_spec === 'string'
        ? (JSON.parse(row.task_spec) as { taskType?: string })
        : (row.task_spec as { taskType?: string });
    } catch {
      spec = {};
    }

    await db('task_timeline').insert({
      id: randomBytes(16).toString('hex'),
      user_id: row.user_id,
      task_type: spec.taskType ?? 'scheduled',
      title: row.name,
      status: 'pending',
      created_at: nowIso,
      completed_at: null,
      result_ref: `scheduled:${row.id}`,
      connector_refs: null,
      project_id: row.project_id,
    });
    executed += 1;
  }
  return executed;
}

/**
 * Start the polling loop. Idempotent — calling twice is a no-op.
 */
export function startScheduledTaskRunner(): void {
  if (intervalHandle) return;
  const pollMs = Number.parseInt(process.env.SCHEDULER_POLL_MS ?? '', 10);
  const interval = Number.isFinite(pollMs) && pollMs >= 1000 ? pollMs : DEFAULT_POLL_MS;
  intervalHandle = setInterval(() => {
    if (running) return;
    running = true;
    runDueTasks()
      .catch((err: unknown) => {
        // swallow — scheduler should never kill the process
        // eslint-disable-next-line no-console
        console.error('[scheduler] tick failed', err);
      })
      .finally(() => {
        running = false;
      });
  }, interval);
  // unref so it never holds the event loop open in tests
  if (typeof intervalHandle.unref === 'function') intervalHandle.unref();
}

/**
 * Stop the polling loop (graceful shutdown).
 */
export function stopScheduledTaskRunner(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
