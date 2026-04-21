/**
 * Concurrent task queue unit test (block 4).
 *
 * Verifies that:
 *   1. Up to MAX_CONCURRENT tasks run in parallel.
 *   2. Excess tasks wait until slots open.
 *   3. `getQueueStatus` and `getRunningTasks` reflect active state.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Ensure the module sees the test-tuned concurrency before first import.
process.env.TASK_QUEUE_MAX_CONCURRENT = '3';

const {
  enqueue,
  getQueueStatus,
  getQueueStatusForUser,
  getRunningTasks,
  getPendingTasks,
  __resetQueueForTests,
} = await import('../../queue/task-queue.js');

describe('task queue', () => {
  beforeEach(() => {
    __resetQueueForTests();
  });

  it('runs tasks in parallel up to the concurrency ceiling', async () => {
    const gates: Array<{ resolve: () => void; promise: Promise<void> }> = [];
    for (let i = 0; i < 5; i++) {
      let resolve: () => void = () => undefined;
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      gates.push({ resolve, promise });
    }

    const finished: number[] = [];
    const runs = gates.map((g, i) =>
      enqueue({ label: `t${i}` }, async () => {
        await g.promise;
        finished.push(i);
        return i;
      }),
    );

    // Give the queue a tick to admit as many runners as it can.
    await new Promise((r) => setImmediate(r));

    let status = getQueueStatus();
    expect(status.maxConcurrent).toBe(3);
    expect(status.running).toBe(3);
    expect(status.queued).toBe(2);

    // Release first three gates; queued ones should then run.
    gates[0].resolve();
    gates[1].resolve();
    gates[2].resolve();
    await new Promise((r) => setTimeout(r, 10));
    status = getQueueStatus();
    // Either the remaining 2 have been admitted (running=2, queued=0) or
    // the third has already finished — both are valid interleavings.
    expect(status.running).toBeLessThanOrEqual(3);

    gates[3].resolve();
    gates[4].resolve();
    const results = await Promise.all(runs);
    expect(results.sort()).toEqual([0, 1, 2, 3, 4]);

    const finalStatus = getQueueStatus();
    expect(finalStatus.running).toBe(0);
    expect(finalStatus.queued).toBe(0);
  });

  it('getRunningTasks returns the active set', async () => {
    let resolve: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      resolve = r;
    });
    const run = enqueue(
      { label: 'probe', userId: 'u@x.example' },
      async () => {
        await gate;
        return 1;
      },
    );
    await new Promise((r) => setImmediate(r));
    const running = getRunningTasks();
    expect(running.length).toBe(1);
    expect(running[0].label).toBe('probe');
    expect(running[0].userId).toBe('u@x.example');
    resolve();
    await run;
  });

  it('scopes getRunningTasks to the caller (S-01)', async () => {
    const gateA = { resolve: (): void => undefined, p: Promise.resolve() };
    const gateB = { resolve: (): void => undefined, p: Promise.resolve() };
    gateA.p = new Promise<void>((r) => {
      gateA.resolve = r;
    });
    gateB.p = new Promise<void>((r) => {
      gateB.resolve = r;
    });

    const runA = enqueue(
      { label: 'alice-task', userId: 'alice@example.com' },
      async () => {
        await gateA.p;
        return 'A';
      },
    );
    const runB = enqueue(
      { label: 'bob-task', userId: 'bob@example.com' },
      async () => {
        await gateB.p;
        return 'B';
      },
    );
    await new Promise((r) => setImmediate(r));

    const all = getRunningTasks();
    expect(all.length).toBe(2);

    const aliceOnly = getRunningTasks('alice@example.com');
    expect(aliceOnly.length).toBe(1);
    expect(aliceOnly[0].label).toBe('alice-task');
    expect(aliceOnly[0].userId).toBe('alice@example.com');

    const bobOnly = getRunningTasks('bob@example.com');
    expect(bobOnly.length).toBe(1);
    expect(bobOnly[0].label).toBe('bob-task');

    // Cross-user isolation: bob must not see alice's tasks.
    expect(
      getRunningTasks('bob@example.com').some(
        (t) => t.userId === 'alice@example.com',
      ),
    ).toBe(false);
    expect(
      getRunningTasks('alice@example.com').some(
        (t) => t.userId === 'bob@example.com',
      ),
    ).toBe(false);

    gateA.resolve();
    gateB.resolve();
    await Promise.all([runA, runB]);
  });

  it('scopes getPendingTasks + getQueueStatusForUser to the caller (S-01)', async () => {
    // MAX_CONCURRENT = 3 under the test env. Fill it with alice then queue
    // two more (one alice + one bob) that sit in pending, and assert the
    // pending view is scoped.
    const releases: Array<() => void> = [];
    const runs: Array<Promise<number>> = [];

    for (let i = 0; i < 3; i++) {
      const p = new Promise<void>((r) => releases.push(r));
      runs.push(
        enqueue({ label: `fill-${i}`, userId: 'alice@example.com' }, async () => {
          await p;
          return i;
        }),
      );
    }
    await new Promise((r) => setImmediate(r));

    // These two must queue — slots are full.
    const pendAlice = new Promise<void>((r) => releases.push(r));
    runs.push(
      enqueue({ label: 'pend-alice', userId: 'alice@example.com' }, async () => {
        await pendAlice;
        return 100;
      }),
    );
    const pendBob = new Promise<void>((r) => releases.push(r));
    runs.push(
      enqueue({ label: 'pend-bob', userId: 'bob@example.com' }, async () => {
        await pendBob;
        return 200;
      }),
    );

    await new Promise((r) => setImmediate(r));

    const alicePending = getPendingTasks('alice@example.com');
    expect(alicePending.length).toBe(1);
    expect(alicePending[0].label).toBe('pend-alice');

    const bobPending = getPendingTasks('bob@example.com');
    expect(bobPending.length).toBe(1);
    expect(bobPending[0].label).toBe('pend-bob');

    const aliceStatus = getQueueStatusForUser('alice@example.com');
    expect(aliceStatus.running).toBe(3);
    expect(aliceStatus.queued).toBe(1);
    expect(aliceStatus.total).toBe(4);

    const bobStatus = getQueueStatusForUser('bob@example.com');
    expect(bobStatus.running).toBe(0);
    expect(bobStatus.queued).toBe(1);
    expect(bobStatus.total).toBe(1);

    // Globals remain global.
    const global = getQueueStatus();
    expect(global.running).toBe(3);
    expect(global.queued).toBe(2);

    // Drain.
    for (const r of releases) r();
    await Promise.all(runs);
  });
});
