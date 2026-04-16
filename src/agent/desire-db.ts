/**
 * FujiTrace AI 事務員 — 欲望データベース (Feature Request Logger).
 *
 * Logs user requests that could not be matched to an existing tool (match_type 'none')
 * or required adaptation (match_type 'adapted'). This data drives product decisions
 * about which tools to build next.
 */
import crypto from 'crypto';
import { getKnex } from '../storage/knex-client.js';

let agentTablesReady = false;

/**
 * Ensure agent_conversations and feature_requests tables exist.
 * Safety net for environments where migration 011 has not been run.
 * Subsequent calls after the first success are no-ops.
 */
export async function ensureAgentTables(): Promise<void> {
  if (agentTablesReady) return;
  const db = getKnex();

  const hasConversations = await db.schema.hasTable('agent_conversations');
  if (!hasConversations) {
    await db.schema.createTable('agent_conversations', (table) => {
      table.string('id').primary();
      table.string('workspace_id').notNullable().index();
      table.text('messages').notNullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
  }

  const hasFeatureRequests = await db.schema.hasTable('feature_requests');
  if (!hasFeatureRequests) {
    await db.schema.createTable('feature_requests', (table) => {
      table.string('id').primary();
      table.string('workspace_id').notNullable().index();
      table.text('user_message').notNullable();
      table.string('matched_tool').nullable();
      table.string('match_type').notNullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  const hasWorkspaceMemory = await db.schema.hasTable('workspace_memory');
  if (!hasWorkspaceMemory) {
    await db.schema.createTable('workspace_memory', (table) => {
      table.text('id').primary();
      table.text('workspace_id').notNullable().unique();
      table.text('content').notNullable().defaultTo('');
      table.text('updated_at').notNullable();
    });
  }

  agentTablesReady = true;
}

/**
 * Log a feature request to the 欲望データベース.
 */
export async function logFeatureRequest(
  workspaceId: string,
  userMessage: string,
  matchedTool: string | null,
  matchType: 'exact' | 'adapted' | 'none',
): Promise<void> {
  await ensureAgentTables();
  const db = getKnex();
  await db('feature_requests').insert({
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    user_message: userMessage,
    matched_tool: matchedTool,
    match_type: matchType,
    created_at: new Date().toISOString(),
  });
}
