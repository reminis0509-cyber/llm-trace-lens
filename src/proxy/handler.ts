import type { FastifyRequest, FastifyReply } from 'fastify';
import type { LLMRequest } from '../types/index.js';
import { createEnforcer } from '../enforcer/factory.js';
import { OpenAIEnforcer } from '../enforcer/openai.js';
import { AnthropicEnforcer } from '../enforcer/anthropic.js';
import { GeminiEnforcer } from '../enforcer/gemini.js';
import {
  runValidation,
  createTrace,
  processTracePostActions,
  sanitizeTraceForResponse,
  type TraceWithCost,
} from './trace-processor.js';

/** ストリーミングレスポンスのバッファ上限 (bytes) */
const MAX_STREAM_BUFFER_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * AsyncGeneratorからreturn valueをキャプチャしつつyieldされた値を処理
 */
async function consumeGeneratorWithReturn<T, R>(
  generator: AsyncGenerator<T, R, unknown>,
  onYield: (value: T) => void
): Promise<R> {
  let result = await generator.next();
  while (!result.done) {
    onYield(result.value);
    result = await generator.next();
  }
  return result.value;
}

/**
 * ストリーミング対応プロバイダーかチェック
 */
const STREAMING_PROVIDERS = ['openai', 'anthropic', 'gemini'];

function isStreamableEnforcer(
  enforcer: unknown
): enforcer is OpenAIEnforcer | AnthropicEnforcer | GeminiEnforcer {
  return (
    enforcer instanceof OpenAIEnforcer ||
    enforcer instanceof AnthropicEnforcer ||
    enforcer instanceof GeminiEnforcer
  );
}

/**
 * ストリーミングレスポンスの処理
 */
async function handleStreamingCompletion(
  request: FastifyRequest<{ Body: LLMRequest }>,
  reply: FastifyReply,
  llmRequest: LLMRequest,
  workspaceId: string,
  startTime: number
): Promise<void> {
  const provider = llmRequest.provider || 'openai';

  if (!STREAMING_PROVIDERS.includes(provider)) {
    reply.code(400).send({
      error: 'ストリーミングは OpenAI, Anthropic, Gemini プロバイダーのみ対応しています'
    });
    return;
  }

  const enforcer = await createEnforcer(provider, llmRequest.model, workspaceId, llmRequest.api_key);

  // SSEヘッダー設定
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  try {
    if (!isStreamableEnforcer(enforcer)) {
      throw new Error('Enforcer does not support streaming');
    }

    let bufferSize = 0;
    const generator = enforcer.enforceStream(llmRequest);

    const structuredResponse = await consumeGeneratorWithReturn(
      generator,
      (chunk: string) => {
        bufferSize += Buffer.byteLength(chunk, 'utf-8');
        if (bufferSize > MAX_STREAM_BUFFER_SIZE) {
          throw new Error('ストリーミングレスポンスがサイズ上限を超えました');
        }

        const sseData = `data: ${JSON.stringify({
          choices: [{
            delta: { content: chunk },
            index: 0
          }]
        })}\n\n`;
        reply.raw.write(sseData);
      }
    );

    // バリデーション & トレース生成
    const validation = await runValidation(structuredResponse, workspaceId);
    const trace = createTrace({
      startTime,
      provider,
      model: llmRequest.model || 'unknown',
      prompt: llmRequest.prompt || JSON.stringify(llmRequest.messages),
      structuredResponse,
      ...validation,
      workspaceId,
      messages: llmRequest.messages,
      traceType: llmRequest.traceType,
      agentTrace: llmRequest.agentTrace,
    });

    // 後処理（保存・コスト・評価・Webhook）
    processTracePostActions(trace);

    // 最終チャンクにトレース情報を含める
    const finalData = `data: ${JSON.stringify({
      choices: [{
        delta: {},
        index: 0,
        finish_reason: 'stop'
      }],
      _trace: sanitizeTraceForResponse(trace)
    })}\n\n`;
    reply.raw.write(finalData);
    reply.raw.write('data: [DONE]\n\n');
    reply.raw.end();
  } catch (streamError) {
    const errorMessage = streamError instanceof Error ? streamError.message : 'ストリーミングエラー';
    console.error('[Handler] ストリーミングエラー:', errorMessage);
    const errorData = `data: ${JSON.stringify({ error: errorMessage })}\n\n`;
    reply.raw.write(errorData);
    reply.raw.end();
  }
}

/**
 * 非ストリーミングレスポンスの処理
 */
async function handleNonStreamingCompletion(
  request: FastifyRequest<{ Body: LLMRequest }>,
  reply: FastifyReply,
  llmRequest: LLMRequest,
  workspaceId: string,
  startTime: number
): Promise<void> {
  const provider = llmRequest.provider || 'openai';
  const enforcer = await createEnforcer(provider, llmRequest.model, workspaceId, llmRequest.api_key);

  const enforcerResult = await enforcer.enforce(llmRequest);
  const structuredResponse = enforcerResult.response;
  const usage = enforcerResult.usage;

  // バリデーション & トレース生成
  const validation = await runValidation(structuredResponse, workspaceId);
  const trace = createTrace({
    startTime,
    provider,
    model: llmRequest.model || 'unknown',
    prompt: llmRequest.prompt || JSON.stringify(llmRequest.messages),
    structuredResponse,
    ...validation,
    workspaceId,
    messages: llmRequest.messages,
    traceType: llmRequest.traceType,
    agentTrace: llmRequest.agentTrace,
    usage,
  });

  // 後処理（保存・コスト・評価・Webhook）
  processTracePostActions(trace);

  // OpenAI互換レスポンス
  reply.send({
    id: trace.requestId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: trace.model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: structuredResponse.answer,
        },
        finish_reason: 'stop',
      },
    ],
    usage: trace.usage ? {
      prompt_tokens: trace.usage.promptTokens,
      completion_tokens: trace.usage.completionTokens,
      total_tokens: trace.usage.totalTokens,
    } : undefined,
    _trace: sanitizeTraceForResponse(trace),
    _structured: structuredResponse,
  });
}

/**
 * メインのCompletion handler
 */
export async function handleCompletion(
  request: FastifyRequest<{ Body: LLMRequest }>,
  reply: FastifyReply
) {
  const startTime = Date.now();
  const llmRequest = request.body;
  const workspaceId = request.workspace?.workspaceId || 'default';

  try {
    if (llmRequest.stream === true) {
      await handleStreamingCompletion(request, reply, llmRequest, workspaceId, startTime);
    } else {
      await handleNonStreamingCompletion(request, reply, llmRequest, workspaceId, startTime);
    }
  } catch (error) {
    console.error('[Handler] Completionエラー:', error);
    return reply.code(500).send({
      error: error instanceof Error ? error.message : '不明なエラーが発生しました'
    });
  }
}
