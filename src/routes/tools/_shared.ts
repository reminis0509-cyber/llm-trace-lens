/**
 * Shared helpers for FujiTrace AI Tools routes.
 * - Workspace resolution
 * - Prompt template loader
 * - Free-tier monthly quota check
 * - Usage recording
 * - LLM call via FujiTrace proxy (fastify.inject → /v1/chat/completions)
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getKnex } from '../../storage/knex-client.js';
import { getWorkspacePlan } from '../../plans/storage.js';
import { recordLlmTrace } from '../../agent/trace-recorder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Per-process secret used to authenticate internal fastify.inject() calls.
 * External HTTP callers cannot know this value, so spoofing x-workspace-id
 * from outside the process is impossible.
 */
export const INTERNAL_SECRET = crypto.randomUUID();

// Free plan monthly quota for ai_tools usage (per workspace)
export const FREE_PLAN_MONTHLY_QUOTA = 10;

/**
 * Resolve workspaceId from request context.
 *
 * SECURITY: Strict authentication policy — this function NEVER returns a
 * fallback workspace id. If the caller cannot be mapped to a real workspace
 * via (a) request.workspace (auth middleware), (b) workspace_users lookup by
 * email, or (c) an explicit x-workspace-id header from a trusted context,
 * this function returns `null` and the caller MUST respond with 401.
 *
 * The previous `'default'` fallback cross-contaminated data between
 * unrelated users and has been removed (QA finding H-1).
 */
export async function resolveWorkspaceId(request: FastifyRequest): Promise<string | null> {
  if (request.workspace?.workspaceId) {
    return request.workspace.workspaceId;
  }

  // INTERNAL_SECRET bypass for fastify.inject() calls from within the same
  // process (agent / clerk tool dispatch). External callers cannot know the
  // per-process UUID, so this cannot be spoofed over HTTP.
  const internalSecret = request.headers['x-internal-secret'] as string | undefined;
  const workspaceHeader = request.headers['x-workspace-id'] as string | undefined;
  if (workspaceHeader && internalSecret && internalSecret === INTERNAL_SECRET) {
    return workspaceHeader;
  }

  // Only trust emails that have been authenticated server-side by the rbac
  // plugin (session cookie or verified Supabase JWT). Client-supplied
  // `x-user-email` headers are NEVER trusted — spoofing them previously
  // allowed cross-workspace IDOR (QA Issue #1).
  const userEmail = request.user?.email;
  if (!userEmail) return null;

  try {
    const db = getKnex();
    const membership = await db('workspace_users')
      .where({ email: userEmail.toLowerCase() })
      .orderBy('created_at', 'asc')
      .first();
    return (membership?.workspace_id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Module-level guard so ensureAiToolsTables() only performs schema work on
 * the first invocation per process (QA finding M-3).
 */
let aiToolsTablesReady = false;

/**
 * Ensure ai_tools tables exist (auto-create if missing).
 * This is a safety net for environments where migrations have not been run yet.
 * Subsequent calls after the first successful run are no-ops.
 */
export async function ensureAiToolsTables(): Promise<void> {
  if (aiToolsTablesReady) return;
  const db = getKnex();

  const hasBusinessInfo = await db.schema.hasTable('user_business_info');
  if (!hasBusinessInfo) {
    await db.schema.createTable('user_business_info', (table) => {
      table.string('id').primary();
      table.string('workspace_id').notNullable().index();
      table.string('company_name').notNullable();
      table.string('address').nullable();
      table.string('phone').nullable();
      table.string('email').nullable();
      table.string('invoice_number').nullable();
      table.string('bank_name').nullable();
      table.string('bank_branch').nullable();
      table.string('account_type').nullable();
      table.string('account_number').nullable();
      table.string('account_holder').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
  }

  const hasUsage = await db.schema.hasTable('ai_tools_usage');
  if (!hasUsage) {
    await db.schema.createTable('ai_tools_usage', (table) => {
      table.string('id').primary();
      table.string('workspace_id').notNullable().index();
      table.string('tool_name').notNullable();
      table.string('action').notNullable();
      table.string('trace_id').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now()).index();
    });
  }

  aiToolsTablesReady = true;
}

/**
 * Load a prompt template file from src/prompts/tools/.
 * Path is resolved relative to this module's compiled location.
 */
export function loadPromptTemplate(relativePath: string): string {
  // From src/routes/tools/_shared.ts → src/prompts/tools/<relativePath>
  const promptsDir = path.resolve(__dirname, '..', '..', 'prompts', 'tools');
  const fullPath = path.join(promptsDir, relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Render a template by replacing {placeholder} tokens.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.split(`{${key}}`).join(value);
  }
  return result;
}

/**
 * Count ai_tools_usage entries for a workspace in the current calendar month.
 */
export async function getMonthlyUsageCount(workspaceId: string): Promise<number> {
  await ensureAiToolsTables();
  const db = getKnex();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const result = await db('ai_tools_usage')
    .where({ workspace_id: workspaceId })
    .andWhere('created_at', '>=', monthStart)
    .count('id as count')
    .first();
  return Number(result?.count ?? 0);
}

/**
 * Check whether the workspace is on the Free plan.
 */
export async function isFreePlan(workspaceId: string): Promise<boolean> {
  const plan = await getWorkspacePlan(workspaceId);
  return plan.planType === 'free';
}

/**
 * Enforce the Free-plan monthly quota. Returns null if allowed,
 * or an error object if quota exceeded.
 */
export async function enforceFreeQuota(
  workspaceId: string,
  request?: FastifyRequest,
): Promise<{ allowed: true } | { allowed: false; error: string; current: number; limit: number }> {
  if (request) {
    // Internal calls from AI agent (fastify.inject with INTERNAL_SECRET) bypass quota
    const internalSecret = request.headers['x-internal-secret'] as string | undefined;
    if (internalSecret && internalSecret === INTERNAL_SECRET) {
      return { allowed: true };
    }
    // Admin users bypass quota — use server-verified email from rbac plugin.
    // Client-supplied x-user-email headers are NEVER trusted (QA Issue #1:
    // previously any caller could spoof an admin email to bypass Free quota,
    // causing direct financial impact).
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    const userEmail = (request.user?.email || '').toLowerCase();
    if (userEmail && adminEmails.includes(userEmail)) {
      return { allowed: true };
    }
  }
  const free = await isFreePlan(workspaceId);
  if (!free) {
    return { allowed: true };
  }
  const count = await getMonthlyUsageCount(workspaceId);
  if (count >= FREE_PLAN_MONTHLY_QUOTA) {
    return {
      allowed: false,
      error: `Freeプランの今月の利用上限（${FREE_PLAN_MONTHLY_QUOTA}件）に達しました。Proプランへのアップグレードをご検討ください。`,
      current: count,
      limit: FREE_PLAN_MONTHLY_QUOTA,
    };
  }
  return { allowed: true };
}

/**
 * Record an ai_tools_usage event.
 */
export async function recordUsage(
  workspaceId: string,
  toolName: string,
  action: string,
  traceId: string | null,
): Promise<void> {
  await ensureAiToolsTables();
  const db = getKnex();
  await db('ai_tools_usage').insert({
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    tool_name: toolName,
    action,
    trace_id: traceId,
    created_at: new Date().toISOString(),
  });
}

/** A single text or image_url part within a multimodal message. */
export type LlmContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | LlmContentPart[];
}

export interface LlmTokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface LlmCallResult {
  content: string;
  traceId: string | null;
  usage: LlmTokenUsage | null;
}

/**
 * Call OpenAI for a free-text completion and persist the result as a
 * FujiTrace trace.
 *
 * Historical note (2026-04-25 bucket-hole patch): the function name
 * implies "via proxy" but the implementation has called OpenAI directly
 * since at least 2026-03 (the proxy enforcer wraps responses in JSON
 * mode, which broke chat-style consumers). Until this fix, the trace
 * pipeline was completely bypassed for every internal caller — every
 * tool, every agent, every LINE message. The data the M&A thesis depends
 * on was being dropped on the floor.
 *
 * The fix below keeps the direct-fetch path (it's fast and correct) but
 * threads the response through `recordLlmTrace` so the same DB / KV /
 * LLM-as-Judge / cost-tracking pipeline runs after every call.
 *
 * **`opts.workspaceId` is strongly recommended.** Without it the trace
 * cannot be attributed to a workspace and won't appear in any dashboard
 * — we log a warning but don't throw, so legacy callers don't break
 * during the migration. New code MUST pass workspaceId.
 */
export async function callLlmViaProxy(
  _fastify: FastifyInstance,
  messages: LlmMessage[],
  opts?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    workspaceId?: string;
    traceType?: 'standard' | 'agent';
  },
): Promise<LlmCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const startTime = Date.now();
  const model = opts?.model || 'gpt-4o-mini';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts?.temperature ?? 0.2,
      max_tokens: opts?.maxTokens ?? 2048,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API returned ${response.status}: ${errorBody}`);
  }

  const parsed = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    id?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
    };
  };

  const content = parsed.choices?.[0]?.message?.content ?? '';
  const traceId = parsed.id ?? null;
  const rawUsage = parsed.usage;
  const usage: LlmTokenUsage | null =
    rawUsage && typeof rawUsage.prompt_tokens === 'number' && typeof rawUsage.completion_tokens === 'number'
      ? { promptTokens: rawUsage.prompt_tokens, completionTokens: rawUsage.completion_tokens }
      : null;

  // ─── Persist as FujiTrace trace (bucket-hole patch) ─────────────────
  if (opts?.workspaceId) {
    recordLlmTrace({
      workspaceId: opts.workspaceId,
      startTime,
      provider: 'openai',
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
      responseText: content,
      usage: usage ?? undefined,
      traceType: opts.traceType ?? 'standard',
    });
  } else {
    // Legacy caller hasn't migrated yet. Log enough context to grep the
    // remaining call sites in production logs.
    console.warn(
      '[callLlmViaProxy] workspaceId missing — trace will NOT be persisted. ' +
        `model=${model} firstUserMsg=${truncateForLog(messages.find((m) => m.role === 'user')?.content)}`,
    );
  }

  return { content, traceId, usage };
}

function truncateForLog(s: unknown): string {
  if (typeof s !== 'string') return '<non-string>';
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

/**
 * Result from an LLM call that may include tool calls (function calling).
 */
export interface LlmToolCallResult {
  content: string | null;
  toolCalls: Array<{
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  traceId: string | null;
}

/**
 * Call OpenAI directly with function-calling support.
 *
 * Does NOT go through the FujiTrace proxy enforcer (which would force
 * JSON-mode output and strip `tools` / `tool_choice`). Instead, this
 * preserves function-calling semantics for the AI 事務員 agent.
 *
 * Trace persistence (2026-04-25): same bucket-hole fix as
 * `callLlmViaProxy`. When `opts.workspaceId` is provided the response
 * is recorded via `recordLlmTrace`. We record only the natural-language
 * content (`message.content`); tool_calls themselves go to the
 * structured AgentTrace pipeline upstream and don't fit the
 * StructuredResponse free-text shape.
 */
export async function callLlmWithTools(
  _fastify: FastifyInstance,
  messages: LlmMessage[],
  tools: unknown[],
  opts?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    workspaceId?: string;
    traceType?: 'standard' | 'agent';
  },
): Promise<LlmToolCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const startTime = Date.now();
  const model = opts?.model || 'gpt-4o';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: opts?.temperature ?? 0.2,
      max_tokens: opts?.maxTokens ?? 4096,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API returned ${response.status}: ${errorBody}`);
  }

  const parsed = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          id: string;
          type: string;
          function: {
            name: string;
            arguments: string;
          };
        }>;
      };
    }>;
    id?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const message = parsed.choices?.[0]?.message;
  const content = message?.content ?? null;
  const rawToolCalls = message?.tool_calls ?? [];
  const toolCalls = rawToolCalls.map((tc) => ({
    id: tc.id,
    function: {
      name: tc.function.name,
      arguments: tc.function.arguments,
    },
  }));
  const traceId = parsed.id ?? null;

  if (opts?.workspaceId) {
    const rawUsage = parsed.usage;
    const usage =
      rawUsage &&
      typeof rawUsage.prompt_tokens === 'number' &&
      typeof rawUsage.completion_tokens === 'number'
        ? {
            promptTokens: rawUsage.prompt_tokens,
            completionTokens: rawUsage.completion_tokens,
          }
        : undefined;
    // toolCalls is structured data — surface it in the recorded answer
    // text so dashboard search can find the function names. Full tool
    // I/O is captured by the agent's own AgentTrace upstream.
    const responseText =
      content ??
      (toolCalls.length > 0
        ? `[tool_calls] ${toolCalls.map((tc) => tc.function.name).join(', ')}`
        : '');
    recordLlmTrace({
      workspaceId: opts.workspaceId,
      startTime,
      provider: 'openai',
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
      responseText,
      usage,
      traceType: opts.traceType ?? 'agent',
    });
  } else {
    console.warn(
      `[callLlmWithTools] workspaceId missing — trace will NOT be persisted. model=${model}`,
    );
  }

  return { content, toolCalls, traceId };
}

/**
 * Robustly parse JSON from LLM output. Strips markdown code fences if present.
 */
export function parseLlmJson<T>(raw: string): T {
  let cleaned = raw.trim();
  // Strip ```json ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  // Find first '{' and last '}' to be tolerant of leading/trailing prose
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned) as T;
}
