/**
 * FujiTrace AI 事務員 — Core agent logic.
 *
 * Receives a user message, dispatches to registered tools via LLM
 * function calling, and returns a natural language response.
 *
 * Architecture:
 *   User message → System prompt + tool definitions → LLM (gpt-4o)
 *   → tool_call or text response → tool execution via fastify.inject()
 *   → tool result fed back to LLM → final natural language reply
 */
import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { getKnex } from '../storage/knex-client.js';
import { allToolSchemas } from '../tools/index.js';
import { buildSystemPrompt } from './system-prompt.js';
import { buildFunctionCallingTools, resolveToolName } from './tool-matcher.js';
import { logFeatureRequest } from './desire-db.js';
import { ensureAgentTables } from './desire-db.js';
import {
  callLlmWithTools,
  recordUsage,
  INTERNAL_SECRET,
} from '../routes/tools/_shared.js';
import type { LlmMessage } from '../routes/tools/_shared.js';

/** Maximum tool calls per single conversation turn to prevent infinite loops. */
const MAX_TOOL_CALLS_PER_TURN = 2;

/**
 * Maximum number of messages retained in a conversation history.
 * Older messages beyond this limit are pruned (keeping the most recent)
 * to prevent context window overflow, database bloat, and latency growth.
 * 50 messages ~ 25 turns (user + assistant), well within gpt-4o context.
 */
const MAX_CONVERSATION_MESSAGES = 50;

export interface ClerkInput {
  conversationId?: string;
  message: string;
  workspaceId: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface ClerkToolCall {
  tool_name: string;
  match_type: 'exact' | 'adapted';
  adapted_from?: string;
  result: unknown;
}

export interface ClerkOutput {
  conversation_id: string;
  reply: string;
  tool_call?: ClerkToolCall;
  feature_request_logged?: boolean;
  trace_id: string | null;
}

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

/**
 * Load an existing conversation or create a new one.
 * Validates that the conversation belongs to the requesting workspace.
 */
async function loadOrCreateConversation(
  conversationId: string | undefined,
  workspaceId: string,
): Promise<{ id: string; messages: ConversationMessage[]; isNew: boolean }> {
  await ensureAgentTables();
  const db = getKnex();

  if (conversationId) {
    const row = await db('agent_conversations')
      .where({ id: conversationId })
      .first() as ConversationRow | undefined;

    if (!row) {
      // Conversation not found — create a new one (don't error, just start fresh)
      const newId = crypto.randomUUID();
      return { id: newId, messages: [], isNew: true };
    }

    // Security: conversation must belong to the requesting workspace
    if (row.workspace_id !== workspaceId) {
      throw new ConversationAccessError(
        'この会話へのアクセス権がありません。',
      );
    }

    const messages = JSON.parse(row.messages) as ConversationMessage[];
    return { id: row.id, messages, isNew: false };
  }

  const newId = crypto.randomUUID();
  return { id: newId, messages: [], isNew: true };
}

/**
 * Save conversation messages to the database.
 */
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
    await db('agent_conversations')
      .where({ id })
      .update({
        messages: serialized,
        updated_at: now,
      });
  }
}

/**
 * Custom error class for conversation access violations.
 */
export class ConversationAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversationAccessError';
  }
}

/**
 * Execute a tool via fastify.inject() to the tool's HTTP endpoint.
 */
async function executeToolViaInject(
  fastify: FastifyInstance,
  toolPath: string,
  toolMethod: string,
  params: unknown,
  workspaceId: string,
): Promise<{ statusCode: number; body: unknown }> {
  const injectResponse = await fastify.inject({
    method: toolMethod as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: toolPath,
    headers: {
      'content-type': 'application/json',
      'x-workspace-id': workspaceId,
      'x-internal-secret': INTERNAL_SECRET,
    },
    payload: params as Record<string, unknown>,
  });

  let body: unknown;
  try {
    body = JSON.parse(injectResponse.body);
  } catch {
    body = injectResponse.body;
  }

  return { statusCode: injectResponse.statusCode, body };
}

/**
 * Execute the AI 事務員 agent for a single conversation turn.
 */
export async function executeClerk(
  fastify: FastifyInstance,
  input: ClerkInput,
): Promise<ClerkOutput> {
  const { conversationId, message, workspaceId, imageBase64, imageMimeType } = input;

  // 1. Load or create conversation
  const conversation = await loadOrCreateConversation(conversationId, workspaceId);

  // 2. Build system prompt and function calling tools
  const systemPrompt = buildSystemPrompt(allToolSchemas);
  const functionCallingTools = buildFunctionCallingTools(allToolSchemas);

  // 3. Build messages array for LLM
  const llmMessages: LlmMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history (skip system messages from history, we use fresh system prompt)
  for (const msg of conversation.messages) {
    if (msg.role !== 'system' && msg.content !== null) {
      llmMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  }

  // Add the new user message (multimodal if image is attached)
  if (imageBase64 && imageMimeType) {
    llmMessages.push({
      role: 'user',
      content: [
        ...(message ? [{ type: 'text' as const, text: message }] : []),
        { type: 'image_url' as const, image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } },
      ],
    });
  } else {
    llmMessages.push({ role: 'user', content: message });
  }

  // Record user message in conversation (text only, don't store base64)
  conversation.messages.push({ role: 'user', content: message || '[画像ファイル添付]' });

  // 4. Call LLM with tools
  const llmResult = await callLlmWithTools(
    fastify,
    llmMessages,
    functionCallingTools,
    { model: 'gpt-4o', temperature: 0.2, maxTokens: 4096, workspaceId, traceType: 'agent' },
  );

  let reply = '';
  let toolCallResult: ClerkToolCall | undefined;
  let featureRequestLogged = false;
  const traceId = llmResult.traceId;

  if (llmResult.toolCalls.length > 0) {
    // Process tool calls (limit to MAX_TOOL_CALLS_PER_TURN)
    const toolCallsToProcess = llmResult.toolCalls.slice(0, MAX_TOOL_CALLS_PER_TURN);

    for (const tc of toolCallsToProcess) {
      const functionName = tc.function.name;
      let parsedArgs: Record<string, unknown>;
      try {
        parsedArgs = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        parsedArgs = {};
      }

      if (functionName === 'office_task_execute') {
        // Generic office task dispatcher
        const execResult = await executeToolViaInject(
          fastify,
          '/api/tools/office-task/execute',
          'POST',
          parsedArgs,
          workspaceId,
        );

        toolCallResult = {
          tool_name: typeof parsedArgs['task_id'] === 'string' ? parsedArgs['task_id'] : 'office_task',
          match_type: 'exact',
          result: execResult.body,
        };

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

      } else if (functionName === '_log_feature_request') {
        // Log feature request to 欲望データベース
        const summary = typeof parsedArgs['user_request_summary'] === 'string'
          ? parsedArgs['user_request_summary']
          : message;
        await logFeatureRequest(workspaceId, summary, null, 'none');
        featureRequestLogged = true;

        // Add tool call and result to conversation for context
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

      } else if (functionName === '_adapt_tool') {
        // Adapted tool call
        const baseTool = typeof parsedArgs['base_tool'] === 'string'
          ? parsedArgs['base_tool']
          : '';
        const adaptationReason = typeof parsedArgs['adaptation_reason'] === 'string'
          ? parsedArgs['adaptation_reason']
          : '';
        const adaptedParams = parsedArgs['adapted_params'] ?? {};

        const resolvedTool = resolveToolName(baseTool, allToolSchemas);
        if (resolvedTool) {
          const execResult = await executeToolViaInject(
            fastify,
            resolvedTool.path,
            resolvedTool.method,
            adaptedParams,
            workspaceId,
          );

          toolCallResult = {
            tool_name: resolvedTool.name,
            match_type: 'adapted',
            adapted_from: baseTool,
            result: execResult.body,
          };

          // Log adapted match
          await logFeatureRequest(workspaceId, message, resolvedTool.name, 'adapted');

          conversation.messages.push({
            role: 'assistant',
            content: null,
            tool_calls: [{ id: tc.id, function: { name: functionName, arguments: tc.function.arguments } }],
          });
          conversation.messages.push({
            role: 'tool',
            content: JSON.stringify({
              tool: resolvedTool.name,
              adaptation: adaptationReason,
              result: execResult.body,
            }),
            tool_call_id: tc.id,
          });
        } else {
          // Base tool not found — log as feature request
          await logFeatureRequest(workspaceId, message, baseTool, 'none');
          featureRequestLogged = true;

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
        }

      } else {
        // Direct tool call
        const resolvedTool = resolveToolName(functionName, allToolSchemas);
        if (resolvedTool) {
          const execResult = await executeToolViaInject(
            fastify,
            resolvedTool.path,
            resolvedTool.method,
            parsedArgs,
            workspaceId,
          );

          toolCallResult = {
            tool_name: resolvedTool.name,
            match_type: 'exact',
            result: execResult.body,
          };

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
        }
      }
    }

    // 5. Send tool results back to LLM for natural language response
    const followUpMessages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Include full conversation with tool results
    for (const msg of conversation.messages) {
      if (msg.role !== 'system' && msg.content !== null) {
        followUpMessages.push({
          role: msg.role === 'tool' ? 'user' : (msg.role as 'user' | 'assistant'),
          content: msg.role === 'tool'
            ? `[ツール実行結果] ${msg.content}`
            : msg.content,
        });
      }
    }

    // Get final reply from LLM (no tools this time, just text response)
    const followUpResult = await callLlmWithTools(
      fastify,
      followUpMessages,
      [], // no tools for follow-up
      { model: 'gpt-4o', temperature: 0.3, maxTokens: 2048, workspaceId, traceType: 'agent' },
    );

    reply = followUpResult.content ?? 'ツールの実行結果を確認してください。';

  } else {
    // Text-only response (no tool call)
    reply = llmResult.content ?? '申し訳ございませんが、回答を生成できませんでした。';
  }

  // 6. Add assistant reply to conversation
  conversation.messages.push({ role: 'assistant', content: reply });

  // 7. Prune conversation history to prevent unbounded growth
  if (conversation.messages.length > MAX_CONVERSATION_MESSAGES) {
    conversation.messages = conversation.messages.slice(
      conversation.messages.length - MAX_CONVERSATION_MESSAGES,
    );
  }

  // 8. Save conversation
  await saveConversation(
    conversation.id,
    workspaceId,
    conversation.messages,
    conversation.isNew,
  );

  // 9. Record usage
  await recordUsage(workspaceId, 'agent', 'chat', traceId);

  return {
    conversation_id: conversation.id,
    reply,
    tool_call: toolCallResult,
    feature_request_logged: featureRequestLogged || undefined,
    trace_id: traceId,
  };
}
