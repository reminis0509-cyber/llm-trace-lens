/**
 * POST /api/tools/estimate/create
 *
 * Generate an 見積書 draft from a multi-turn conversation.
 *
 * Request:
 *   {
 *     conversation_history: Array<{ role: 'user' | 'assistant', content: string }>,
 *     business_info_id: string
 *   }
 *
 * Response (200):
 *   {
 *     estimate: EstimateData,
 *     next_question?: string,
 *     trace_id: string
 *   }
 *
 * Auth: workspace (header / middleware).
 * Rate limit: 10 req / hour / workspace.
 * Free plan: 10 ai_tools_usage events / month / workspace.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getKnex } from '../../storage/knex-client.js';
import {
  resolveWorkspaceId,
  loadPromptTemplate,
  renderTemplate,
  enforceFreeQuota,
  recordUsage,
  callLlmViaProxy,
  parseLlmJson,
  ensureAiToolsTables,
} from './_shared.js';
import type { EstimateData, BusinessInfoRecord } from '../../types/ai-tools.js';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
});

const requestSchema = z.object({
  conversation_history: z.array(messageSchema).min(1).max(50),
  business_info_id: z.string().min(1),
});

interface CreateLlmOutput {
  estimate?: EstimateData;
  next_question?: string | null;
}

export default async function estimateCreateRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/tools/estimate/create', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 hour',
        keyGenerator: async (request: FastifyRequest) => {
          // Use resolved workspaceId so X-User-Email header cannot be used
          // to bypass the limit by supplying arbitrary values (QA H-2).
          const workspaceId = await resolveWorkspaceId(request);
          return workspaceId ? `ws:${workspaceId}` : `ip:${request.ip}`;
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

      // 2. Validate input
      const parsed = requestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: '入力が不正です',
          details: parsed.error.errors,
        });
      }
      const { conversation_history, business_info_id } = parsed.data;

      // 3. Free-plan quota check
      const quota = await enforceFreeQuota(workspaceId);
      if (!quota.allowed) {
        return reply.code(429).send({ success: false, error: quota.error });
      }

      // 4. Load business info (must belong to workspace)
      await ensureAiToolsTables();
      const db = getKnex();
      const businessInfo = await db<BusinessInfoRecord>('user_business_info')
        .where({ id: business_info_id, workspace_id: workspaceId })
        .first();
      if (!businessInfo) {
        return reply.code(404).send({
          success: false,
          error: '事業情報が見つかりません。先に事業情報を登録してください。',
        });
      }

      // 5. Build prompt
      const template = loadPromptTemplate('estimate/create.md');
      const today = new Date().toISOString().slice(0, 10);
      const systemPrompt = renderTemplate(template, {
        business_info_json: JSON.stringify(businessInfo, null, 2),
        conversation_history: JSON.stringify(conversation_history, null, 2),
        today,
      });

      // The conversation_history is also fed in as user/assistant turns so the
      // model can continue the dialog naturally if more info is needed.
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...conversation_history.map((m) => ({ role: m.role, content: m.content })),
      ];

      // 6. Call LLM via FujiTrace proxy (auto-traced)
      const llm = await callLlmViaProxy(fastify, messages, {
        model: process.env.AI_TOOLS_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        maxTokens: 2048,
      });

      // 7. Parse LLM JSON
      let output: CreateLlmOutput;
      try {
        output = parseLlmJson<CreateLlmOutput>(llm.content);
      } catch (parseErr) {
        request.log.error({ parseErr, raw: llm.content }, 'estimate/create JSON parse failed');
        return reply.code(502).send({
          success: false,
          error: 'AIの出力を解析できませんでした。もう一度お試しください。',
        });
      }

      if (!output.estimate) {
        // Model decided more information is needed
        return reply.code(200).send({
          success: true,
          data: {
            estimate: null,
            next_question: output.next_question ?? '追加情報が必要です。続けて教えてください。',
            trace_id: llm.traceId,
          },
        });
      }

      // 8. Record usage
      await recordUsage(workspaceId, 'estimate', 'create', llm.traceId);

      // 9. Respond
      return reply.code(200).send({
        success: true,
        data: {
          estimate: output.estimate,
          next_question: output.next_question ?? null,
          trace_id: llm.traceId,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, 'estimate/create failed');
      return reply.code(500).send({
        success: false,
        error: '見積書の生成中にエラーが発生しました',
        detail: process.env.NODE_ENV !== 'production' ? message : undefined,
      });
    }
  });
}
