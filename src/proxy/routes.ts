import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { handleCompletion } from './handler.js';
import { TraceRepository } from '../storage/repository.js';
import type { LLMProvider, LLMRequest } from '../types/index.js';

const traceRepo = new TraceRepository();

/**
 * モデル名からプロバイダーを自動検出
 */
function detectProviderFromModel(model: string): LLMProvider {
  const modelLower = model.toLowerCase();

  // OpenAI models
  if (modelLower.startsWith('gpt-') ||
      modelLower.startsWith('o1') ||
      modelLower.includes('davinci') ||
      modelLower.includes('curie') ||
      modelLower.includes('babbage') ||
      modelLower.includes('ada')) {
    return 'openai';
  }

  // Anthropic models
  if (modelLower.startsWith('claude')) {
    return 'anthropic';
  }

  // Google Gemini models
  if (modelLower.startsWith('gemini') || modelLower.startsWith('models/gemini')) {
    return 'gemini';
  }

  // DeepSeek models
  if (modelLower.startsWith('deepseek')) {
    return 'deepseek';
  }

  // Default to OpenAI
  return 'openai';
}

/**
 * Authorization ヘッダーからAPIキーを抽出
 */
function extractApiKeyFromHeader(request: FastifyRequest): string | undefined {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7); // "Bearer " の後の部分を取得
  }
  return undefined;
}

/**
 * プロキシ用のプリハンドラー
 * - Authorization ヘッダーからAPIキーを抽出
 * - モデル名からプロバイダーを自動検出
 */
async function proxyPreHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as Record<string, unknown>;

  // 1. Authorization ヘッダーからAPIキーを取得（優先）
  const headerApiKey = extractApiKeyFromHeader(request);
  if (headerApiKey && !body.api_key) {
    body.api_key = headerApiKey;
  }

  // 2. プロバイダーが未指定の場合、モデル名から自動検出
  if (!body.provider && body.model) {
    body.provider = detectProviderFromModel(body.model as string);
  }
}

export async function registerRoutes(server: FastifyInstance) {
  // Health check
  server.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  }));

  // OpenAI互換エンドポイント（完全互換版）
  server.post<{ Body: LLMRequest }>(
    '/v1/chat/completions',
    {
      preHandler: proxyPreHandler,
      schema: {
        body: {
          type: 'object',
          properties: {
            provider: { type: 'string', enum: ['openai', 'anthropic', 'gemini', 'deepseek'] },
            model: { type: 'string' },
            prompt: { type: 'string' },
            messages: {
              type: 'array',
              items: {
                type: 'object',
                required: ['role', 'content'],
                properties: {
                  role: { type: 'string' },
                  content: { type: 'string' },
                },
              },
            },
            systemPrompt: { type: 'string' },
            temperature: { type: 'number', minimum: 0, maximum: 2 },
            maxTokens: { type: 'integer', minimum: 1 },
            stream: { type: 'boolean' },
            api_key: { type: 'string' },
          },
        },
      },
    },
    handleCompletion
  );

  // トレース一覧取得
  server.get('/v1/traces', async (request) => {
    const query = request.query as {
      limit?: string;
      offset?: string;
      level?: string;
      provider?: string;
      model?: string;
    };

    const result = traceRepo.findAll({
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
      validationLevel: query.level,
      provider: query.provider as LLMProvider | undefined,
      model: query.model,
    });

    return result;
  });

  // 単一トレース取得
  server.get<{ Params: { id: string } }>('/v1/traces/:id', async (request, reply) => {
    const trace = traceRepo.findById(request.params.id);

    if (!trace) {
      return reply.code(404).send({
        error: 'Trace not found',
      });
    }

    return trace;
  });

  // 統計情報取得
  server.get('/v1/stats', async () => {
    const stats = traceRepo.getStats();
    return { stats };
  });
}
