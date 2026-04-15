/**
 * POST /api/agent/contract-chat
 *
 * Server-Sent Events endpoint for the Contract-Based AI Clerk Runtime (β).
 *
 * Request body:
 *   {
 *     message: string,          // user free-text (1..2000 chars)
 *     conversation_id?: string  // reserved for future multi-turn
 *   }
 *
 * Response: `text/event-stream`. Each event is a single `data: <JSON>\n\n`
 * line whose payload matches the `AgentSseEvent` union. Stream terminates
 * with `data: [DONE]\n\n`.
 *
 * Auth: workspace (header / middleware). Free plan quota uses `agent_run`
 * action bucket (shared with existing ai_tools_usage table).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { enforceFreeQuota, resolveWorkspaceId } from '../tools/_shared.js';
import { getKnex } from '../../storage/knex-client.js';
import { executeContractAgent } from '../../agent/contract-agent.js';
import type { AgentSseEvent } from '../../agent/contract-agent.types.js';
import { getActiveBudget, getTodaySpend } from '../../agent/cost-guard.js';

const requestSchema = z.object({
  message: z
    .string()
    .min(1, 'メッセージを入力してください')
    .max(2000, 'メッセージは2000文字以内にしてください'),
  conversation_id: z.string().uuid().optional(),
});

/**
 * Load the first saved `user_business_info` row for the workspace, if any.
 * Used as the `companyInfo` passed to the planner / tool-input builder.
 */
async function loadCompanyInfo(
  workspaceId: string,
): Promise<Record<string, unknown> | undefined> {
  try {
    const db = getKnex();
    const row = await db('user_business_info')
      .where({ workspace_id: workspaceId })
      .orderBy('created_at', 'asc')
      .first();
    return row ? (row as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

export default async function contractChatRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/contract-chat', async (request, reply) => {
    // ── Auth ────────────────────────────────────────────────────────────
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) {
      return reply.code(401).send({ success: false, error: '認証が必要です' });
    }

    // ── Input validation ────────────────────────────────────────────────
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }

    // ── Free-plan quota ─────────────────────────────────────────────────
    const quota = await enforceFreeQuota(workspaceId, request);
    if (!quota.allowed) {
      return reply.code(402).send({
        success: false,
        error: quota.error,
        current: quota.current,
        limit: quota.limit,
      });
    }

    // ── Daily cost cap pre-check (reject before opening SSE) ────────────
    try {
      const budget = getActiveBudget();
      const spend = await getTodaySpend(workspaceId);
      if (spend.global >= budget.globalDailyCapUsd) {
        return reply.code(429).send({
          success: false,
          error: 'グローバルの本日のAPI予算上限に達しました。しばらくお待ちください。',
        });
      }
      if (spend.workspace >= budget.perWorkspaceDailyCapUsd) {
        return reply.code(429).send({
          success: false,
          error: 'このワークスペースの本日の利用上限に達しました。明日以降に再度お試しください。',
        });
      }
    } catch (err) {
      request.log.warn({ err }, 'cost-guard pre-check failed; proceeding');
    }

    const companyInfo = await loadCompanyInfo(workspaceId);

    // ── SSE headers ─────────────────────────────────────────────────────
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const writeEvent = (event: AgentSseEvent): void => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      for await (const event of executeContractAgent(fastify, {
        message: parsed.data.message,
        conversationId: parsed.data.conversation_id,
        workspaceId,
        companyInfo,
      })) {
        writeEvent(event);
      }
    } catch (err) {
      request.log.error({ err }, 'contract-chat runtime error');
      writeEvent({
        type: 'error',
        code: 'INTERNAL',
        message:
          err instanceof Error ? err.message : '内部エラーが発生しました。',
      });
    } finally {
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    }
    return reply;
  });
}
