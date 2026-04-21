import type { Knex } from 'knex';

/**
 * Migration 015 — AI Employee v2 scheduled tasks (cron-backed runner).
 *
 * Rows describe a recurring or one-shot workload that the in-process
 * scheduler (`src/scheduler/runner.ts`) picks up every 60 seconds.
 *
 * Columns:
 *   - cron_expr   : 5-field cron ("0 9 * * 1-5") parsed by `cron-parser`
 *   - task_spec   : JSON { taskType, params } — tells the runner what to do
 *   - next_run_at : next fire time (updated after each run)
 *   - last_run_at : nullable until first run
 *
 * DESTRUCTIVE: the `down()` migration drops the table.
 */
export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('scheduled_tasks')) return;
  await knex.schema.createTable('scheduled_tasks', (table) => {
    table.string('id').primary();
    table.string('user_id').notNullable();
    table.string('workspace_id').nullable();
    table.string('project_id').nullable();
    table.string('name').notNullable();
    table.string('cron_expr').notNullable();
    // Full JSON payload: { taskType: string, params: Record<string, unknown> }
    table.json('task_spec').notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.timestamp('next_run_at').nullable();
    table.timestamp('last_run_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index(['next_run_at'], 'scheduled_tasks_next_run_idx');
    table.index(['user_id', 'enabled'], 'scheduled_tasks_user_enabled_idx');
  });
}

/**
 * DESTRUCTIVE: drops the scheduled_tasks table and its data.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('scheduled_tasks');
}
