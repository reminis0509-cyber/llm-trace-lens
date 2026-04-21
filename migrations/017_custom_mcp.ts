import type { Knex } from 'knex';

/**
 * Migration 017 — Custom MCP servers (user-registered MCP endpoints).
 *
 * Allows users to register their own MCP-compatible HTTP endpoints so the
 * AI Employee runtime can invoke internal tools that aren't in the core
 * connector registry. The auth header (if any) is encrypted with the same
 * token-crypto helper we use for OAuth tokens.
 *
 * DESTRUCTIVE: the `down()` migration drops the table.
 */
export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('custom_mcp_servers')) return;
  await knex.schema.createTable('custom_mcp_servers', (table) => {
    table.string('id').primary();
    table.string('user_id').notNullable();
    table.string('workspace_id').nullable();
    table.string('name').notNullable();
    table.string('url').notNullable();
    // AES-256-GCM envelope, nullable (server may require no auth)
    table.text('auth_header_encrypted').nullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['user_id'], 'custom_mcp_servers_user_idx');
  });
}

/**
 * DESTRUCTIVE: drops the custom_mcp_servers table.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('custom_mcp_servers');
}
