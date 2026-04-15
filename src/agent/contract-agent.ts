/**
 * FujiTrace Contract-Based AI Clerk Runtime (β).
 *
 * Implements the Plan → Execute → Review loop from claw-code philosophy,
 * constrained by the Contract (入口固定 / 中間自由 / 出口固定) defined in
 * docs/戦略_2026.md Section 12.
 *
 * Public entrypoint: `executeContractAgent(fastify, input)`.
 * Yields `AgentSseEvent` values as an AsyncGenerator so the HTTP route can
 * stream them directly as Server-Sent Events.
 *
 * Safety rails:
 *   - whitelist enforced at both Plan and Execute stages
 *   - MAX_ITER = 5 (steps beyond the 5th are force-skipped)
 *   - per-run timeout = 90s (rough wall clock; each step also bounded)
 *   - retry budget = 1 per step
 *   - Contract violations logged to `feature_requests` for product learning
 */
import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import {
  ALLOWED_AGENT_TOOLS,
  assertAllowedTool,
  ContractViolationError,
  describeAllowedToolsForPlanner,
  isAllowedAgentTool,
  resolveAllowedToolDispatch,
} from './allowed-tools.js';
import type { AllowedAgentTool } from './allowed-tools.js';
import type {
  AgentAttachment,
  AgentPlan,
  AgentPlanStep,
  AgentRunInput,
  AgentSseEvent,
} from './contract-agent.types.js';
import { executeToolViaInject } from './tool-executor.js';
import { logFeatureRequest } from './desire-db.js';
import {
  callLlmViaProxy,
  loadPromptTemplate,
  parseLlmJson,
  recordUsage,
  renderTemplate,
} from '../routes/tools/_shared.js';
import type { LlmMessage } from '../routes/tools/_shared.js';
import { checkArithmetic } from '../tools/arithmetic-checker.js';
import type { ExtractedFinancialData } from '../tools/arithmetic-checker.js';
import {
  checkBudget,
  CostBudgetExceededError,
  estimateUsdCost,
  recordSpend,
} from './cost-guard.js';
import type { LlmTokenUsage } from '../routes/tools/_shared.js';

/** Hard limit on Plan length — extra steps are yielded as `skipped`. */
const MAX_ITER = 5;

/** Overall wall-clock budget per run. */
const RUN_TIMEOUT_MS = 90_000;

/** Per-step retry budget (retry once on failure, then give up). */
const PER_STEP_RETRIES = 1;

/** LLM model used for all three stages (cost-optimised). */
const AGENT_MODEL = 'gpt-4o-mini';

/**
 * Mutable per-run cost tracker. Increments as LLM calls return usage data.
 * Exposed as an object so helper functions can update it by reference.
 */
interface RunSpendTracker {
  workspaceId: string;
  runId: string;
  totalUsd: number;
}

/**
 * Wrap a callLlmViaProxy invocation with budget accounting:
 *   1. Estimate cost from the usage field.
 *   2. Call checkBudget() — throws CostBudgetExceededError if any cap exceeded.
 *   3. Add to the per-run running total.
 *
 * The caller is responsible for catching CostBudgetExceededError and yielding
 * a `BUDGET_EXCEEDED` error SSE event.
 */
function accountUsage(
  tracker: RunSpendTracker,
  model: string,
  usage: LlmTokenUsage | null,
): Promise<number> {
  const added = usage
    ? estimateUsdCost(model, usage.promptTokens, usage.completionTokens)
    : 0;
  return checkBudget(tracker.workspaceId, tracker.totalUsd, added).then(() => {
    tracker.totalUsd += added;
    return added;
  });
}

interface ReviewerOutput {
  status: 'ok' | 'warning' | 'failed';
  notes: string;
  reply: string;
}

/**
 * Fallback plan used when the planner LLM returns invalid JSON.
 * A single estimate.create step is safer than failing outright.
 */
function fallbackPlan(message: string): AgentPlan {
  return {
    summary: '自動計画の生成に失敗したため、既定の見積書作成フローで実行します。',
    steps: [
      {
        tool: 'estimate.create',
        reason: 'Planner JSON 解析失敗時の安全フォールバック。',
        inputHint: message.slice(0, 400),
      },
    ],
  };
}

/**
 * Call the planner LLM and parse its JSON output into an `AgentPlan`.
 * Throws nothing — always returns either the parsed plan or a fallback.
 */
async function runPlanner(
  fastify: FastifyInstance,
  input: AgentRunInput,
  tracker: RunSpendTracker,
): Promise<AgentPlan> {
  const template = loadPromptTemplate('../agent/planner.md');
  const systemPrompt = renderTemplate(template, {
    allowed_tools: describeAllowedToolsForPlanner(),
    company_info: JSON.stringify(input.companyInfo ?? {}),
  });

  const messages: LlmMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: input.message },
  ];

  try {
    const { content, usage } = await callLlmViaProxy(fastify, messages, {
      model: AGENT_MODEL,
      temperature: 0.3,
      maxTokens: 512,
    });
    await accountUsage(tracker, AGENT_MODEL, usage);
    const parsed = parseLlmJson<AgentPlan>(content);
    if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      return fallbackPlan(input.message);
    }
    return parsed;
  } catch (err) {
    if (err instanceof CostBudgetExceededError) throw err;
    return fallbackPlan(input.message);
  }
}

/**
 * Call the tool-input-builder LLM to materialise the payload for a single
 * step. Returns a plain object. Falls back to a minimal payload on error.
 */
async function buildToolInput(
  fastify: FastifyInstance,
  toolId: AllowedAgentTool,
  step: AgentPlanStep,
  input: AgentRunInput,
  planSummary: string,
  tracker: RunSpendTracker,
): Promise<Record<string, unknown>> {
  const template = loadPromptTemplate('../agent/tool-input-builder.md');
  const systemPrompt = renderTemplate(template, {
    tool_id: toolId,
    tool_description: step.reason,
    plan_summary: planSummary,
    step_reason: step.reason,
    input_hint: step.inputHint ?? '',
    user_message: input.message,
    company_info: JSON.stringify(input.companyInfo ?? {}),
  });

  const messages: LlmMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'payload JSON のみを出力してください。' },
  ];

  try {
    const { content, usage } = await callLlmViaProxy(fastify, messages, {
      model: AGENT_MODEL,
      temperature: 0.2,
      maxTokens: 768,
    });
    await accountUsage(tracker, AGENT_MODEL, usage);
    const parsed = parseLlmJson<Record<string, unknown>>(content);
    return parsed && typeof parsed === 'object' ? parsed : defaultPayload(toolId, input);
  } catch (err) {
    if (err instanceof CostBudgetExceededError) throw err;
    return defaultPayload(toolId, input);
  }
}

/** Minimal payload used when the input-builder LLM fails. */
function defaultPayload(
  toolId: AllowedAgentTool,
  input: AgentRunInput,
): Record<string, unknown> {
  if (toolId === 'estimate.create' || toolId === 'estimate.check') {
    const businessInfoId =
      typeof input.companyInfo?.['id'] === 'string'
        ? (input.companyInfo['id'] as string)
        : '';
    return {
      conversation_history: [{ role: 'user', content: input.message }],
      business_info_id: businessInfoId,
    };
  }
  return {
    task_id: toolId,
    instruction: input.message,
    context: input.companyInfo ? JSON.stringify(input.companyInfo) : '',
  };
}

/**
 * Extract financial data from a tool result for the arithmetic checker.
 * Best-effort — unknown shapes simply skip the check.
 */
function extractFinancialData(result: unknown): ExtractedFinancialData | null {
  if (!result || typeof result !== 'object') return null;
  const root = result as Record<string, unknown>;
  // `/api/tools/estimate/create` returns { success, data: { estimate } }
  const dataObj = root['data'] && typeof root['data'] === 'object'
    ? (root['data'] as Record<string, unknown>)
    : root;
  const estimate =
    dataObj['estimate'] && typeof dataObj['estimate'] === 'object'
      ? (dataObj['estimate'] as Record<string, unknown>)
      : null;
  const structured =
    dataObj['structured_result'] && typeof dataObj['structured_result'] === 'object'
      ? (dataObj['structured_result'] as Record<string, unknown>)
      : null;
  const candidate = estimate ?? structured;
  if (!candidate) return null;

  const items = Array.isArray(candidate['items']) ? candidate['items'] : [];
  if (items.length === 0) return null;

  const mapped = items
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const r = raw as Record<string, unknown>;
      const quantity = Number(r['quantity']);
      const unitPrice = Number(r['unit_price']);
      const amount = Number(r['amount']);
      if (
        Number.isFinite(quantity) &&
        Number.isFinite(unitPrice) &&
        Number.isFinite(amount)
      ) {
        return {
          name: typeof r['name'] === 'string' ? r['name'] : '',
          quantity,
          unit_price: unitPrice,
          amount,
        };
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (mapped.length === 0) return null;

  return {
    items: mapped,
    subtotal: Number(candidate['subtotal']) || mapped.reduce((a, it) => a + it.amount, 0),
    tax_rate: Number(candidate['tax_rate']) || 0.1,
    tax_amount: Number(candidate['tax_amount']) || 0,
    total: Number(candidate['total']) || 0,
    has_financial_data: true,
  };
}

/** Compose the final reply via the reviewer LLM. */
async function runReviewer(
  fastify: FastifyInstance,
  args: {
    userMessage: string;
    planSummary: string;
    finalTool: string;
    finalResult: unknown;
    arithmeticStatus: 'ok' | 'skipped' | 'failed';
    arithmeticNotes: string;
  },
  tracker: RunSpendTracker,
): Promise<ReviewerOutput> {
  const template = loadPromptTemplate('../agent/reviewer.md');
  const systemPrompt = renderTemplate(template, {
    user_message: args.userMessage,
    plan_summary: args.planSummary,
    final_tool: args.finalTool,
    final_result: JSON.stringify(args.finalResult).slice(0, 4000),
    arithmetic_status: args.arithmeticStatus,
    arithmetic_notes: args.arithmeticNotes,
  });

  const messages: LlmMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '最終レビュー JSON を出力してください。' },
  ];

  try {
    const { content, usage } = await callLlmViaProxy(fastify, messages, {
      model: AGENT_MODEL,
      temperature: 0.3,
      maxTokens: 1024,
    });
    await accountUsage(tracker, AGENT_MODEL, usage);
    const parsed = parseLlmJson<ReviewerOutput>(content);
    return {
      status: parsed.status ?? (args.arithmeticStatus === 'failed' ? 'failed' : 'ok'),
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      reply:
        typeof parsed.reply === 'string' && parsed.reply.trim().length > 0
          ? parsed.reply
          : '書類の下書きを作成しました。承認・送信は必ずご自身で確認してください。',
    };
  } catch (err) {
    if (err instanceof CostBudgetExceededError) throw err;
    return {
      status: args.arithmeticStatus === 'failed' ? 'failed' : 'warning',
      notes: 'Reviewer LLM 呼び出しに失敗したため既定メッセージを返しました。',
      reply:
        '書類の下書きを作成しました。算術チェック結果と合わせて内容をご確認ください。承認・送信は必ずご自身で確認してください。',
    };
  }
}

/** Extract possible PDF/url attachments from a tool result. */
function extractAttachments(result: unknown): AgentAttachment[] {
  if (!result || typeof result !== 'object') return [];
  const root = result as Record<string, unknown>;
  const data = root['data'] && typeof root['data'] === 'object'
    ? (root['data'] as Record<string, unknown>)
    : root;
  const attachments: AgentAttachment[] = [];
  const pdfUrl =
    (typeof data['pdf_url'] === 'string' && data['pdf_url']) ||
    (typeof data['pdfUrl'] === 'string' && (data['pdfUrl'] as string));
  if (pdfUrl) attachments.push({ kind: 'pdf', url: pdfUrl });
  return attachments;
}

/**
 * Main entrypoint. Generates `AgentSseEvent`s in the order:
 *   run_started → plan → (step_start → step_result)* → review → final
 * or short-circuits to `error` on Contract violation / timeout / crash.
 */
export async function* executeContractAgent(
  fastify: FastifyInstance,
  input: AgentRunInput,
): AsyncGenerator<AgentSseEvent, void, void> {
  const runId = crypto.randomUUID();
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  const tracker: RunSpendTracker = {
    workspaceId: input.workspaceId,
    runId,
    totalUsd: 0,
  };

  yield { type: 'run_started', runId };

  // ── Plan stage ─────────────────────────────────────────────────────────
  let plan: AgentPlan;
  try {
    plan = await runPlanner(fastify, input, tracker);
  } catch (err) {
    if (err instanceof CostBudgetExceededError) {
      yield {
        type: 'error',
        code: 'BUDGET_EXCEEDED',
        message: `${err.scope} cap reached ($${err.spentUsd.toFixed(4)} / $${err.capUsd.toFixed(4)})`,
      };
      await recordSpend(tracker.workspaceId, runId, tracker.totalUsd).catch(() => {});
      return;
    }
    yield {
      type: 'error',
      code: 'PLAN_PARSE_FAILED',
      message: err instanceof Error ? err.message : 'Planner error',
    };
    return;
  }

  // Whitelist check: any forbidden tool in the plan → hard fail.
  const violator = plan.steps.find((s) => !isAllowedAgentTool(s.tool));
  if (violator) {
    await logFeatureRequest(
      input.workspaceId,
      `[agent_contract_violation] attempted=${violator.tool}; msg=${input.message.slice(0, 500)}`,
      violator.tool,
      'none',
    );
    yield {
      type: 'error',
      code: 'CONTRACT_VIOLATION',
      message: `禁止ツール「${violator.tool}」が Plan に含まれています。whitelist: ${ALLOWED_AGENT_TOOLS.join(', ')}`,
    };
    return;
  }

  yield { type: 'plan', plan };

  // ── Execute loop ───────────────────────────────────────────────────────
  let lastOkResult: unknown = null;
  let lastOkTool: string = plan.steps[0]?.tool ?? '';

  for (let i = 0; i < plan.steps.length; i++) {
    if (i >= MAX_ITER) {
      yield {
        type: 'step_result',
        stepIndex: i,
        status: 'failed',
        error: `MAX_ITER (${MAX_ITER}) を超えたため skipped`,
      };
      continue;
    }
    if (Date.now() > deadline) {
      yield { type: 'error', code: 'TIMEOUT', message: 'Run timeout (90s) exceeded.', stepIndex: i };
      return;
    }

    const step = plan.steps[i];

    // Double-check (defence in depth): whitelist again right before dispatch.
    try {
      assertAllowedTool(step.tool);
    } catch (err) {
      if (err instanceof ContractViolationError) {
        await logFeatureRequest(
          input.workspaceId,
          `[agent_contract_violation] dispatch attempted=${err.attemptedTool}`,
          err.attemptedTool,
          'none',
        );
        yield {
          type: 'error',
          code: 'CONTRACT_VIOLATION',
          message: err.message,
          stepIndex: i,
        };
        return;
      }
      throw err;
    }

    yield { type: 'step_start', stepIndex: i, tool: step.tool };

    const dispatch = resolveAllowedToolDispatch(step.tool);
    if (!dispatch) {
      yield {
        type: 'step_result',
        stepIndex: i,
        status: 'failed',
        error: `Dispatch spec missing for tool ${step.tool}`,
      };
      return;
    }

    let attempt = 0;
    let ok = false;
    let lastError: string | undefined;
    let lastBody: unknown;

    let budgetError: CostBudgetExceededError | null = null;
    while (attempt <= PER_STEP_RETRIES && !ok) {
      attempt++;
      try {
        const payload = await buildToolInput(
          fastify,
          step.tool as AllowedAgentTool,
          step,
          input,
          plan.summary,
          tracker,
        );
        const { statusCode, body } = await executeToolViaInject(
          fastify,
          dispatch.path,
          dispatch.method,
          payload,
          input.workspaceId,
        );
        lastBody = body;
        if (statusCode >= 200 && statusCode < 300) {
          ok = true;
          break;
        }
        lastError = `HTTP ${statusCode}`;
      } catch (err) {
        if (err instanceof CostBudgetExceededError) {
          budgetError = err;
          break;
        }
        lastError = err instanceof Error ? err.message : 'unknown tool error';
      }
    }

    if (budgetError) {
      yield {
        type: 'error',
        code: 'BUDGET_EXCEEDED',
        message: `${budgetError.scope} cap reached ($${budgetError.spentUsd.toFixed(4)} / $${budgetError.capUsd.toFixed(4)})`,
        stepIndex: i,
      };
      await recordSpend(tracker.workspaceId, runId, tracker.totalUsd).catch(() => {});
      return;
    }

    if (!ok) {
      yield {
        type: 'step_result',
        stepIndex: i,
        status: 'failed',
        error: lastError ?? 'tool failed',
        result: lastBody,
      };
      // Stop executing further steps once one fails.
      yield {
        type: 'error',
        code: 'TOOL_FAILED',
        message: `step ${i} (${step.tool}) failed: ${lastError ?? 'unknown'}`,
        stepIndex: i,
      };
      return;
    }

    yield {
      type: 'step_result',
      stepIndex: i,
      status: 'ok',
      result: lastBody,
    };
    lastOkResult = lastBody;
    lastOkTool = step.tool;
  }

  // ── Review stage ──────────────────────────────────────────────────────
  const financial = extractFinancialData(lastOkResult);
  let arithmeticStatus: 'ok' | 'skipped' | 'failed' = 'skipped';
  let arithmeticNotes = '算術データ無し — スキップ';
  if (financial) {
    const check = checkArithmetic(financial);
    if (check.ok) {
      arithmeticStatus = 'ok';
      arithmeticNotes = '算術チェック通過';
    } else {
      arithmeticStatus = 'failed';
      arithmeticNotes = check.issues.map((x) => x.message).join(' / ');
    }
  }

  yield {
    type: 'review',
    status: arithmeticStatus === 'failed' ? 'failed' : 'ok',
    arithmeticOk: financial ? arithmeticStatus === 'ok' : undefined,
    notes: arithmeticNotes,
  };

  // ── Final stage ───────────────────────────────────────────────────────
  let reviewer: ReviewerOutput;
  try {
    reviewer = await runReviewer(fastify, {
      userMessage: input.message,
      planSummary: plan.summary,
      finalTool: lastOkTool,
      finalResult: lastOkResult,
      arithmeticStatus,
      arithmeticNotes,
    }, tracker);
  } catch (err) {
    if (err instanceof CostBudgetExceededError) {
      yield {
        type: 'error',
        code: 'BUDGET_EXCEEDED',
        message: `${err.scope} cap reached ($${err.spentUsd.toFixed(4)} / $${err.capUsd.toFixed(4)})`,
      };
      await recordSpend(tracker.workspaceId, runId, tracker.totalUsd).catch(() => {});
      return;
    }
    throw err;
  }

  yield {
    type: 'final',
    reply: reviewer.reply,
    attachments: extractAttachments(lastOkResult),
  };

  // Best-effort usage bookkeeping (Free-plan quota bucket).
  try {
    await recordUsage(input.workspaceId, 'agent', 'agent_run', runId);
  } catch {
    // Non-fatal.
  }

  // Best-effort cost bookkeeping for the daily-cap aggregator.
  try {
    await recordSpend(tracker.workspaceId, runId, tracker.totalUsd);
  } catch {
    // Non-fatal.
  }
}
