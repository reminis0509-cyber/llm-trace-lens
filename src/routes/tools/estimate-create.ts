/**
 * POST /api/tools/estimate/create
 *
 * Generate an 見積書 draft from a multi-turn conversation.
 *
 * Request:
 *   {
 *     conversation_history: Array<{ role: 'user' | 'assistant', content: string }>,
 *     business_info_id: string,
 *     industry?: string   // optional; used for inline market-rate verification
 *   }
 *
 * Response (200):
 *   {
 *     success: true,
 *     data: {
 *       estimate: EstimateData | null,
 *       next_question: string | null,
 *       trace_id: string | null,
 *       verification: {
 *         status: 'ok' | 'warning' | 'error',
 *         critical_issues: CheckIssue[],
 *         warnings: CheckIssue[],
 *         suggestions: string[],
 *         responsibility_notice: string,
 *         arithmetic_check: { ok: boolean, issues: Array<{ field, severity, message }> },
 *         trace_id: string | null,
 *         reason?: string   // only set when inline verification failed
 *       }
 *     }
 *   }
 *
 * The `verification` field is populated automatically — the caller does NOT
 * need to make a second `/api/tools/estimate/check` request. If the
 * downstream LLM verification call fails (timeout, parse error, etc.),
 * `verification.status` is set to `'error'` with a `reason` field but the
 * estimate itself is still returned.
 *
 * Auth: workspace (header / middleware).
 * Rate limit: 10 req / hour / workspace.
 * Free plan: 10 ai_tools_usage events / month / workspace.
 *   NOTE: create + inline verification count as a SINGLE usage event.
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
import type { CheckResult, EstimateData, BusinessInfoRecord } from '../../types/ai-tools.js';
import { runEstimateVerification } from './estimate-check.js';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
});

// Prompt-injection hardening for `industry` mirrors estimate-check.ts.
const industrySchema = z
  .string()
  .max(50)
  .regex(/^[\p{L}\p{N}\s・()（）]+$/u, {
    message: 'industry に使用できない文字が含まれています',
  })
  .optional();

const requestSchema = z.object({
  conversation_history: z.array(messageSchema).min(1).max(50),
  business_info_id: z.string().min(1),
  industry: industrySchema,
});

/**
 * Verification payload returned alongside the generated estimate. The LLM
 * review fields (`critical_issues` / `warnings` / `suggestions` /
 * `responsibility_notice` / `status`) match the existing `CheckResult`
 * contract consumed by the frontend. `arithmetic_check` is an additional
 * deterministic audit trail; if inline verification failed (LLM timeout
 * etc.) `status = 'error'` and `reason` carries the failure cause.
 */
interface VerificationPayload {
  status: CheckResult['status'];
  critical_issues: CheckResult['critical_issues'];
  warnings: CheckResult['warnings'];
  suggestions: CheckResult['suggestions'];
  responsibility_notice: CheckResult['responsibility_notice'];
  arithmetic_check: {
    ok: boolean;
    issues: Array<{ field: string; severity: 'error'; message: string }>;
  };
  trace_id: string | null;
  reason?: string;
}

function emptyVerificationError(reason: string): VerificationPayload {
  return {
    status: 'error',
    critical_issues: [],
    warnings: [],
    suggestions: [],
    responsibility_notice:
      '自動検証を実行できませんでした。見積書を送付する前に必ず内容を再確認してください。',
    arithmetic_check: { ok: false, issues: [] },
    trace_id: null,
    reason,
  };
}

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
      const { conversation_history, business_info_id, industry } = parsed.data;

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

      // 8. 自動検証（インライン実行）
      // 戦略要件: 検証は必ず自動で走る必要がある（docs/戦略_2026.md 7.8.1）。
      // LLM タイムアウト等で検証が失敗しても、見積書生成自体は成功として返す。
      let verification: VerificationPayload;
      try {
        const outcome = await runEstimateVerification(fastify, {
          workspaceId,
          estimate: output.estimate,
          industry,
          businessInfoId: business_info_id,
          log: request.log,
          actionTag: 'estimate.verify_inline',
        });
        verification = {
          status: outcome.check_result.status,
          critical_issues: outcome.check_result.critical_issues,
          warnings: outcome.check_result.warnings,
          suggestions: outcome.check_result.suggestions,
          responsibility_notice: outcome.check_result.responsibility_notice,
          arithmetic_check: outcome.arithmetic_check,
          trace_id: outcome.trace_id,
        };
      } catch (verifyErr) {
        const reason = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
        request.log.error(
          { verifyErr, action: 'estimate.verify_inline' },
          'inline verification failed; returning estimate without verification',
        );
        verification = emptyVerificationError(reason);
      }

      // 9. Record usage — create + inline verification は 1 カウント合算
      await recordUsage(workspaceId, 'estimate', 'create', llm.traceId);

      // 10. Respond
      return reply.code(200).send({
        success: true,
        data: {
          estimate: output.estimate,
          next_question: output.next_question ?? null,
          trace_id: llm.traceId,
          verification,
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
