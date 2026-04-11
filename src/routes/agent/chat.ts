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
import type { MultipartValue } from '@fastify/multipart';
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

      // 3. Parse input (JSON or multipart/form-data with file)
      const contentType = request.headers['content-type'] || '';
      let message = '';
      let conversationId: string | undefined;
      let imageBase64: string | undefined;
      let imageMimeType: string | undefined;

      if (contentType.includes('multipart/form-data')) {
        const data = await request.file();
        if (!data) {
          return reply.code(400).send({ success: false, error: 'ファイルが見つかりません' });
        }

        const buffer = await data.toBuffer();

        // File size check: 5MB limit for Vercel compatibility
        if (buffer.length > 5 * 1024 * 1024) {
          return reply.code(413).send({ success: false, error: 'ファイルサイズは5MB以下にしてください' });
        }

        // Extract form fields from the multipart data
        const messageField = data.fields.message as MultipartValue<string> | undefined;
        const convIdField = data.fields.conversation_id as MultipartValue<string> | undefined;

        message = messageField?.type === 'field' ? messageField.value : '';
        conversationId = convIdField?.type === 'field' && convIdField.value
          ? convIdField.value
          : undefined;

        const fileName = data.filename;
        const ext = fileName?.split('.').pop()?.toLowerCase() || '';
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

        if (imageExts.includes(ext)) {
          // Image: pass as base64 for GPT-4o Vision
          imageBase64 = buffer.toString('base64');
          imageMimeType = data.mimetype || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        } else {
          // Text/CSV/PDF: extract text and prepend to message
          const { extractText } = await import('../../chatbot/rag/chunker.js');
          const allowedTextExts = ['pdf', 'txt', 'csv', 'json'];
          const fileType = allowedTextExts.includes(ext) ? ext : 'txt';
          const extractedText = await extractText(buffer, fileType);

          const fileContext = `[添付ファイル: ${fileName}]\n${extractedText}`;
          message = message.trim()
            ? `${fileContext}\n\n[依頼]\n${message.trim()}`
            : fileContext;
        }

        if (!message.trim() && !imageBase64) {
          return reply.code(400).send({ success: false, error: 'メッセージまたはファイルを入力してください' });
        }
      } else {
        // Existing JSON handling
        const parsed = requestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            error: parsed.error.issues.map((i) => i.message).join('; '),
          });
        }
        message = parsed.data.message;
        conversationId = parsed.data.conversation_id;
      }

      // Validate message length for multipart path (JSON path uses Zod)
      if (message.length > 50000) {
        return reply.code(400).send({
          success: false,
          error: '入力が長すぎます。ファイル内容を含めて50000文字以内にしてください。',
        });
      }

      // 4. Execute agent
      const result = await executeClerk(fastify, {
        conversationId,
        message,
        workspaceId,
        imageBase64,
        imageMimeType,
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
