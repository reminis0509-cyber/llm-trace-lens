import type { Knex } from 'knex';

/**
 * Migration: Add `agent_run_costs` table.
 *
 * Tracks per-run LLM cost (USD) for the Contract-Based AI Clerk Runtime.
 * Used by `src/agent/cost-guard.ts` to enforce three caps:
 *   - per-run cap (safety net against runaway plans)
 *   - per-workspace daily cap (prevents a single tenant from burning budget)
 *   - global daily cap (protects the Founder investment guardrail)
 *
 * `run_id` is unique so recordSpend() is idempotent.
 */
export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('agent_run_costs');
  if (exists) return;

  await knex.schema.createTable('agent_run_costs', (table) => {
    table.string('id').primary();
    table.string('workspace_id').notNullable().index();
    table.string('run_id').notNullable().unique();
    table.decimal('usd_cost', 12, 6).notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()).index();
  });
}

/**
 * DESTRUCTIVE: drops the agent_run_costs table.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('agent_run_costs');
}
