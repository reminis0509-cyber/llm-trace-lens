/**
 * queue/task-queue.ts — in-memory concurrency limiter for Contract-β runs.
 *
 * Target parity: Manus Pro ships 20 parallel tasks per user. We enforce the
 * same ceiling cluster-wide with a simple async semaphore. Callers describe
 * a task ("label" + async thunk); the queue records metadata so the status
 * endpoints can expose what's running.
 *
 * This is a process-local queue. A production deployment with multiple
 * replicas will need a shared backing store (Redis / pg advisory locks) —
 * tracked as a follow-up.
 *
 * Env:
 *   TASK_QUEUE_MAX_CONCURRENT (default 20)
 */
import { randomUUID } from 'crypto';

export interface RunningTask {
  id: string;
  label: string;
  userId?: string;
  workspaceId?: string;
  startedAt: string;
}

interface PendingTask extends RunningTask {
  resolve: () => void;
}

function defaultMaxConcurrent(): number {
  const v = Number.parseInt(process.env.TASK_QUEUE_MAX_CONCURRENT ?? '', 10);
  if (Number.isFinite(v) && v > 0) return v;
  return 20;
}

const MAX_CONCURRENT = defaultMaxConcurrent();

const running = new Map<string, RunningTask>();
const pending: PendingTask[] = [];

function drain(): void {
  while (running.size < MAX_CONCURRENT && pending.length > 0) {
    const next = pending.shift();
    if (!next) break;
    running.set(next.id, {
      id: next.id,
      label: next.label,
      userId: next.userId,
      workspaceId: next.workspaceId,
      startedAt: new Date().toISOString(),
    });
    next.resolve();
  }
}

function acquire(input: {
  id: string;
  label: string;
  userId?: string;
  workspaceId?: string;
}): Promise<void> {
  if (running.size < MAX_CONCURRENT) {
    running.set(input.id, {
      id: input.id,
      label: input.label,
      userId: input.userId,
      workspaceId: input.workspaceId,
      startedAt: new Date().toISOString(),
    });
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    pending.push({
      id: input.id,
      label: input.label,
      userId: input.userId,
      workspaceId: input.workspaceId,
      startedAt: new Date().toISOString(),
      resolve,
    });
  });
}

function release(id: string): void {
  running.delete(id);
  drain();
}

/**
 * Enqueue a task. Resolves to the task's return value once it has been
 * acquired and run. If the queue is full the caller waits.
 */
export async function enqueue<T>(
  input: {
    label: string;
    userId?: string;
    workspaceId?: string;
  },
  task: () => Promise<T>,
): Promise<T> {
  const id = randomUUID();
  await acquire({ id, ...input });
  try {
    return await task();
  } finally {
    release(id);
  }
}

export function getQueueStatus(): {
  running: number;
  queued: number;
  total: number;
  maxConcurrent: number;
} {
  return {
    running: running.size,
    queued: pending.length,
    total: running.size + pending.length,
    maxConcurrent: MAX_CONCURRENT,
  };
}

/**
 * Return running tasks. When `userId` is provided, the result is filtered
 * to only tasks enqueued by that user — the default behaviour for any
 * user-facing diagnostic endpoint. Omit `userId` only from system-admin
 * code paths.
 */
export function getRunningTasks(userId?: string): RunningTask[] {
  const all = Array.from(running.values());
  if (!userId) return all;
  return all.filter((t) => t.userId === userId);
}

/**
 * Return pending (queued but not started) tasks. Same `userId` filter
 * semantics as `getRunningTasks`.
 */
export function getPendingTasks(userId?: string): RunningTask[] {
  const all: RunningTask[] = pending.map((p) => ({
    id: p.id,
    label: p.label,
    userId: p.userId,
    workspaceId: p.workspaceId,
    startedAt: p.startedAt,
  }));
  if (!userId) return all;
  return all.filter((t) => t.userId === userId);
}

/**
 * Scoped variant of `getQueueStatus`. When `userId` is provided, the
 * `running` / `queued` / `total` counts reflect only that user's slice.
 * `maxConcurrent` stays global — it's a process-wide ceiling and callers
 * may want to surface it as context.
 */
export function getQueueStatusForUser(userId: string): {
  running: number;
  queued: number;
  total: number;
  maxConcurrent: number;
} {
  const r = getRunningTasks(userId).length;
  const q = getPendingTasks(userId).length;
  return {
    running: r,
    queued: q,
    total: r + q,
    maxConcurrent: MAX_CONCURRENT,
  };
}

/**
 * Test-only drain — NOT exposed from any public API route. Clears internal
 * state so test suites can reset between cases without bleed-through.
 */
export function __resetQueueForTests(): void {
  running.clear();
  pending.length = 0;
}
