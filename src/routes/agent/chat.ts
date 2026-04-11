/**
 * POST /api/agent/chat
 *
 * FujiTrace AI 事務員 chat endpoint.
 *
 * Request:
 *   {
 *     conversation_id?: string,  // omit to start a new conversation
 *     message: string            // user message (max 2000 chars)
 *   }
 *
 * Response (200):
 *   {
 *     success: true,
 *     data: {
 *       conversationId: string,
 *       reply: string,
 *       toolCall?: { toolName, matchType, adaptedFrom?, result },
 *       featureRequestLogged?: boolean,
 *       traceId: string | null
 *     }
 *   }
 *
 * Auth: workspace (header / middleware).
 * Billing: 3 free trials per workspace, then ¥10/use (402 when exhausted).
 * Rate limit: 20 req / hour / workspace.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { resolveWorkspaceId } from '../tools/_shared.js';
import { executeClerk, ConversationAccessError } from '../../agent/clerk.js';
import { enforceAgentBilling, getTrialStatus, AGENT_FREE_TRIAL_LIMIT } from '../../agent/trial.js';

const requestSchema = z.object({
  conversation_id: z.string().uuid().optional(),
  message: z.string().min(1, 'メッセージを入力してください').max(2000, 'メッセージは2000文字以内にしてください'),
});

export default async function agentChatRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/agent/chat', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 hour',
        keyGenerator: async (request: FastifyRequest) => {
          const workspaceId = await resolveWorkspaceId(request);
          return workspaceId ? `agent:ws:${workspaceId}` : `agent:ip:${request.ip}`;
        },
        errorResponseBuilder: () => ({
          success: false,
          error: 'リクエスト制限を超えました。しばらくお待ちください。',
        }),
      },
    },
  }, async (request, reply) => {
    try {
      // 1. Auth / workspace
      const workspaceId = await resolveWorkspaceId(request);
      if (!workspaceId) {
        return reply.code(401).send({ success: false, error: '認証が必要です' });
      }

      // 2. Trial / billing gate (admin bypass)
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
      const userEmail = (request.user?.email || '').toLowerCase();
      const isAdmin = userEmail !== '' && adminEmails.includes(userEmail);
      if (!isAdmin) {
        const billing = await enforceAgentBilling(workspaceId);
        if (!billing.allowed) {
          return reply.code(402).send({
            success: false,
            error: billing.error,
            trialInfo: billing.trialInfo,
          });
        }
      }

      // 3. Validate input
      const parsed = requestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join('; '),
        });
      }

      // 4. Execute agent
      const result = await executeClerk(fastify, {
        conversationId: parsed.data.conversation_id,
        message: parsed.data.message,
        workspaceId,
      });

      // Get updated trial info (usage was recorded inside executeClerk)
      const trialInfo = isAdmin
        ? { used: 0, limit: AGENT_FREE_TRIAL_LIMIT, remaining: AGENT_FREE_TRIAL_LIMIT, isTrialExhausted: false }
        : await getTrialStatus(workspaceId);

      return reply.code(200).send({ success: true, data: { ...result, trialInfo } });

    } catch (error: unknown) {
      if (error instanceof ConversationAccessError) {
        return reply.code(403).send({ success: false, error: error.message });
      }
      request.log.error(error, 'Agent chat error');
      return reply.code(500).send({
        success: false,
        error: '内部エラーが発生しました。しばらくしてからお試しください。',
      });
    }
  });
}
