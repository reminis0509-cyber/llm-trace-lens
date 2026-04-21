import type { Knex } from 'knex';

/**
 * Migration 016 — Team/Enterprise workspace_id scope on v1+v2 AI Employee tables.
 *
 * Spec source: Takeshi CEO "AI社員 v2 Full Manus TTP" block 5 (2026-04-20).
 * Adds a nullable `workspace_id` column (or makes use of the existing one)
 * on every AI-Employee-scoped table so Team/Enterprise plans can share
 * state across workspace members.
 *
 * Backfill: for each table, new columns are added nullable so existing
 * single-user rows remain valid. Route-layer code is responsible for
 * widening queries only when `getWorkspacePlan()` returns a Team/Enterprise
 * plan.
 *
 * DESTRUCTIVE: the `down()` migration drops the newly added columns.
 * Existing rows retain their `user_id`-only scope and continue to work.
 */
export async function up(knex: Knex): Promise<void> {
  // ai_employee_memory
  if (!(await knex.schema.hasColumn('ai_employee_memory', 'workspace_id'))) {
    await knex.schema.alterTable('ai_employee_memory', (table) => {
      table.string('workspace_id').nullable();
      table.index(['workspace_id', 'key'], 'ai_employee_memory_ws_key_idx');
    });
  }

  // task_timeline
  if (!(await knex.schema.hasColumn('task_timeline', 'workspace_id'))) {
    await knex.schema.alterTable('task_timeline', (table) => {
      table.string('workspace_id').nullable();
      table.index(['workspace_id', 'created_at'], 'task_timeline_ws_created_idx');
    });
  }

  // connector_tokens
  if (!(await knex.schema.hasColumn('connector_tokens', 'workspace_id'))) {
    await knex.schema.alterTable('connector_tokens', (table) => {
      table.string('workspace_id').nullable();
      table.index(['workspace_id', 'provider'], 'connector_tokens_ws_provider_idx');
    });
  }

  // scheduled_tasks: already has workspace_id (created in 015) but add index.
  if (await knex.schema.hasTable('scheduled_tasks')) {
    if (!(await knex.schema.hasColumn('scheduled_tasks', 'workspace_id'))) {
      await knex.schema.alterTable('scheduled_tasks', (table) => {
        table.string('workspace_id').nullable();
      });
    }
  }

  // projects: already created with workspace_id in 014. Add index for lookup.
  // (Index already created in 014; nothing to do here for projects.)
}

/**
 * DESTRUCTIVE: drops the workspace_id columns (and their indexes) that
 * migration 016 added. Rows are preserved.
 */
export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('connector_tokens', 'workspace_id')) {
    await knex.schema.alterTable('connector_tokens', (table) => {
      table.dropIndex(['workspace_id', 'provider'], 'connector_tokens_ws_provider_idx');
      table.dropColumn('workspace_id');
    });
  }
  if (await knex.schema.hasColumn('task_timeline', 'workspace_id')) {
    await knex.schema.alterTable('task_timeline', (table) => {
      table.dropIndex(['workspace_id', 'created_at'], 'task_timeline_ws_created_idx');
      table.dropColumn('workspace_id');
    });
  }
  if (await knex.schema.hasColumn('ai_employee_memory', 'workspace_id')) {
    await knex.schema.alterTable('ai_employee_memory', (table) => {
      table.dropIndex(['workspace_id', 'key'], 'ai_employee_memory_ws_key_idx');
      table.dropColumn('workspace_id');
    });
  }
}
