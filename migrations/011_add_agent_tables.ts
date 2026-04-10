import type { Knex } from 'knex';

/**
 * Migration: Add AI 事務員 (AI Clerk) tables.
 *
 * - agent_conversations: stores chat history per workspace for multi-turn agent sessions.
 * - feature_requests: "欲望データベース" — logs unmatched or adapted tool requests
 *   so the product team can prioritize which tools to build next.
 */
export async function up(knex: Knex): Promise<void> {
  const hasConversations = await knex.schema.hasTable('agent_conversations');
  if (!hasConversations) {
    await knex.schema.createTable('agent_conversations', (table) => {
      table.string('id').primary();
      table.string('workspace_id').notNullable().index();
      table.text('messages').notNullable(); // JSON-serialized array of messages
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  const hasFeatureRequests = await knex.schema.hasTable('feature_requests');
  if (!hasFeatureRequests) {
    await knex.schema.createTable('feature_requests', (table) => {
      table.string('id').primary();
      table.string('workspace_id').notNullable().index();
      table.text('user_message').notNullable();
      table.string('matched_tool').nullable();
      table.string('match_type').notNullable(); // 'exact' | 'adapted' | 'none'
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
}

/**
 * DESTRUCTIVE: drops agent_conversations and feature_requests tables.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('feature_requests');
  await knex.schema.dropTableIfExists('agent_conversations');
}
