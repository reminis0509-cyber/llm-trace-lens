import type { Knex } from 'knex';

/**
 * Migration 019 — Signup credit columns on workspace_settings.
 *
 * Adds persistent (DB-side) record of the initial ¥10,000 signup credit that
 * each newly-created workspace receives. The runtime balance/decrement path
 * uses KV (Upstash Redis) for atomicity; these DB columns provide:
 *   1. An audit trail of the original grant (amount + expiry).
 *   2. A fallback source-of-truth when KV is unavailable or rehydration is needed.
 *
 * Columns (on the existing `workspace_settings` table):
 *   - signup_credit_jpy        integer  default 0  not null
 *       Initial credit grant in JPY (integer yen, never fractional).
 *       Current balance lives in KV; this column records the original grant only.
 *   - signup_credit_expires_at timestamp (with tz on postgres)  nullable
 *       Credit expiry (now + 90 days at grant time). Null means "no credit granted".
 *
 * Non-destructive: additive columns only. `down()` drops the two columns.
 */
export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('workspace_settings');
  if (!hasTable) {
    // workspace_settings is created by migration 002; if it is missing the
    // DB is in a broken state — bail out rather than silently mis-install.
    throw new Error(
      'Migration 019 requires the workspace_settings table (migration 002). ' +
      'Run earlier migrations first.'
    );
  }

  const hasCreditCol = await knex.schema.hasColumn('workspace_settings', 'signup_credit_jpy');
  const hasExpiresCol = await knex.schema.hasColumn('workspace_settings', 'signup_credit_expires_at');

  if (!hasCreditCol || !hasExpiresCol) {
    await knex.schema.alterTable('workspace_settings', (table) => {
      if (!hasCreditCol) {
        table.integer('signup_credit_jpy').notNullable().defaultTo(0);
      }
      if (!hasExpiresCol) {
        table.timestamp('signup_credit_expires_at', { useTz: true }).nullable();
      }
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('workspace_settings');
  if (!hasTable) return;

  const hasCreditCol = await knex.schema.hasColumn('workspace_settings', 'signup_credit_jpy');
  const hasExpiresCol = await knex.schema.hasColumn('workspace_settings', 'signup_credit_expires_at');

  if (hasCreditCol || hasExpiresCol) {
    await knex.schema.alterTable('workspace_settings', (table) => {
      if (hasCreditCol) table.dropColumn('signup_credit_jpy');
      if (hasExpiresCol) table.dropColumn('signup_credit_expires_at');
    });
  }
}
