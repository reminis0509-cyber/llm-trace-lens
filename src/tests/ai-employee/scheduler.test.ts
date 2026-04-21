/**
 * Scheduler runner unit test.
 *
 * Inserts a row whose `next_run_at` is already in the past, calls
 * `runDueTasks`, and verifies:
 *   1. `last_run_at` is set.
 *   2. `next_run_at` advances (for a valid cron expression).
 *   3. A `task_timeline` row is created with `status='pending'`.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import knex, { type Knex } from 'knex';
import { up as migrate013Up } from '../../../migrations/013_ai_employee_workspace.js';
import { up as migrate014Up } from '../../../migrations/014_projects.js';
import { up as migrate015Up } from '../../../migrations/015_scheduled_tasks.js';
import { up as migrate016Up } from '../../../migrations/016_workspace_scope.js';

let testDb: Knex;

vi.mock('../../storage/knex-client.js', () => ({
  getKnex: () => testDb,
  closeKnex: async () => {
    if (testDb) await testDb.destroy();
  },
}));

const { runDueTasks, computeNextRun } = await import('../../scheduler/runner.js');

describe('scheduler runner', () => {
  beforeAll(async () => {
    testDb = knex({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });
    await migrate013Up(testDb);
    await migrate014Up(testDb);
    await migrate015Up(testDb);
    await migrate016Up(testDb);
  });

  afterAll(async () => {
    if (testDb) await testDb.destroy();
  });

  it('computeNextRun returns a future Date for a valid cron', () => {
    const next = computeNextRun('*/5 * * * *');
    expect(next).not.toBeNull();
    if (next) {
      expect(next.getTime()).toBeGreaterThan(Date.now() - 1000);
    }
  });

  it('computeNextRun returns null for malformed cron', () => {
    expect(computeNextRun('not a cron')).toBeNull();
  });

  it('runDueTasks picks due rows, updates timestamps, and writes task_timeline', async () => {
    const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await testDb('scheduled_tasks').insert({
      id: 's1',
      user_id: 'owner@example.com',
      workspace_id: null,
      project_id: null,
      name: 'daily-briefing',
      cron_expr: '*/5 * * * *',
      task_spec: JSON.stringify({ taskType: 'custom_job' }),
      enabled: 1,
      next_run_at: past,
      last_run_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const executed = await runDueTasks();
    expect(executed).toBe(1);

    const row = await testDb('scheduled_tasks').where({ id: 's1' }).first();
    expect(row.last_run_at).not.toBeNull();
    expect(row.next_run_at).not.toBeNull();
    // Advanced at least 1 minute ahead of the original "past" value.
    expect(new Date(row.next_run_at).getTime()).toBeGreaterThan(
      new Date(past).getTime() + 60_000,
    );

    const timeline = await testDb('task_timeline')
      .where({ user_id: 'owner@example.com' })
      .orderBy('created_at', 'desc')
      .first();
    expect(timeline).toBeDefined();
    expect(timeline.title).toBe('daily-briefing');
    expect(timeline.status).toBe('pending');
    expect(timeline.task_type).toBe('custom_job');
  });

  it('ignores disabled rows', async () => {
    await testDb('scheduled_tasks').insert({
      id: 's2',
      user_id: 'someone@example.com',
      workspace_id: null,
      project_id: null,
      name: 'disabled-job',
      cron_expr: '*/5 * * * *',
      task_spec: JSON.stringify({ taskType: 'custom_job' }),
      enabled: 0,
      next_run_at: new Date(Date.now() - 60_000).toISOString(),
      last_run_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const executed = await runDueTasks();
    // Only previously inserted s1 is eligible for another run (if due);
    // the newly inserted disabled row must never run.
    const s2 = await testDb('scheduled_tasks').where({ id: 's2' }).first();
    expect(s2.last_run_at).toBeNull();
    expect(executed).toBeGreaterThanOrEqual(0);
  });
});
