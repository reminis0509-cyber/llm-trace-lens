import type { FastifyInstance } from 'fastify';
import { handleCompletion } from './handler.js';
import { TraceRepository } from '../storage/repository.js';
import type { LLMProvider } from '../types/index.js';

const traceRepo = new TraceRepository();

export async function registerRoutes(server: FastifyInstance) {
  // Health check
  server.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  }));

  // OpenAI互換エンドポイント（MVP版）
  server.post(
    '/v1/chat/completions',
    {
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
