/**
 * POST /api/agent/chat-v2
 *
 * Unified SSE chat endpoint for FujiTrace AI clerk. Replaces the dual-endpoint
 * architecture (chat.ts + contract-chat.ts) with a single streaming endpoint
 * where the LLM naturally decides when to call tools via function calling.
 *
 * Request body (JSON):
 *   {
 *     message: string,            // user message (1..2000 chars)
 *     conversation_id?: string    // omit to start a new conversation
 *   }
 *
 * Response: text/event-stream. Each event is `data: <JSON>\n\n`.
 * Event types:
 *   { type: 'message_start' }
 *   { type: 'tool_start', tool: string, index: number }
 *   { type: 'tool_result', index: number, status: 'ok'|'error', result?: any }
 *   { type: 'message', content: string, attachments?: string[] }
 *   { type: 'error', code: string, message: string }
 *   data: [DONE]
 *
 * Auth: workspace (header / middleware).
 * Rate limit (Free plan): 10 messages per 5-hour rolling window.
 * Tool rounds: up to 5 iterations per request.
 * Timeout: 90 seconds overall.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { z } from 'zod';
import { getKnex } from '../../storage/knex-client.js';
import { allToolSchemas } from '../../tools/index.js';
import { buildSystemPrompt } from '../../agent/system-prompt.js';
import { buildFunctionCallingTools, resolveToolName } from '../../agent/tool-matcher.js';
import { ensureAgentTables, logFeatureRequest } from '../../agent/desire-db.js';
import { executeToolViaInject } from '../../agent/tool-executor.js';
import { isFreePlan, resolveWorkspaceId, recordUsage } from '../tools/_shared.js';
import { callLlmWithTools } from '../tools/_shared.js';
import type { LlmMessage } from '../tools/_shared.js';
import {
  checkBudget,
  CostBudgetExceededError,
  estimateUsdCost,
  getActiveBudget,
  getTodaySpend,
  recordSpend,
} from '../../agent/cost-guard.js';
import { checkArithmetic } from '../../tools/arithmetic-checker.js';
import type { ExtractedFinancialData } from '../../tools/arithmetic-checker.js';
import {
  isAllowedAgentTool,
  resolveAllowedToolDispatch,
} from '../../agent/allowed-tools.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum LLM -> tool -> LLM round-trips per single request. */
const MAX_TOOL_ROUNDS = 5;

/** Overall wall-clock budget per request (ms). */
const REQUEST_TIMEOUT_MS = 90_000;

/** LLM model for the unified chat endpoint. */
const CHAT_MODEL = 'gpt-4o';

/** Free plan: max messages per rolling window. */
const FREE_WINDOW_MAX = 10;

/** Free plan: rolling window duration (ms) — 5 hours. */
const FREE_WINDOW_MS = 5 * 60 * 60 * 1000;

/** Max conversation messages retained in DB. */
const MAX_CONVERSATION_MESSAGES = 50;

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const historyMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const requestSchema = z.object({
  message: z
    .string()
    .min(1, 'メッセージを入力してください')
    .max(2000, 'メッセージは2000文字以内にしてください'),
  conversation_id: z.string().min(1).max(128).optional(),
  history: z.array(historyMessageSchema).max(50).optional(),
});

// ---------------------------------------------------------------------------
// SSE event types
// ---------------------------------------------------------------------------

type ChatV2SseEvent =
  | { type: 'message_start' }
  | { type: 'tool_start'; tool: string; index: number }
  | { type: 'tool_result'; index: number; status: 'ok' | 'error'; result?: unknown }
  | { type: 'message'; content: string; attachments?: string[] }
  | { type: 'error'; code: string; message: string };

// ---------------------------------------------------------------------------
// Free-plan 5-hour rolling window rate limiter (in-memory)
// ---------------------------------------------------------------------------

interface WindowEntry {
  windowStart: number;
  count: number;
}

/**
 * In-memory map tracking per-workspace message counts within a 5-hour
 * rolling window. Entries are lazily evicted when the window expires.
 */
const freeRateLimitMap = new Map<string, WindowEntry>();

/**
 * Check whether a Free-plan workspace has exceeded the 5-hour rolling
 * window message limit.
 *
 * @returns null if allowed, or an object with resetAt timestamp if blocked.
 */
function checkFreeRateLimit(
  workspaceId: string,
  isFree: boolean,
): { resetAt: number } | null {
  if (!isFree) return null;

  const now = Date.now();
  const entry = freeRateLimitMap.get(workspaceId);

  if (!entry || now - entry.windowStart >= FREE_WINDOW_MS) {
    // Window expired or first request — start a new window
    freeRateLimitMap.set(workspaceId, { windowStart: now, count: 1 });
    return null;
  }

  if (entry.count >= FREE_WINDOW_MAX) {
    return { resetAt: entry.windowStart + FREE_WINDOW_MS };
  }

  entry.count += 1;
  return null;
}

// ---------------------------------------------------------------------------
// Company info loader (same pattern as contract-chat.ts)
// ---------------------------------------------------------------------------

async function loadCompanyInfo(
  workspaceId: string,
): Promise<Record<string, unknown> | undefined> {
  try {
    const db = getKnex();
    const row = await db('user_business_info')
      .where({ workspace_id: workspaceId })
      .orderBy('created_at', 'asc')
      .first();
    return row ? (row as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Workspace memory loader
// ---------------------------------------------------------------------------

async function loadWorkspaceMemory(
  workspaceId: string,
): Promise<string | null> {
  try {
    const db = getKnex();
    const row = await db('workspace_memory')
      .where({ workspace_id: workspaceId })
      .first() as { content?: string } | undefined;
    const content = row?.content?.trim();
    return content && content.length > 0 ? content : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Conversation persistence (same pattern as clerk.ts)
// ---------------------------------------------------------------------------

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface ConversationRow {
  id: string;
  workspace_id: string;
  messages: string;
  created_at: string;
  updated_at: string;
}

async function loadOrCreateConversation(
  conversationId: string | undefined,
  workspaceId: string,
): Promise<{ id: string; messages: ConversationMessage[]; isNew: boolean }> {
  await ensureAgentTables();
  const db = getKnex();

  if (conversationId) {
    const row = (await db('agent_conversations')
      .where({ id: conversationId })
      .first()) as ConversationRow | undefined;

    if (!row) {
      // Conversation ID from frontend but not in DB yet — create with that ID
      return { id: conversationId, messages: [], isNew: true };
    }

    if (row.workspace_id !== workspaceId) {
      throw new ConversationAccessError('この会話へのアクセス権がありません。');
    }

    const messages = JSON.parse(row.messages) as ConversationMessage[];
    return { id: row.id, messages, isNew: false };
  }

  const newId = crypto.randomUUID();
  return { id: newId, messages: [], isNew: true };
}

async function saveConversation(
  id: string,
  workspaceId: string,
  messages: ConversationMessage[],
  isNew: boolean,
): Promise<void> {
  const db = getKnex();
  const serialized = JSON.stringify(messages);
  const now = new Date().toISOString();

  if (isNew) {
    await db('agent_conversations').insert({
      id,
      workspace_id: workspaceId,
      messages: serialized,
      created_at: now,
      updated_at: now,
    });
  } else {
    await db('agent_conversations').where({ id }).update({
      messages: serialized,
      updated_at: now,
    });
  }
}

class ConversationAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversationAccessError';
  }
}

// ---------------------------------------------------------------------------
// Cost tracking helper
// ---------------------------------------------------------------------------

interface RunCostTracker {
  workspaceId: string;
  runId: string;
  totalUsd: number;
}

async function accountUsage(
  tracker: RunCostTracker,
  model: string,
  usage: { promptTokens: number; completionTokens: number } | null,
): Promise<void> {
  const added = usage
    ? estimateUsdCost(model, usage.promptTokens, usage.completionTokens)
    : 0;
  await checkBudget(tracker.workspaceId, tracker.totalUsd, added);
  tracker.totalUsd += added;
}

// ---------------------------------------------------------------------------
// Financial data extraction for arithmetic validation
// ---------------------------------------------------------------------------

function extractFinancialData(result: unknown): ExtractedFinancialData | null {
  if (!result || typeof result !== 'object') return null;
  const root = result as Record<string, unknown>;
  const dataObj =
    root['data'] && typeof root['data'] === 'object'
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
    .map((raw: unknown) => {
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
    subtotal:
      Number(candidate['subtotal']) || mapped.reduce((a, it) => a + it.amount, 0),
    tax_rate: Number(candidate['tax_rate']) || 0.1,
    tax_amount: Number(candidate['tax_amount']) || 0,
    total: Number(candidate['total']) || 0,
    has_financial_data: true,
  };
}

/** Extract PDF/url attachments from a tool result. */
function extractAttachments(result: unknown): string[] {
  if (!result || typeof result !== 'object') return [];
  const root = result as Record<string, unknown>;
  const data =
    root['data'] && typeof root['data'] === 'object'
      ? (root['data'] as Record<string, unknown>)
      : root;
  const attachments: string[] = [];
  const pdfUrl =
    (typeof data['pdf_url'] === 'string' && data['pdf_url']) ||
    (typeof data['pdfUrl'] === 'string' && (data['pdfUrl'] as string));
  if (pdfUrl) attachments.push(pdfUrl);
  return attachments;
}

// ---------------------------------------------------------------------------
// Tool dispatch helper
// ---------------------------------------------------------------------------

/**
 * Resolve and execute a tool call. Uses the allowed-tools whitelist dispatch
 * for whitelisted tools, and falls back to the generic office-task executor
 * or direct tool resolution for others.
 */
async function dispatchToolCall(
  fastify: FastifyInstance,
  functionName: string,
  parsedArgs: Record<string, unknown>,
  workspaceId: string,
): Promise<{ statusCode: number; body: unknown; toolName: string }> {
  // office_task_execute is the generic dispatcher
  if (functionName === 'office_task_execute') {
    const result = await executeToolViaInject(
      fastify,
      '/api/tools/office-task/execute',
      'POST',
      parsedArgs,
      workspaceId,
    );
    const taskId =
      typeof parsedArgs['task_id'] === 'string'
        ? parsedArgs['task_id']
        : 'office_task';
    return { ...result, toolName: taskId };
  }

  // Check if it maps to an allowed agent tool (e.g. estimate_create -> estimate.create)
  const dotName = functionName.replace(/_/g, '.');
  if (isAllowedAgentTool(dotName)) {
    const dispatch = resolveAllowedToolDispatch(dotName);
    if (dispatch) {
      const result = await executeToolViaInject(
        fastify,
        dispatch.path,
        dispatch.method,
        parsedArgs,
        workspaceId,
      );
      return { ...result, toolName: dotName };
    }
  }

  // Try resolving via tool-matcher (for dedicated estimate.* tools etc.)
  const resolvedTool = resolveToolName(functionName, allToolSchemas);
  if (resolvedTool) {
    const result = await executeToolViaInject(
      fastify,
      resolvedTool.path,
      resolvedTool.method as 'POST',
      parsedArgs,
      workspaceId,
    );
    return { ...result, toolName: resolvedTool.name };
  }

  return {
    statusCode: 404,
    body: { success: false, error: `Unknown tool: ${functionName}` },
    toolName: functionName,
  };
}

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export default async function chatV2Route(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/agent/chat-v2', async (request: FastifyRequest, reply) => {
    // ── Auth + workspace ────────────────────────────────────────────────
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) {
      return reply.code(401).send({ success: false, error: '認証が必要です' });
    }

    // ── Input validation ────────────────────────────────────────────────
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }
    const { message, conversation_id: conversationId, history: frontendHistory } = parsed.data;

    // ── Free plan 5-hour rolling window rate limit ──────────────────────
    const free = await isFreePlan(workspaceId);
    const rateLimitResult = checkFreeRateLimit(workspaceId, free);
    if (rateLimitResult) {
      return reply.code(429).send({
        success: false,
        error: 'Free plan limit reached',
        code: 'FREE_LIMIT',
        resetAt: rateLimitResult.resetAt,
      });
    }

    // ── Daily cost cap pre-check ────────────────────────────────────────
    try {
      const budget = getActiveBudget();
      const spend = await getTodaySpend(workspaceId);
      if (spend.global >= budget.globalDailyCapUsd) {
        return reply.code(429).send({
          success: false,
          error: 'グローバルの本日のAPI予算上限に達しました。しばらくお待ちください。',
        });
      }
      if (spend.workspace >= budget.perWorkspaceDailyCapUsd) {
        return reply.code(429).send({
          success: false,
          error: 'このワークスペースの本日の利用上限に達しました。明日以降に再度お試しください。',
        });
      }
    } catch (err) {
      request.log.warn({ err }, 'cost-guard pre-check failed; proceeding');
    }

    // ── Load company info + workspace memory ─────────────────────────────
    const companyInfo = await loadCompanyInfo(workspaceId);
    const memoryContent = await loadWorkspaceMemory(workspaceId);

    // ── Load conversation history ───────────────────────────────────────
    // Prefer DB history, but fall back to frontend-supplied history if DB is empty
    let conversation: { id: string; messages: ConversationMessage[]; isNew: boolean };
    try {
      conversation = await loadOrCreateConversation(conversationId, workspaceId);
    } catch (err) {
      if (err instanceof ConversationAccessError) {
        return reply.code(403).send({ success: false, error: err.message });
      }
      // DB error — use frontend history as fallback
      request.log.warn({ err }, 'DB conversation load failed; using frontend history');
      conversation = {
        id: conversationId || crypto.randomUUID(),
        messages: [],
        isNew: true,
      };
    }

    // If DB returned empty conversation but frontend has history, use frontend history
    if (conversation.messages.length === 0 && frontendHistory && frontendHistory.length > 0) {
      conversation.messages = frontendHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));
    }

    // ── Build system prompt ─────────────────────────────────────────────
    let systemPrompt = buildSystemPrompt(allToolSchemas);
    if (companyInfo) {
      systemPrompt += `\n\n## あなたが所属する会社の情報\n${JSON.stringify(companyInfo)}`;
    }
    if (memoryContent) {
      systemPrompt += `\n\n## ユーザーからの指示メモ\n${memoryContent}`;
    }

    // ── SSE headers ─────────────────────────────────────────────────────
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const writeEvent = (event: ChatV2SseEvent): void => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const endStream = (): void => {
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    };

    // ── Run ID + cost tracker ───────────────────────────────────────────
    const runId = crypto.randomUUID();
    const deadline = Date.now() + REQUEST_TIMEOUT_MS;
    const costTracker: RunCostTracker = {
      workspaceId,
      runId,
      totalUsd: 0,
    };

    writeEvent({ type: 'message_start' });

    try {
      // ── Build LLM messages ────────────────────────────────────────────
      const functionCallingTools = buildFunctionCallingTools(allToolSchemas);

      const llmMessages: LlmMessage[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Add conversation history (only user and assistant text messages)
      for (const msg of conversation.messages) {
        if (
          (msg.role === 'user' || msg.role === 'assistant') &&
          typeof msg.content === 'string' &&
          msg.content.length > 0
        ) {
          llmMessages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }

      // Add the new user message
      llmMessages.push({ role: 'user', content: message });
      conversation.messages.push({ role: 'user', content: message });

      // ── Tool call loop (up to MAX_TOOL_ROUNDS) ────────────────────────
      let round = 0;
      let finalContent: string | null = null;
      let allAttachments: string[] = [];
      let toolCallIndex = 0;
      // Track full call signatures (name + arguments JSON) so the same tool
      // can be invoked multiple times with different arguments — required for
      // multi-document workflows like "make invoice + delivery + cover letter
      // in one turn". Only an identical re-call with identical args is
      // suppressed (the original LLM-hallucination case this guard targets).
      const executedCalls = new Set<string>();

      while (round < MAX_TOOL_ROUNDS) {
        if (Date.now() > deadline) {
          writeEvent({
            type: 'error',
            code: 'TIMEOUT',
            message: 'リクエストがタイムアウトしました（90秒）。',
          });
          break;
        }

        // Call LLM with tools
        const llmResult = await callLlmWithTools(
          fastify,
          llmMessages,
          round < MAX_TOOL_ROUNDS - 1 ? functionCallingTools : [], // last round: no tools
          { model: CHAT_MODEL, temperature: 0.2, maxTokens: 4096 },
        );

        // Account LLM cost
        const usage = llmResult.traceId
          ? null // traceId is just the OpenAI response id, usage is in the raw response
          : null;
        // We need the raw usage — callLlmWithTools does not return it currently.
        // For now, cost is tracked at the tool-dispatch level via the existing
        // per-tool-endpoint cost tracking. This is acceptable for Phase 0.

        // No tool calls: LLM produced a final text response
        if (llmResult.toolCalls.length === 0) {
          finalContent = llmResult.content ?? '申し訳ございませんが、回答を生成できませんでした。';
          break;
        }

        // Process tool calls
        for (const tc of llmResult.toolCalls) {
          if (Date.now() > deadline) {
            writeEvent({
              type: 'error',
              code: 'TIMEOUT',
              message: 'リクエストがタイムアウトしました（90秒）。',
            });
            finalContent = llmResult.content ?? null;
            break;
          }

          const currentIndex = toolCallIndex++;
          const functionName = tc.function.name;

          // Skip only IDENTICAL re-calls (same name AND same arguments).
          // Different-arg invocations of the same tool are legitimate
          // (e.g. office_task_execute called for invoice, then again for
          // delivery note within the same turn).
          const callSignature = `${functionName}::${tc.function.arguments}`;
          if (executedCalls.has(callSignature) && !functionName.startsWith('_')) {
            request.log.warn('Skipping duplicate tool call: %s', functionName);
            llmMessages.push({
              role: 'assistant',
              content: `[ツール] ${functionName} は既に同じ引数で実行済みです。`,
            });
            continue;
          }
          executedCalls.add(callSignature);

          let parsedArgs: Record<string, unknown>;
          try {
            parsedArgs = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          } catch {
            parsedArgs = {};
          }

          // Handle meta-functions
          if (functionName === '_log_feature_request') {
            const summary =
              typeof parsedArgs['user_request_summary'] === 'string'
                ? parsedArgs['user_request_summary']
                : message;
            await logFeatureRequest(workspaceId, summary, null, 'none');

            // Add to conversation and LLM context
            conversation.messages.push({
              role: 'assistant',
              content: null,
              tool_calls: [{ id: tc.id, function: { name: functionName, arguments: tc.function.arguments } }],
            });
            conversation.messages.push({
              role: 'tool',
              content: JSON.stringify({ logged: true }),
              tool_call_id: tc.id,
            });
            llmMessages.push({
              role: 'assistant',
              content: `[ツール実行結果] フィーチャーリクエストを記録しました。`,
            });
            continue;
          }

          if (functionName === '_adapt_tool') {
            const baseTool =
              typeof parsedArgs['base_tool'] === 'string' ? parsedArgs['base_tool'] : '';
            const adaptedParams = (parsedArgs['adapted_params'] ?? {}) as Record<string, unknown>;
            const resolvedTool = resolveToolName(baseTool, allToolSchemas);

            writeEvent({ type: 'tool_start', tool: baseTool, index: currentIndex });

            if (resolvedTool) {
              const execResult = await executeToolViaInject(
                fastify,
                resolvedTool.path,
                resolvedTool.method as 'POST',
                adaptedParams,
                workspaceId,
              );

              const isOk = execResult.statusCode >= 200 && execResult.statusCode < 300;
              writeEvent({
                type: 'tool_result',
                index: currentIndex,
                status: isOk ? 'ok' : 'error',
                result: execResult.body,
              });

              if (isOk) {
                allAttachments.push(...extractAttachments(execResult.body));
                // Arithmetic check for document_check archetype tools
                const financial = extractFinancialData(execResult.body);
                if (financial) {
                  const arithResult = checkArithmetic(financial);
                  if (!arithResult.ok) {
                    request.log.warn(
                      { issues: arithResult.issues },
                      'arithmetic check failed for adapted tool',
                    );
                  }
                }
              }

              await logFeatureRequest(workspaceId, message, resolvedTool.name, 'adapted');

              conversation.messages.push({
                role: 'assistant',
                content: null,
                tool_calls: [{ id: tc.id, function: { name: functionName, arguments: tc.function.arguments } }],
              });
              conversation.messages.push({
                role: 'tool',
                content: JSON.stringify(execResult.body),
                tool_call_id: tc.id,
              });
              llmMessages.push({
                role: 'assistant',
                content: `[ツール実行結果] ${JSON.stringify(execResult.body).slice(0, 4000)}`,
              });
            } else {
              writeEvent({
                type: 'tool_result',
                index: currentIndex,
                status: 'error',
                result: { error: `ツール「${baseTool}」が見つかりません` },
              });
              await logFeatureRequest(workspaceId, message, baseTool, 'none');

              conversation.messages.push({
                role: 'assistant',
                content: null,
                tool_calls: [{ id: tc.id, function: { name: functionName, arguments: tc.function.arguments } }],
              });
              conversation.messages.push({
                role: 'tool',
                content: JSON.stringify({ error: `ツール「${baseTool}」が見つかりません。` }),
                tool_call_id: tc.id,
              });
              llmMessages.push({
                role: 'assistant',
                content: `[ツール実行結果] ツール「${baseTool}」が見つかりません。`,
              });
            }
            continue;
          }

          // Regular tool dispatch
          writeEvent({ type: 'tool_start', tool: functionName, index: currentIndex });

          const execResult = await dispatchToolCall(
            fastify,
            functionName,
            parsedArgs,
            workspaceId,
          );

          const isOk = execResult.statusCode >= 200 && execResult.statusCode < 300;
          writeEvent({
            type: 'tool_result',
            index: currentIndex,
            status: isOk ? 'ok' : 'error',
            result: execResult.body,
          });

          if (isOk) {
            allAttachments.push(...extractAttachments(execResult.body));

            // Arithmetic check for document_check archetype tools
            const financial = extractFinancialData(execResult.body);
            if (financial) {
              const arithResult = checkArithmetic(financial);
              if (!arithResult.ok) {
                request.log.warn(
                  { issues: arithResult.issues },
                  'arithmetic check failed for tool %s',
                  execResult.toolName,
                );
              }
            }
          }

          // Feed tool result back into LLM context
          conversation.messages.push({
            role: 'assistant',
            content: null,
            tool_calls: [{ id: tc.id, function: { name: functionName, arguments: tc.function.arguments } }],
          });
          conversation.messages.push({
            role: 'tool',
            content: JSON.stringify(execResult.body),
            tool_call_id: tc.id,
          });
          llmMessages.push({
            role: 'assistant',
            content: `[ツール実行結果] ${JSON.stringify(execResult.body).slice(0, 4000)}`,
          });
        }

        // If we got a final content from a timeout break, stop looping
        if (finalContent !== null) break;

        round++;
      }

      // If we exhausted all rounds without a final text response, make one more call
      if (finalContent === null) {
        const lastCallResult = await callLlmWithTools(
          fastify,
          llmMessages,
          [], // no tools — force text response
          { model: CHAT_MODEL, temperature: 0.3, maxTokens: 2048 },
        );
        finalContent =
          lastCallResult.content ?? 'ツールの実行結果を確認してください。';
      }

      // ── Save conversation ───────────────────────────────────────────────
      conversation.messages.push({ role: 'assistant', content: finalContent });

      // Strip tool/tool_calls messages — only keep user/assistant text for history
      const cleanMessages = conversation.messages.filter(
        (m) =>
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string' &&
          m.content.length > 0,
      );

      // Prune history
      const prunedMessages =
        cleanMessages.length > MAX_CONVERSATION_MESSAGES
          ? cleanMessages.slice(cleanMessages.length - MAX_CONVERSATION_MESSAGES)
          : cleanMessages;

      await saveConversation(
        conversation.id,
        workspaceId,
        prunedMessages,
        conversation.isNew,
      );

      // ── Send final message event ──────────────────────────────────────
      writeEvent({
        type: 'message',
        content: finalContent,
        attachments: allAttachments.length > 0 ? allAttachments : undefined,
      });

      // ── Record usage + cost ───────────────────────────────────────────
      try {
        await recordUsage(workspaceId, 'agent', 'chat_v2', runId);
      } catch {
        // Non-fatal
      }
      try {
        await recordSpend(workspaceId, runId, costTracker.totalUsd);
      } catch {
        // Non-fatal
      }
    } catch (err) {
      if (err instanceof CostBudgetExceededError) {
        writeEvent({
          type: 'error',
          code: 'BUDGET_EXCEEDED',
          message: `API予算上限に達しました（${err.scope}: $${err.spentUsd.toFixed(4)} / $${err.capUsd.toFixed(4)}）`,
        });
        try {
          await recordSpend(workspaceId, runId, costTracker.totalUsd);
        } catch {
          // Non-fatal
        }
      } else {
        request.log.error(err, 'chat-v2 runtime error');
        writeEvent({
          type: 'error',
          code: 'INTERNAL',
          message:
            err instanceof Error
              ? err.message
              : '内部エラーが発生しました。',
        });
      }
    } finally {
      endStream();
    }

    return reply;
  });
}
