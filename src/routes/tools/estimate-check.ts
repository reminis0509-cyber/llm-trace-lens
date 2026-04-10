/**
 * POST /api/tools/estimate/check
 *
 * Run an LLM-based review of an estimate and return critical issues + warnings.
 *
 * Request:
 *   {
 *     estimate: EstimateData,
 *     industry?: string
 *   }
 *
 * Response (200):
 *   {
 *     check_result: CheckResult,
 *     trace_id: string
 *   }
 *
 * Auth: workspace.
 * Rate limit: 10 req / hour / workspace.
 * Free plan: 10 ai_tools_usage events / month / workspace.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
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
import type { FastifyBaseLogger } from 'fastify';
import { getKnex } from '../../storage/knex-client.js';
import { formatMarketRatesForPrompt } from './market-rates.js';
import type { CheckResult, EstimateData, BusinessInfoRecord } from '../../types/ai-tools.js';

/**
 * Result of running the inline verification pipeline. Exported so that
 * callers (e.g. estimate-create) can embed the outcome into their own
 * response payload without performing an extra HTTP round-trip.
 */
export interface EstimateVerificationOutcome {
  check_result: CheckResult;
  trace_id: string | null;
  arithmetic_check: {
    ok: boolean;
    issues: Array<{ field: string; severity: 'error'; message: string }>;
  };
}

export const estimateItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  quantity: z.number(),
  unit: z.string(),
  unit_price: z.number(),
  tax_rate: z.number(),
  subtotal: z.number(),
});

export const estimateSchema = z.object({
  estimate_number: z.string(),
  issue_date: z.string(),
  valid_until: z.string(),
  client: z.object({
    company_name: z.string(),
    contact_person: z.string().optional(),
    honorific: z.string(),
  }),
  subject: z.string(),
  items: z.array(estimateItemSchema).min(1),
  subtotal: z.number(),
  tax_amount: z.number(),
  total: z.number(),
  delivery_date: z.string().optional(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
});

// Prompt-injection hardening for `industry` (QA M-4):
// - Unicode letters, digits, spaces, middle dot, parentheses only.
// - Max 50 chars.
// - Newlines, backticks, markdown headings, HTML and code fences rejected.
const industrySchema = z
  .string()
  .max(50)
  .regex(/^[\p{L}\p{N}\s・()（）]+$/u, {
    message: 'industry に使用できない文字が含まれています',
  })
  .optional();

export const estimateCheckRequestSchema = z.object({
  estimate: estimateSchema,
  industry: industrySchema,
  business_info_id: z.string().min(1).max(100).optional(),
});
const requestSchema = estimateCheckRequestSchema;

export default async function estimateCheckRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/tools/estimate/check', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 hour',
        keyGenerator: async (request: FastifyRequest) => {
          // Use resolved workspaceId so X-User-Email header cannot be used
          // to bypass the limit (QA H-2).
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
      const workspaceId = await resolveWorkspaceId(request);
      if (!workspaceId) {
        return reply.code(401).send({ success: false, error: '認証が必要です' });
      }

      const parsed = requestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: '入力が不正です',
          details: parsed.error.errors,
        });
      }
      const { estimate, industry, business_info_id } = parsed.data;

      const quota = await enforceFreeQuota(workspaceId);
      if (!quota.allowed) {
        return reply.code(429).send({ success: false, error: quota.error });
      }

      const outcome = await runEstimateVerification(fastify, {
        workspaceId,
        estimate,
        industry,
        businessInfoId: business_info_id,
        log: request.log,
        actionTag: 'estimate.check',
      });

      await recordUsage(workspaceId, 'estimate', 'check', outcome.trace_id);

      return reply.code(200).send({
        success: true,
        data: {
          check_result: outcome.check_result,
          trace_id: outcome.trace_id,
          arithmetic_check: outcome.arithmetic_check,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, 'estimate/check failed');
      return reply.code(500).send({
        success: false,
        error: '見積書のチェック中にエラーが発生しました',
        detail: process.env.NODE_ENV !== 'production' ? message : undefined,
      });
    }
  });
}

/**
 * Parameters for `runEstimateVerification`. `log` is optional — when omitted
 * the function uses `console`-free silent fallbacks for warnings that are
 * non-fatal (business info lookup failure etc).
 */
export interface RunEstimateVerificationParams {
  workspaceId: string;
  estimate: EstimateData;
  industry?: string;
  businessInfoId?: string;
  log?: Pick<FastifyBaseLogger, 'info' | 'warn' | 'error'>;
  /**
   * Caller identifier logged for trace correlation. Allows distinguishing
   * between manual checks (`estimate.check`) and inline verification
   * (`estimate.verify_inline`) in application logs without changing the
   * recordUsage action taxonomy.
   */
  actionTag?: 'estimate.check' | 'estimate.verify_inline';
}

/**
 * Run the full estimate verification pipeline:
 *   1. Load business info (optional)
 *   2. LLM review via FujiTrace proxy
 *   3. Deterministic arithmetic check
 *   4. Merge + hallucination filter
 *
 * Does NOT call `recordUsage` — the caller is responsible for quota accounting.
 * Exported so that `estimate-create.ts` can run verification inline.
 */
export async function runEstimateVerification(
  fastify: FastifyInstance,
  params: RunEstimateVerificationParams,
): Promise<EstimateVerificationOutcome> {
  const { workspaceId, estimate, industry, businessInfoId, log, actionTag } = params;

  // 1. Optional business info lookup
  let businessInfo: BusinessInfoRecord | null = null;
  if (businessInfoId) {
    try {
      await ensureAiToolsTables();
      const db = getKnex();
      const row = await db<BusinessInfoRecord>('user_business_info')
        .where({ id: businessInfoId, workspace_id: workspaceId })
        .first();
      businessInfo = row ?? null;
    } catch (lookupErr) {
      log?.warn({ lookupErr }, 'estimate verification business_info lookup failed');
    }
  }

  // 2. Build prompt
  const template = loadPromptTemplate('estimate/check.md');
  const systemPrompt = renderTemplate(template, {
    estimate_json: JSON.stringify(estimate, null, 2),
    industry: industry || '指定なし',
    market_rate_data: formatMarketRatesForPrompt(industry),
    business_info_json: businessInfo
      ? JSON.stringify(
          {
            company_name: businessInfo.company_name,
            address: businessInfo.address,
            phone: businessInfo.phone,
            email: businessInfo.email,
            invoice_number: businessInfo.invoice_number,
            bank_name: businessInfo.bank_name,
            bank_branch: businessInfo.bank_branch,
            account_type: businessInfo.account_type,
            account_number: businessInfo.account_number,
            account_holder: businessInfo.account_holder,
          },
          null,
          2,
        )
      : '未登録',
  });

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'user' as const,
      content: '上記の見積書をチェックして、JSON形式で結果を返してください。',
    },
  ];

  // 3. LLM call (auto-traced via FujiTrace proxy)
  log?.info(
    { action: actionTag ?? 'estimate.check', workspaceId },
    'estimate verification LLM call starting',
  );
  const llm = await callLlmViaProxy(fastify, messages, {
    model: process.env.AI_TOOLS_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 2048,
  });

  // 4. Parse LLM output (throws on failure — caller decides how to handle)
  const checkResult = parseLlmJson<CheckResult>(llm.content);

  // Defensive defaults so the frontend always has the expected shape
  checkResult.critical_issues ??= [];
  checkResult.warnings ??= [];
  checkResult.suggestions ??= [];
  checkResult.responsibility_notice ??=
    'この見積書を送付する前に、金額・宛先・インボイス番号を必ず再確認してください。';

  // 5. Deterministic arithmetic verification (source of truth for calc fields)
  const localIssues = verifyArithmetic(estimate);
  const localFields = new Set(localIssues.map((i) => i.field));
  checkResult.critical_issues = filterArithmeticHallucinations(
    checkResult.critical_issues,
    localFields,
  );
  if (localIssues.length > 0) {
    checkResult.critical_issues.push(...localIssues);
    checkResult.status = 'error';
  } else if (checkResult.critical_issues.length === 0) {
    checkResult.status = checkResult.warnings.length > 0 ? 'warning' : 'ok';
  }

  return {
    check_result: checkResult,
    trace_id: llm.traceId,
    arithmetic_check: {
      ok: localIssues.length === 0,
      issues: localIssues,
    },
  };
}

/**
 * Fields whose correctness is determined ONLY by `verifyArithmetic`.
 * The LLM is not trusted for these — if it claims a mismatch but the
 * deterministic check passed, the claim is dropped as a hallucination.
 *
 * Patterns:
 *   - 'subtotal'
 *   - 'tax_amount'
 *   - 'total'
 *   - 'items[<n>].subtotal'
 */
const ARITHMETIC_FIELD_RE = /^(subtotal|tax_amount|total|items\[\d+\]\.subtotal)$/;

/**
 * Strip LLM critical_issues whose `field` matches an arithmetic field but is
 * NOT in the set of fields the deterministic checker actually flagged.
 *
 * Exported for unit testing.
 */
export function filterArithmeticHallucinations<T extends { field?: string }>(
  llmIssues: T[],
  flaggedByLocal: Set<string>,
): T[] {
  return llmIssues.filter((issue) => {
    const field = issue.field ?? '';
    if (!ARITHMETIC_FIELD_RE.test(field)) return true; // not arithmetic, keep
    return flaggedByLocal.has(field); // arithmetic: keep only if local agrees
  });
}

/**
 * Deterministic arithmetic verification. Returns an array of issues if found.
 * Exported (QA M-2) so tests can call the production implementation directly.
 */
export function verifyArithmetic(estimate: EstimateData): Array<{ field: string; severity: 'error'; message: string }> {
  const issues: Array<{ field: string; severity: 'error'; message: string }> = [];

  // Per-item subtotal
  estimate.items.forEach((item, idx) => {
    const expected = Math.round(item.quantity * item.unit_price);
    if (expected !== item.subtotal) {
      issues.push({
        field: `items[${idx}].subtotal`,
        severity: 'error',
        message: `項目「${item.name}」の小計が一致しません。期待値: ${expected.toLocaleString()}円, 実際: ${item.subtotal.toLocaleString()}円`,
      });
    }
  });

  // Overall subtotal
  const sumItems = estimate.items.reduce((acc, it) => acc + it.subtotal, 0);
  if (sumItems !== estimate.subtotal) {
    issues.push({
      field: 'subtotal',
      severity: 'error',
      message: `小計の合計が一致しません。期待値: ${sumItems.toLocaleString()}円, 実際: ${estimate.subtotal.toLocaleString()}円`,
    });
  }

  // Tax amount (per-rate accumulation)
  const expectedTax = estimate.items.reduce((acc, it) => {
    return acc + Math.floor((it.subtotal * it.tax_rate) / 100);
  }, 0);
  if (Math.abs(expectedTax - estimate.tax_amount) > 1) {
    issues.push({
      field: 'tax_amount',
      severity: 'error',
      message: `消費税額が一致しません。期待値: ${expectedTax.toLocaleString()}円, 実際: ${estimate.tax_amount.toLocaleString()}円`,
    });
  }

  // Total
  const expectedTotal = estimate.subtotal + estimate.tax_amount;
  if (expectedTotal !== estimate.total) {
    issues.push({
      field: 'total',
      severity: 'error',
      message: `合計金額が一致しません。期待値: ${expectedTotal.toLocaleString()}円, 実際: ${estimate.total.toLocaleString()}円`,
    });
  }

  return issues;
}
