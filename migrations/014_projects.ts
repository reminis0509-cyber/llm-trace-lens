import type { Knex } from 'knex';

/**
 * Migration 014 — AI Employee v2 Projects (永続ワークスペース束ね).
 *
 * Spec source: Takeshi CEO "AI社員 v2 Full Manus TTP" (2026-04-20).
 * Projects represent a persistent session context — instructions, reference
 * files, explicit connector attachments, and recent task history.
 *
 * Also adds `project_id` nullable columns to existing v1 tables
 * `ai_employee_memory` and `task_timeline` so downstream code can optionally
 * scope by project.
 *
 * TABLES:
 *   - projects            : id, workspace_id, user_id, name, instructions
 *   - project_files       : id, project_id, filename, mime_type, content_base64, size
 *   - project_connectors  : project_id + provider pair (many-to-many)
 *
 * DESTRUCTIVE: the `down()` migration drops all three new tables AND removes
 * the `project_id` columns added to `ai_employee_memory` / `task_timeline`.
 */
export async function up(knex: Knex): Promise<void> {
  // -------------------------------------------------------------------------
  // projects
  // -------------------------------------------------------------------------
  if (!(await knex.schema.hasTable('projects'))) {
    await knex.schema.createTable('projects', (table) => {
      table.string('id').primary();
      table.string('workspace_id').nullable();
      table.string('user_id').notNullable();
      table.string('name').notNullable();
      // Markdown instructions ("always do X, address invoices to Y") — nullable
      table.text('instructions').nullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.index(['user_id', 'created_at'], 'projects_user_created_idx');
      table.index(['workspace_id'], 'projects_workspace_idx');
    });
  }

  // -------------------------------------------------------------------------
  // project_files
  // -------------------------------------------------------------------------
  if (!(await knex.schema.hasTable('project_files'))) {
    await knex.schema.createTable('project_files', (table) => {
      table.string('id').primary();
      table.string('project_id').notNullable();
      table.string('filename').notNullable();
      table.string('mime_type').notNullable();
      // base64 for small files (< 10MB cap enforced at route layer). Large files
      // will flow through `storage_ref` when the object storage layer lands.
      table.text('content_base64').nullable();
      table.string('storage_ref').nullable();
      table.integer('size').notNullable().defaultTo(0);
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.index(['project_id'], 'project_files_project_idx');
    });
  }

  // -------------------------------------------------------------------------
  // project_connectors
  // -------------------------------------------------------------------------
  if (!(await knex.schema.hasTable('project_connectors'))) {
    await knex.schema.createTable('project_connectors', (table) => {
      table.string('project_id').notNullable();
      table.string('provider').notNullable();
      table.timestamp('attached_at').notNullable().defaultTo(knex.fn.now());
      table.primary(['project_id', 'provider']);
    });
  }

  // -------------------------------------------------------------------------
  // ai_employee_memory: add project_id
  // -------------------------------------------------------------------------
  const hasMemProjectId = await knex.schema.hasColumn('ai_employee_memory', 'project_id');
  if (!hasMemProjectId) {
    await knex.schema.alterTable('ai_employee_memory', (table) => {
      table.string('project_id').nullable();
    });
  }

  // -------------------------------------------------------------------------
  // task_timeline: add project_id
  // -------------------------------------------------------------------------
  const hasTaskProjectId = await knex.schema.hasColumn('task_timeline', 'project_id');
  if (!hasTaskProjectId) {
    await knex.schema.alterTable('task_timeline', (table) => {
      table.string('project_id').nullable();
    });
  }
}

/**
 * DESTRUCTIVE: drops three tables and removes two nullable columns.
 */
export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('task_timeline', 'project_id')) {
    await knex.schema.alterTable('task_timeline', (table) => {
      table.dropColumn('project_id');
    });
  }
  if (await knex.schema.hasColumn('ai_employee_memory', 'project_id')) {
    await knex.schema.alterTable('ai_employee_memory', (table) => {
      table.dropColumn('project_id');
    });
  }
  await knex.schema.dropTableIfExists('project_connectors');
  await knex.schema.dropTableIfExists('project_files');
  await knex.schema.dropTableIfExists('projects');
}
