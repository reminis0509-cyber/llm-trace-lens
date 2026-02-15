import type { Knex } from 'knex';

/**
 * Migration: Add validation_configs table for workspace-specific validation settings
 * This supports threshold blackboxing by storing scoring weights and risk levels per workspace
 */
export async function up(knex: Knex): Promise<void> {
  // Create validation_configs table
  const hasValidationConfigsTable = await knex.schema.hasTable('validation_configs');
  if (!hasValidationConfigsTable) {
    await knex.schema.createTable('validation_configs', (table) => {
      table.string('id').primary();
      table.string('workspace_id').notNullable();
      table.string('config_type').notNullable(); // 'threshold', 'scoring_weights', 'risk_levels'
      table.json('config_data').notNullable(); // JSON object with config values
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Unique constraint: one config per type per workspace
      table.unique(['workspace_id', 'config_type']);

      // Indexes
      table.index('workspace_id');
      table.index('config_type');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('validation_configs');
}
