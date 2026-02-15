import type { Knex } from 'knex';

/**
 * Migration: Add workspace_costs table for cost tracking per workspace
 */
export async function up(knex: Knex): Promise<void> {
  // Create workspace_costs table
  const hasWorkspaceCostsTable = await knex.schema.hasTable('workspace_costs');
  if (!hasWorkspaceCostsTable) {
    await knex.schema.createTable('workspace_costs', (table) => {
      table.increments('id').primary();
      table.string('workspace_id').notNullable();
      table.string('month').notNullable(); // YYYY-MM format
      table.string('provider').notNullable();
      table.string('model').notNullable();
      table.integer('cost_cents').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Unique constraint for upsert
      table.unique(['workspace_id', 'month', 'provider', 'model']);

      // Indexes
      table.index('workspace_id');
      table.index('month');
    });
  }

  // Create workspace_settings_kv table for key-value settings
  const hasWorkspaceSettingsKvTable = await knex.schema.hasTable('workspace_settings_kv');
  if (!hasWorkspaceSettingsKvTable) {
    await knex.schema.createTable('workspace_settings_kv', (table) => {
      table.string('workspace_id').notNullable();
      table.string('key').notNullable();
      table.json('value');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.primary(['workspace_id', 'key']);
      table.index('workspace_id');
    });
  }

  // Add more columns to traces table if needed
  const hasProviderColumn = await knex.schema.hasColumn('traces', 'provider');
  if (!hasProviderColumn) {
    await knex.schema.alterTable('traces', (table) => {
      table.string('provider').defaultTo('openai');
    });
  }

  const hasPromptColumn = await knex.schema.hasColumn('traces', 'prompt');
  if (!hasPromptColumn) {
    await knex.schema.alterTable('traces', (table) => {
      table.text('prompt');
    });
  }

  const hasValidationResultsColumn = await knex.schema.hasColumn('traces', 'validation_results');
  if (!hasValidationResultsColumn) {
    await knex.schema.alterTable('traces', (table) => {
      table.json('validation_results');
    });
  }

  const hasUsageColumn = await knex.schema.hasColumn('traces', 'usage');
  if (!hasUsageColumn) {
    await knex.schema.alterTable('traces', (table) => {
      table.json('usage');
    });
  }

  const hasEstimatedCostColumn = await knex.schema.hasColumn('traces', 'estimated_cost');
  if (!hasEstimatedCostColumn) {
    await knex.schema.alterTable('traces', (table) => {
      table.decimal('estimated_cost', 10, 6);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('workspace_settings_kv');
  await knex.schema.dropTableIfExists('workspace_costs');

  // Remove added columns from traces
  const columns = ['provider', 'prompt', 'validation_results', 'usage', 'estimated_cost'];
  for (const column of columns) {
    const hasColumn = await knex.schema.hasColumn('traces', column);
    if (hasColumn) {
      await knex.schema.alterTable('traces', (table) => {
        table.dropColumn(column);
      });
    }
  }
}
