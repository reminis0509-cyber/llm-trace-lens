import type { Knex } from 'knex';

/**
 * Migration 018 — External API keys (user-scoped programmatic access).
 *
 * A user can mint any number of API keys; each carries a prefix (for display)
 * and a SHA-256 hash of the secret (the raw secret is NEVER stored).
 *
 * DESTRUCTIVE: the `down()` migration drops the table and all keys.
 */
export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('api_keys')) return;
  await knex.schema.createTable('api_keys', (table) => {
    table.string('id').primary();
    table.string('user_id').notNullable();
    table.string('workspace_id').nullable();
    table.string('name').notNullable();
    /** First 8 characters of the raw key, for UI display ("fjk_abcd…"). */
    table.string('prefix').notNullable();
    /** SHA-256 hex digest of the raw key. */
    table.string('key_hash').notNullable().unique();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('last_used_at').nullable();
    table.boolean('revoked').notNullable().defaultTo(false);
    table.index(['user_id'], 'api_keys_user_idx');
    table.index(['key_hash'], 'api_keys_hash_idx');
  });
}

/**
 * DESTRUCTIVE: drops the api_keys table.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('api_keys');
}
