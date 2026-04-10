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

  const userEmail = request.user?.email ||
    (request.headers['x-user-email'] as string | undefined);
  if (userEmail) {
    try {
      const db = getKnex();
      const membership = await db('workspace_users')
        .where({ email: userEmail.toLowerCase() })
        .orderBy('created_at', 'asc')
        .first();
      if (membership?.workspace_id) {
        return membership.workspace_id as string;
      }
    } catch {
      // DB lookup failed, fall through to null
    }
  }

  // Only trust x-workspace-id when accompanied by the per-process internal
  // secret. This prevents external callers from impersonating workspaces by
  // setting the header directly. Only fastify.inject() calls from within the
  // same process (e.g. agent tool dispatch) can supply the correct secret.
  const internalSecret = request.headers['x-internal-secret'] as string | undefined;
  const workspaceHeader = request.headers['x-workspace-id'] as string | undefined;
  if (
    workspaceHeader &&
    internalSecret &&
    internalSecret === INTERNAL_SECRET
  ) {
    return workspaceHeader;
  }

  return null;
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
): Promise<{ allowed: true } | { allowed: false; error: string; current: number; limit: number }> {
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

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCallResult {
  content: string;
  traceId: string | null;
}

/**
 * Call an LLM via the FujiTrace proxy (fastify.inject) so the request is
 * automatically captured as a trace. This is the dog-fooding pattern used by
 * the chatbot engine (see src/chatbot/chat-engine.ts).
 */
export async function callLlmViaProxy(
  fastify: FastifyInstance,
  messages: LlmMessage[],
  opts?: { model?: string; temperature?: number; maxTokens?: number },
): Promise<LlmCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const injectResponse = await fastify.inject({
    method: 'POST',
    url: '/v1/chat/completions',
    headers: { 'content-type': 'application/json' },
    payload: {
      model: opts?.model || 'gpt-4o-mini',
      messages,
      temperature: opts?.temperature ?? 0.2,
      maxTokens: opts?.maxTokens ?? 2048,
      api_key: apiKey,
    },
  });

  if (injectResponse.statusCode !== 200) {
    throw new Error(`LLM proxy returned ${injectResponse.statusCode}: ${injectResponse.body}`);
  }

  const parsed = JSON.parse(injectResponse.body) as {
    choices?: Array<{ message?: { content?: string } }>;
    _trace?: { requestId?: string };
  };

  const content = parsed.choices?.[0]?.message?.content ?? '';
  const traceId = parsed._trace?.requestId ?? null;

  return { content, traceId };
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
 * Call an LLM via the FujiTrace proxy with OpenAI function-calling support.
 *
 * Similar to `callLlmViaProxy` but includes the `tools` array and
 * `tool_choice: 'auto'` in the payload, and parses `tool_calls` from the
 * response. Used by the AI 事務員 agent for tool dispatch.
 *
 * Default model is `gpt-4o` (not gpt-4o-mini) because the agent needs
 * better reasoning for tool matching decisions.
 */
export async function callLlmWithTools(
  fastify: FastifyInstance,
  messages: LlmMessage[],
  tools: unknown[],
  opts?: { model?: string; temperature?: number; maxTokens?: number },
): Promise<LlmToolCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const injectResponse = await fastify.inject({
    method: 'POST',
    url: '/v1/chat/completions',
    headers: { 'content-type': 'application/json' },
    payload: {
      model: opts?.model || 'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: opts?.temperature ?? 0.2,
      maxTokens: opts?.maxTokens ?? 2048,
      api_key: apiKey,
    },
  });

  if (injectResponse.statusCode !== 200) {
    throw new Error(`LLM proxy returned ${injectResponse.statusCode}: ${injectResponse.body}`);
  }

  const parsed = JSON.parse(injectResponse.body) as {
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
    _trace?: { requestId?: string };
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
  const traceId = parsed._trace?.requestId ?? null;

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
