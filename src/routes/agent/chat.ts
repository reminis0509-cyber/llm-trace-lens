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
 * Auth: workspace (header / middleware). Pro plan only.
 * Rate limit: 20 req / hour / workspace.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { resolveWorkspaceId, isFreePlan } from '../tools/_shared.js';
import { executeClerk, ConversationAccessError } from '../../agent/clerk.js';

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

      // 2. Pro plan gate
      const free = await isFreePlan(workspaceId);
      if (free) {
        return reply.code(403).send({
          success: false,
          error: 'AI事務員はProプランの機能です。個別ツールは引き続きご利用いただけます。',
        });
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

      return reply.code(200).send({ success: true, data: result });

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
