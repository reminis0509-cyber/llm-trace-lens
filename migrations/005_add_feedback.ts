import type { Knex } from 'knex';

/**
 * Migration: Add trace_feedback table for user feedback collection
 * Enables false positive/negative tracking and analytics
 */
export async function up(knex: Knex): Promise<void> {
  // Create trace_feedback table
  const hasTraceFeedbackTable = await knex.schema.hasTable('trace_feedback');
  if (!hasTraceFeedbackTable) {
    await knex.schema.createTable('trace_feedback', (table) => {
      table.string('id').primary();
      table.string('trace_id').notNullable();
      table.string('workspace_id').notNullable();
      table.string('feedback_type').notNullable(); // 'false_positive', 'false_negative', 'correct'
      table.text('reason'); // Optional explanation
      table.string('submitted_by'); // User identifier (optional)
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // Indexes
      table.index('trace_id');
      table.index('workspace_id');
      table.index('feedback_type');
      table.index(['workspace_id', 'feedback_type']);
      table.index(['workspace_id', 'created_at']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('trace_feedback');
}
