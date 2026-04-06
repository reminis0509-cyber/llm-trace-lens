import type { Knex } from 'knex';

/**
 * Migration: Add hp_generations table for tracking HP generation abuse prevention.
 * Stores each HP generation event per workspace to enforce lifetime limits.
 */
export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('hp_generations');
  if (!exists) {
    await knex.schema.createTable('hp_generations', (table) => {
      table.string('id').primary();
      table.string('workspace_id').notNullable().index();
      table.string('template').notNullable();
      table.string('business_name').notNullable();
      table.string('chatbot_id').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('hp_generations');
}
