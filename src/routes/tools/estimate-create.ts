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
import type { LlmTokenUsage } from './_shared.js';
import type { CheckResult, EstimateData, BusinessInfoRecord } from '../../types/ai-tools.js';
import type { SkeletonStep, SkeletonTrace } from '../../types/skeleton-trace.js';
import { runEstimateVerification } from './estimate-check.js';

// GPT-4o-mini pricing (USD per 1M tokens) — used for cost estimation
const PRICING_INPUT_USD_PER_M = 0.15;
const PRICING_OUTPUT_USD_PER_M = 0.60;
const USD_TO_JPY = 150;

function estimateCostYen(usage: LlmTokenUsage): number {
  const inputCost = (usage.promptTokens / 1_000_000) * PRICING_INPUT_USD_PER_M * USD_TO_JPY;
  const outputCost = (usage.completionTokens / 1_000_000) * PRICING_OUTPUT_USD_PER_M * USD_TO_JPY;
  return Math.round((inputCost + outputCost) * 10000) / 10000;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

function recordStep(
  steps: SkeletonStep[],
  name: string,
  startMs: number,
  details?: Record<string, unknown>,
): void {
  steps.push({
    index: steps.length,
    name,
    status: 'completed',
    durationMs: Math.round(performance.now() - startMs),
    details,
  });
}

function recordErrorStep(
  steps: SkeletonStep[],
  name: string,
  startMs: number,
  details?: Record<string, unknown>,
): void {
  steps.push({
    index: steps.length,
    name,
    status: 'error',
    durationMs: Math.round(performance.now() - startMs),
    details,
  });
}

function llmStepDetails(
  model: string,
  temperature: number,
  usage: LlmTokenUsage | null,
  inputText: string,
  outputText: string,
): Record<string, unknown> {
  const actualUsage = usage ?? {
    promptTokens: estimateTokens(inputText),
    completionTokens: estimateTokens(outputText),
  };
  return {
    model,
    temperature,
    inputTokens: actualUsage.promptTokens,
    outputTokens: actualUsage.completionTokens,
    costYen: estimateCostYen(actualUsage),
    estimated: usage === null,
  };
}

export const messageSchema = z.object({
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

export const estimateCreateRequestSchema = z.object({
  conversation_history: z.array(messageSchema).min(1).max(50),
  business_info_id: z.string().min(1),
  industry: industrySchema,
});
const requestSchema = estimateCreateRequestSchema;

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

/**
 * Guard against the "宛先 = 自社" failure class — a recurring LINE-side bug
 * where the LLM, lacking an explicit recipient in the conversation, grabs
 * the issuer's own company name (via business_info) and writes it into
 * `client.company_name`. Shipping such an estimate to the customer would
 * be a商習慣違反 embarrassment, so we neutralise it here on the server:
 *
 *   - LLM returned client.company_name that equals (trimmed, case-sensitive
 *     exact) the issuer's company_name, OR is blank / missing.
 *   - We clear `estimate` to null and raise a next_question.
 *   - Caller returns "needs-clarification" shape.
 *
 * This runs AFTER the prompt-level 禁止 in `create.md` so it catches the
 * minority of runs where the LLM slips through. Belt and braces.
 */
function detectRecipientIssuerClash(
  estimate: EstimateData,
  issuerCompanyName: string,
): { clashed: true; question: string } | { clashed: false } {
  const normalise = (s: unknown): string =>
    typeof s === 'string' ? s.trim() : '';
  const client = (estimate as { client?: { company_name?: unknown } }).client;
  const recipient = normalise(client?.company_name);
  const issuer = normalise(issuerCompanyName);
  if (!recipient) {
    return {
      clashed: true,
      question: '宛先（相手先の会社名）を教えてください。',
    };
  }
  if (issuer && recipient === issuer) {
    return {
      clashed: true,
      question:
        '宛先が自社と同じになっています。相手先の会社名を明示して再度ご依頼ください。',
    };
  }
  return { clashed: false };
}

/**
 * POST /api/tools/estimate/create-stream
 *
 * SSE streaming variant of `/api/tools/estimate/create`.
 * Returns the same payload but streams step-progress events in real time.
 *
 * SSE events:
 *   event: step   — emitted after each processing phase completes
 *   event: done   — final event carrying the full response payload
 *   event: error  — emitted on unrecoverable failure, then stream closes
 */
async function estimateCreateStreamRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/tools/estimate/create-stream', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 hour',
        keyGenerator: async (request: FastifyRequest) => {
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
    // SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    function sendEvent(event: string, data: unknown): void {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }

    try {
      const traceStartMs = performance.now();
      const skeletonSteps: SkeletonStep[] = [];
      const llmModel = process.env.AI_TOOLS_MODEL || 'gpt-4o-mini';

      // ── Step 0: 入力データ受信 ──
      const step0Start = performance.now();

      const workspaceId = await resolveWorkspaceId(request);
      if (!workspaceId) {
        sendEvent('error', { success: false, error: '認証が必要です' });
        reply.raw.end();
        return reply;
      }

      const parsed = requestSchema.safeParse(request.body);
      if (!parsed.success) {
        sendEvent('error', {
          success: false,
          error: '入力が不正です',
          details: parsed.error.errors,
        });
        reply.raw.end();
        return reply;
      }
      const { conversation_history, business_info_id, industry } = parsed.data;

      const quota = await enforceFreeQuota(workspaceId, request);
      if (!quota.allowed) {
        sendEvent('error', { success: false, error: quota.error });
        reply.raw.end();
        return reply;
      }

      await ensureAiToolsTables();
      const db = getKnex();
      const businessInfo = await db<BusinessInfoRecord>('user_business_info')
        .where({ id: business_info_id, workspace_id: workspaceId })
        .first();

      const template = loadPromptTemplate('estimate/create.md');
      const today = new Date().toISOString().slice(0, 10);
      const systemPrompt = renderTemplate(template, {
        business_info_json: businessInfo
          ? JSON.stringify(businessInfo, null, 2)
          : '未登録（会話履歴内の情報を使用してください）',
        conversation_history: JSON.stringify(conversation_history, null, 2),
        today,
      });

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...conversation_history.map((m) => ({ role: m.role, content: m.content })),
      ];

      const step0: SkeletonStep = {
        index: 0,
        name: '入力データ受信',
        status: 'completed',
        durationMs: Math.round(performance.now() - step0Start),
        details: {
          businessInfoFound: !!businessInfo,
          conversationTurns: conversation_history.length,
        },
      };
      skeletonSteps.push(step0);
      sendEvent('step', step0);

      // ── Step 1: AI見積書生成 ──
      const step1Start = performance.now();

      const llm = await callLlmViaProxy(fastify, messages, {
        model: llmModel,
        temperature: 0.2,
        maxTokens: 2048,
        workspaceId,
      });

      const fullInputText = messages.map(m => m.content).join('\n');
      const step1Details = llmStepDetails(llmModel, 0.2, llm.usage, fullInputText, llm.content);
      const step1: SkeletonStep = {
        index: 1,
        name: 'AI見積書生成',
        status: 'completed',
        durationMs: Math.round(performance.now() - step1Start),
        details: step1Details,
      };
      skeletonSteps.push(step1);
      sendEvent('step', step1);

      // Parse LLM JSON
      let output: CreateLlmOutput;
      try {
        output = parseLlmJson<CreateLlmOutput>(llm.content);
      } catch (parseErr) {
        request.log.error({ parseErr, raw: llm.content }, 'estimate/create-stream JSON parse failed');
        sendEvent('error', {
          success: false,
          error: 'AIの出力を解析できませんでした。もう一度お試しください。',
        });
        reply.raw.end();
        return reply;
      }

      // Defensive clash check — clear the estimate if the LLM accidentally
      // wrote the issuer's own company name into `client.company_name`.
      // See `detectRecipientIssuerClash` JSDoc for rationale.
      if (output.estimate && businessInfo) {
        const clash = detectRecipientIssuerClash(
          output.estimate,
          String(businessInfo.company_name ?? ''),
        );
        if (clash.clashed) {
          request.log.warn(
            {
              workspaceId,
              businessInfoId: business_info_id,
              suppliedClient: output.estimate.client?.company_name,
              issuer: businessInfo.company_name,
            },
            '[estimate/create] recipient/issuer clash — clearing estimate',
          );
          output = { estimate: undefined, next_question: clash.question };
        }
      }

      if (!output.estimate) {
        // Model needs more information — send done with partial result
        const partialUsage = llm.usage ?? {
          promptTokens: estimateTokens(fullInputText),
          completionTokens: estimateTokens(llm.content),
        };
        const doneStep: SkeletonStep = {
          index: 2,
          name: '完了',
          status: 'completed',
          durationMs: 0,
          details: {},
        };
        skeletonSteps.push(doneStep);
        sendEvent('step', doneStep);

        const partialTrace: SkeletonTrace = {
          taskId: 'estimate.create',
          taskName: '見積書作成',
          steps: skeletonSteps,
          totalDurationMs: Math.round(performance.now() - traceStartMs),
          totalCostYen: estimateCostYen(partialUsage),
          model: llmModel,
          tokenUsage: { input: partialUsage.promptTokens, output: partialUsage.completionTokens },
        };
        sendEvent('done', {
          success: true,
          data: {
            estimate: null,
            next_question: output.next_question ?? '追加情報が必要です。続けて教えてください。',
            trace_id: llm.traceId,
            skeleton_trace: partialTrace,
          },
        });
        reply.raw.end();
        return reply;
      }

      // ── Step 2: 自動検証 ──
      const step2Start = performance.now();
      let verification: VerificationPayload;
      let step2: SkeletonStep;
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
        const issueCount =
          outcome.check_result.critical_issues.length +
          outcome.check_result.warnings.length;
        step2 = {
          index: 2,
          name: '自動検証',
          status: 'completed',
          durationMs: Math.round(performance.now() - step2Start),
          details: {
            status: outcome.check_result.status,
            issueCount,
            arithmeticOk: outcome.arithmetic_check.ok,
          },
        };
      } catch (verifyErr) {
        const reason = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
        request.log.error(
          { verifyErr, action: 'estimate.verify_inline' },
          'inline verification failed (stream); returning estimate without verification',
        );
        verification = emptyVerificationError(reason);
        step2 = {
          index: 2,
          name: '自動検証',
          status: 'error',
          durationMs: Math.round(performance.now() - step2Start),
          details: { reason },
        };
      }
      skeletonSteps.push(step2);
      sendEvent('step', step2);

      // ── Step 3: 完了 ──
      const step3: SkeletonStep = {
        index: 3,
        name: '完了',
        status: 'completed',
        durationMs: 0,
        details: {},
      };
      skeletonSteps.push(step3);
      sendEvent('step', step3);

      // Build skeleton trace
      const llmUsage = llm.usage ?? {
        promptTokens: estimateTokens(fullInputText),
        completionTokens: estimateTokens(llm.content),
      };
      const skeletonTrace: SkeletonTrace = {
        taskId: 'estimate.create',
        taskName: '見積書作成',
        steps: skeletonSteps,
        totalDurationMs: Math.round(performance.now() - traceStartMs),
        totalCostYen: estimateCostYen(llmUsage),
        model: llmModel,
        tokenUsage: { input: llmUsage.promptTokens, output: llmUsage.completionTokens },
      };

      // Record usage
      await recordUsage(workspaceId, 'estimate', 'create', llm.traceId);

      // Send final done event
      sendEvent('done', {
        success: true,
        data: {
          estimate: output.estimate,
          next_question: output.next_question ?? null,
          trace_id: llm.traceId,
          verification,
          skeleton_trace: skeletonTrace,
        },
      });

      reply.raw.end();
      return reply;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, 'estimate/create-stream failed');
      sendEvent('error', {
        success: false,
        error: '見積書の生成中にエラーが発生しました',
        detail: process.env.NODE_ENV !== 'production' ? message : undefined,
      });
      reply.raw.end();
      return reply;
    }
  });
}

export default async function estimateCreateRoute(fastify: FastifyInstance): Promise<void> {
  // Register the SSE streaming variant
  await estimateCreateStreamRoute(fastify);

  // Register the original JSON endpoint
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
      const traceStartMs = performance.now();
      const skeletonSteps: SkeletonStep[] = [];
      const llmModel = process.env.AI_TOOLS_MODEL || 'gpt-4o-mini';

      // ── Step 1: 入力データ受信 (auth + validation + business info lookup) ──
      const step1Start = performance.now();

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

      // 3. Free-plan quota check (internal calls from AI agent bypass via INTERNAL_SECRET)
      const quota = await enforceFreeQuota(workspaceId, request);
      if (!quota.allowed) {
        return reply.code(429).send({ success: false, error: quota.error });
      }

      // 4. Load business info (optional — may not exist if user only saved to localStorage)
      await ensureAiToolsTables();
      const db = getKnex();
      const businessInfo = await db<BusinessInfoRecord>('user_business_info')
        .where({ id: business_info_id, workspace_id: workspaceId })
        .first();
      // If not found, continue with empty business info — the user's conversation
      // message already contains company details (name, address, etc.)

      // 5. Build prompt
      const template = loadPromptTemplate('estimate/create.md');
      const today = new Date().toISOString().slice(0, 10);
      const systemPrompt = renderTemplate(template, {
        business_info_json: businessInfo ? JSON.stringify(businessInfo, null, 2) : '未登録（会話履歴内の情報を使用してください）',
        conversation_history: JSON.stringify(conversation_history, null, 2),
        today,
      });

      // The conversation_history is also fed in as user/assistant turns so the
      // model can continue the dialog naturally if more info is needed.
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...conversation_history.map((m) => ({ role: m.role, content: m.content })),
      ];

      recordStep(skeletonSteps, '入力データ受信', step1Start, {
        businessInfoFound: !!businessInfo,
        conversationTurns: conversation_history.length,
      });

      // ── Step 2: AI見積書生成 (main LLM call) ──
      const step2Start = performance.now();

      // 6. Call LLM (trace persistence is opt-in via workspaceId since
      //    the 2026-04-25 bucket-hole patch — pass it through from the
      //    request-scoped resolveWorkspaceId so this turn shows up in
      //    the dashboard / cost stats / LLM-as-Judge pipeline).
      const llm = await callLlmViaProxy(fastify, messages, {
        model: llmModel,
        temperature: 0.2,
        maxTokens: 2048,
        workspaceId,
      });

      const fullInputText = messages.map(m => m.content).join('\n');
      const step2Details = llmStepDetails(llmModel, 0.2, llm.usage, fullInputText, llm.content);
      recordStep(skeletonSteps, 'AI見積書生成', step2Start, step2Details);

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

      // Defensive clash check — mirrors the streaming path. If the LLM
      // pasted issuer's company name into `client`, clear and ask again.
      if (output.estimate && businessInfo) {
        const clash = detectRecipientIssuerClash(
          output.estimate,
          String(businessInfo.company_name ?? ''),
        );
        if (clash.clashed) {
          request.log.warn(
            {
              workspaceId,
              businessInfoId: business_info_id,
              suppliedClient: output.estimate.client?.company_name,
              issuer: businessInfo.company_name,
            },
            '[estimate/create] recipient/issuer clash — clearing estimate',
          );
          output = { estimate: undefined, next_question: clash.question };
        }
      }

      if (!output.estimate) {
        // Model decided more information is needed — only steps 1-2 exist
        const partialUsage = llm.usage ?? {
          promptTokens: estimateTokens(fullInputText),
          completionTokens: estimateTokens(llm.content),
        };
        const partialTrace: SkeletonTrace = {
          taskId: 'estimate.create',
          taskName: '見積書作成',
          steps: skeletonSteps,
          totalDurationMs: Math.round(performance.now() - traceStartMs),
          totalCostYen: estimateCostYen(partialUsage),
          model: llmModel,
          tokenUsage: { input: partialUsage.promptTokens, output: partialUsage.completionTokens },
        };
        return reply.code(200).send({
          success: true,
          data: {
            estimate: null,
            next_question: output.next_question ?? '追加情報が必要です。続けて教えてください。',
            trace_id: llm.traceId,
            skeleton_trace: partialTrace,
          },
        });
      }

      // ── Step 3: 自動検証 (inline verification) ──
      // 戦略要件: 検証は必ず自動で走る必要がある（docs/戦略_2026.md 7.8.1）。
      // LLM タイムアウト等で検証が失敗しても、見積書生成自体は成功として返す。
      const step3Start = performance.now();
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
        const issueCount =
          outcome.check_result.critical_issues.length +
          outcome.check_result.warnings.length;
        recordStep(skeletonSteps, '自動検証', step3Start, {
          status: outcome.check_result.status,
          issueCount,
          arithmeticOk: outcome.arithmetic_check.ok,
        });
      } catch (verifyErr) {
        const reason = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
        request.log.error(
          { verifyErr, action: 'estimate.verify_inline' },
          'inline verification failed; returning estimate without verification',
        );
        verification = emptyVerificationError(reason);
        recordErrorStep(skeletonSteps, '自動検証', step3Start, { reason });
      }

      // ── Step 4: 完了 (final response assembly) ──
      const step4Start = performance.now();
      recordStep(skeletonSteps, '完了', step4Start);

      // Build the final skeleton trace
      const llmUsage = llm.usage ?? {
        promptTokens: estimateTokens(fullInputText),
        completionTokens: estimateTokens(llm.content),
      };
      const skeletonTrace: SkeletonTrace = {
        taskId: 'estimate.create',
        taskName: '見積書作成',
        steps: skeletonSteps,
        totalDurationMs: Math.round(performance.now() - traceStartMs),
        totalCostYen: estimateCostYen(llmUsage),
        model: llmModel,
        tokenUsage: { input: llmUsage.promptTokens, output: llmUsage.completionTokens },
      };

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
          skeleton_trace: skeletonTrace,
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
