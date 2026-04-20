import type { Knex } from 'knex';

/**
 * Migration 013 — AI Employee v1 workspace tables.
 *
 * Spec source: Takeshi CEO "AI Employee v1 backend skeleton" (2026-04-20).
 * See memory: `vision_ai_employee.md` for architectural context (Projects +
 * MCP connector structure, Japan-business-localized TTP of Manus AI).
 *
 * Creates four user-scoped tables that together form the persistent
 * Workspace layer described in the 3-layer architecture (Workspace /
 * Runtime / Connector).
 *
 * NAMING NOTE:
 *   The spec asked for a table literally called `workspace_memory`, but
 *   migration 011 already created a `workspace_memory` table with a
 *   workspace-id-scoped single-`content` shape used by the existing
 *   AI Clerk UI (`src/routes/agent/memory.ts`). That table has a UNIQUE
 *   constraint on `workspace_id`, which is structurally incompatible with
 *   the new user-scoped `(user_id, key) -> jsonb value` shape required
 *   here. To avoid breaking the existing clerk memory feature we name the
 *   new table `ai_employee_memory`. The behaviour and column set match the
 *   spec exactly; only the table name differs.
 *
 * TABLES:
 *   - ai_employee_memory     : user-scoped key/value persistent memory
 *   - task_timeline          : all tasks (briefing source, Kanban source)
 *   - connector_tokens       : OAuth tokens (encrypted at rest, AES-256-GCM)
 *   - oauth_states           : CSRF state tokens (10-minute TTL)
 *
 * DESTRUCTIVE: the `down()` migration drops all four tables and their data.
 */
export async function up(knex: Knex): Promise<void> {
  // -------------------------------------------------------------------------
  // ai_employee_memory
  // -------------------------------------------------------------------------
  const hasMemory = await knex.schema.hasTable('ai_employee_memory');
  if (!hasMemory) {
    await knex.schema.createTable('ai_employee_memory', (table) => {
      table.string('id').primary();
      table.string('user_id').notNullable();
      table.string('key').notNullable();
      // JSON stored as TEXT on sqlite, JSONB on postgres (Knex picks the
      // best available backing type).
      table.json('value').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.unique(['user_id', 'key']);
    });
  }

  // -------------------------------------------------------------------------
  // task_timeline
  // -------------------------------------------------------------------------
  const hasTasks = await knex.schema.hasTable('task_timeline');
  if (!hasTasks) {
    await knex.schema.createTable('task_timeline', (table) => {
      table.string('id').primary();
      table.string('user_id').notNullable();
      // enum: estimate | invoice | delivery | purchase_order | cover_letter | other
      table.string('task_type').notNullable();
      table.string('title').notNullable();
      // enum: pending | in_progress | done | failed
      table.string('status').notNullable().defaultTo('pending');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('completed_at').nullable();
      // optional link to a trace id (for the Runtime layer's trace)
      table.string('result_ref').nullable();
      // optional JSON hint describing which connectors were touched
      table.json('connector_refs').nullable();
      table.index(['user_id', 'created_at'], 'task_timeline_user_created_idx');
    });
  }

  // -------------------------------------------------------------------------
  // connector_tokens
  // -------------------------------------------------------------------------
  const hasConnectorTokens = await knex.schema.hasTable('connector_tokens');
  if (!hasConnectorTokens) {
    await knex.schema.createTable('connector_tokens', (table) => {
      table.string('id').primary();
      table.string('user_id').notNullable();
      // enum: google | chatwork | slack | freee | drive
      table.string('provider').notNullable();
      // AES-256-GCM encrypted envelope (see src/lib/token-crypto.ts)
      table.text('access_token').notNullable();
      table.text('refresh_token').nullable();
      table.timestamp('expires_at').nullable();
      table.json('scopes').nullable();
      table.timestamp('connected_at').notNullable().defaultTo(knex.fn.now());
      table.unique(['user_id', 'provider']);
    });
  }

  // -------------------------------------------------------------------------
  // oauth_states
  // -------------------------------------------------------------------------
  const hasOauthStates = await knex.schema.hasTable('oauth_states');
  if (!hasOauthStates) {
    await knex.schema.createTable('oauth_states', (table) => {
      table.string('id').primary();
      table.string('state').notNullable().unique();
      table.string('user_id').notNullable();
      // enum: google | chatwork | slack | freee | drive
      table.string('provider').notNullable();
      table.string('redirect_uri').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      // Index used by the (future) cron to prune >10min rows.
      table.index(['created_at'], 'oauth_states_created_idx');
    });
  }
}

/**
 * DESTRUCTIVE: drops all AI Employee v1 tables and their data.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('oauth_states');
  await knex.schema.dropTableIfExists('connector_tokens');
  await knex.schema.dropTableIfExists('task_timeline');
  await knex.schema.dropTableIfExists('ai_employee_memory');
}
