import type { Knex } from 'knex';

/**
 * Migration: Add workspace_id for multi-tenant support
 */
export async function up(knex: Knex): Promise<void> {
  // Add workspace_id column to traces table
  const hasWorkspaceId = await knex.schema.hasColumn('traces', 'workspace_id');
  if (!hasWorkspaceId) {
    await knex.schema.alterTable('traces', (table) => {
      table.string('workspace_id').defaultTo('default').index();
    });
  }

  // Create workspaces table
  const hasWorkspacesTable = await knex.schema.hasTable('workspaces');
  if (!hasWorkspacesTable) {
    await knex.schema.createTable('workspaces', (table) => {
      table.string('id').primary();
      table.string('name').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  // Create api_keys table
  const hasApiKeysTable = await knex.schema.hasTable('api_keys');
  if (!hasApiKeysTable) {
    await knex.schema.createTable('api_keys', (table) => {
      table.string('key').primary();
      table.string('workspace_id').notNullable().references('id').inTable('workspaces');
      table.string('name');
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('last_used_at');
      table.index('workspace_id');
    });
  }

  // Create workspace_users table
  const hasWorkspaceUsersTable = await knex.schema.hasTable('workspace_users');
  if (!hasWorkspaceUsersTable) {
    await knex.schema.createTable('workspace_users', (table) => {
      table.string('id').primary();
      table.string('workspace_id').notNullable().references('id').inTable('workspaces');
      table.string('email').notNullable();
      table.string('role').defaultTo('member');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['workspace_id', 'email']);
      table.index('workspace_id');
      table.index('email');
    });
  }

  // Create workspace_settings table
  const hasWorkspaceSettingsTable = await knex.schema.hasTable('workspace_settings');
  if (!hasWorkspaceSettingsTable) {
    await knex.schema.createTable('workspace_settings', (table) => {
      table.string('workspace_id').primary().references('id').inTable('workspaces');
      table.decimal('monthly_budget', 10, 2);
      table.json('alert_thresholds');
      table.string('notification_email');
      table.boolean('report_enabled').defaultTo(false);
      table.json('custom_validation_patterns');
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  // Create default workspace
  const defaultWorkspace = await knex('workspaces').where('id', 'default').first();
  if (!defaultWorkspace) {
    await knex('workspaces').insert({
      id: 'default',
      name: 'Default Workspace',
      created_at: new Date(),
      updated_at: new Date()
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order of creation
  await knex.schema.dropTableIfExists('workspace_settings');
  await knex.schema.dropTableIfExists('workspace_users');
  await knex.schema.dropTableIfExists('api_keys');
  await knex.schema.dropTableIfExists('workspaces');

  // Remove workspace_id column from traces
  const hasWorkspaceId = await knex.schema.hasColumn('traces', 'workspace_id');
  if (hasWorkspaceId) {
    await knex.schema.alterTable('traces', (table) => {
      table.dropColumn('workspace_id');
    });
  }
}
