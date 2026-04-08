import type { Knex } from 'knex';

/**
 * Migration: Add AI Tools tables.
 *
 * - user_business_info: stores business profile per workspace (used by AI見積書作成 etc).
 * - ai_tools_usage: tracks tool invocations per workspace for free-tier quota & analytics.
 *
 * NOTE: This project uses workspace_id as the tenant boundary (not auth.users FK).
 *       The original meta-prompt references Supabase auth.users, but we follow the
 *       existing Knex/workspace pattern (see hp_generations) for consistency.
 */
export async function up(knex: Knex): Promise<void> {
  const hasBusinessInfo = await knex.schema.hasTable('user_business_info');
  if (!hasBusinessInfo) {
    await knex.schema.createTable('user_business_info', (table) => {
      table.string('id').primary();
      table.string('workspace_id').notNullable().index();
      table.string('company_name').notNullable();
      table.string('address').nullable();
      table.string('phone').nullable();
      table.string('email').nullable();
      table.string('invoice_number').nullable(); // T + 13 digits
      table.string('bank_name').nullable();
      table.string('bank_branch').nullable();
      table.string('account_type').nullable();
      table.string('account_number').nullable();
      table.string('account_holder').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  const hasUsage = await knex.schema.hasTable('ai_tools_usage');
  if (!hasUsage) {
    await knex.schema.createTable('ai_tools_usage', (table) => {
      table.string('id').primary();
      table.string('workspace_id').notNullable().index();
      table.string('tool_name').notNullable(); // 'estimate' | 'invoice' | ...
      table.string('action').notNullable();    // 'create' | 'check' | 'pdf'
      table.string('trace_id').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now()).index();
    });
  }
}

/**
 * DESTRUCTIVE: drops user_business_info and ai_tools_usage tables.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ai_tools_usage');
  await knex.schema.dropTableIfExists('user_business_info');
}
