import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { handleCompletion } from './handler.js';
import { TraceRepository, type ProviderStats } from '../storage/repository.js';
import type { LLMProvider, LLMRequest, Trace, ValidationResult, RuleResult, ValidationLevel, TraceType, AgentTrace } from '../types/index.js';
import { getWorkspaceTraces, getTraceById as getKVTraceById } from '../kv/client.js';

const traceRepo = new TraceRepository();

// Check if KV is available
// Supports both KV_REST_API_URL (legacy) and KV_URL (Upstash integration)
function isKVAvailable(): boolean {
  const hasUrl = !!(process.env.KV_REST_API_URL || process.env.KV_URL);
  const hasToken = !!process.env.KV_REST_API_TOKEN;
  return hasUrl && hasToken;
}

// Convert KV trace record to Trace type
function kvTraceToTrace(kvTrace: Record<string, unknown>): Trace {
  const structuredResponse = kvTrace.structuredResponse as {
    answer?: string;
    confidence?: number;
    evidence?: string[];
    alternatives?: string[];
  } | undefined;

  const validationResults = kvTrace.validationResults as {
    confidence?: { status?: string; issues?: string[] };
    risk?: { status?: string; issues?: string[] };
    overall?: string;
  } | undefined;

  const rules: RuleResult[] = [];
  if (validationResults?.confidence) {
    rules.push({
      ruleName: 'confidence',
      level: (validationResults.confidence.status || 'PASS') as ValidationLevel,
      message: validationResults.confidence.issues?.join(', ') || 'Confidence check passed',
    });
  }
  if (validationResults?.risk) {
    rules.push({
      ruleName: 'risk',
      level: (validationResults.risk.status || 'PASS') as ValidationLevel,
      message: validationResults.risk.issues?.join(', ') || 'Risk scan passed',
    });
  }

  const usage = kvTrace.usage as {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } | undefined;

  return {
    id: (kvTrace.requestId as string) || '',
    timestamp: new Date(kvTrace.timestamp as string || Date.now()),
    provider: (kvTrace.provider as LLMProvider) || 'openai',
    model: (kvTrace.model as string) || 'unknown',
    prompt: (kvTrace.prompt as string) || '',
    rawResponse: structuredResponse?.answer || '',
    structured: {
      thinking: '',
      confidence: structuredResponse?.confidence || 0,
      evidence: structuredResponse?.evidence || [],
      risks: structuredResponse?.alternatives || [],
      answer: structuredResponse?.answer || '',
    },
    validation: {
      overall: (validationResults?.overall || 'PASS') as ValidationResult['overall'],
      score: structuredResponse?.confidence || 0,
      rules,
    },
    latencyMs: (kvTrace.latencyMs as number) || 0,
    tokensUsed: usage?.totalTokens || 0,
    internalTrace: null,
    // Agent trace support
    traceType: (kvTrace.traceType as TraceType) || 'standard',
    agentTrace: kvTrace.agentTrace as AgentTrace | undefined,
  };
}

// Calculate stats from KV traces
function calculateStatsFromTraces(traces: Trace[]): ProviderStats[] {
  const statsMap = new Map<string, {
    provider: LLMProvider;
    model: string;
    count: number;
    totalScore: number;
    totalLatency: number;
    totalTokens: number;
  }>();

  for (const trace of traces) {
    const key = `${trace.provider}:${trace.model}`;
    const existing = statsMap.get(key);

    if (existing) {
      existing.count++;
      existing.totalScore += trace.validation.score;
      existing.totalLatency += trace.latencyMs;
      existing.totalTokens += trace.tokensUsed || 0;
    } else {
      statsMap.set(key, {
        provider: trace.provider,
        model: trace.model,
        count: 1,
        totalScore: trace.validation.score,
        totalLatency: trace.latencyMs,
        totalTokens: trace.tokensUsed || 0,
      });
    }
  }

  return Array.from(statsMap.values()).map(stat => ({
    provider: stat.provider,
    model: stat.model,
    count: stat.count,
    avgScore: Math.round((stat.totalScore / stat.count) * 10) / 10,
    avgLatency: Math.round(stat.totalLatency / stat.count),
    totalTokens: stat.totalTokens,
  }));
}

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
            provider: { type: 'string', enum: ['openai', 'anthropic', 'gemini'] },
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
            traceType: { type: 'string', enum: ['standard', 'agent'] },
            agentTrace: {
              type: 'object',
              properties: {
                agentId: { type: 'string' },
                agentName: { type: 'string' },
                goal: { type: 'string' },
                steps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      stepIndex: { type: 'integer' },
                      thought: { type: 'string' },
                      action: { type: 'string' },
                      toolCalls: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            arguments: { type: 'object' },
                            result: {},
                            error: { type: 'string' },
                            startedAt: { type: 'string' },
                            completedAt: { type: 'string' },
                            durationMs: { type: 'integer' },
                          },
                        },
                      },
                      observation: { type: 'string' },
                      timestamp: { type: 'string' },
                      durationMs: { type: 'integer' },
                    },
                  },
                },
                finalAnswer: { type: 'string' },
                totalDurationMs: { type: 'integer' },
                stepCount: { type: 'integer' },
                toolCallCount: { type: 'integer' },
                status: { type: 'string', enum: ['completed', 'failed', 'in_progress'] },
                error: { type: 'string' },
              },
            },
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

    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    // Try KV first if available (for Vercel/production)
    if (isKVAvailable()) {
      try {
        // Get workspace ID from request if available
        const workspaceId = (request as unknown as { workspace?: { workspaceId?: string } }).workspace?.workspaceId || 'default';
        const kvTraces = await getWorkspaceTraces(workspaceId, limit, offset);

        if (kvTraces.length > 0) {
          const traces = kvTraces.map(kvTraceToTrace);

          // Apply filters
          let filteredTraces = traces;
          if (query.level) {
            filteredTraces = filteredTraces.filter(t => t.validation.overall === query.level);
          }
          if (query.provider) {
            filteredTraces = filteredTraces.filter(t => t.provider === query.provider);
          }
          if (query.model) {
            filteredTraces = filteredTraces.filter(t => t.model === query.model);
          }

          return {
            traces: filteredTraces,
            total: filteredTraces.length,
            limit,
            offset,
          };
        }
      } catch (error) {
        console.error('Failed to get traces from KV, falling back to SQLite:', error);
      }
    }

    // Fallback to SQLite
    const result = traceRepo.findAll({
      limit,
      offset,
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
  server.get('/v1/stats', async (request) => {
    // Try KV first if available (for Vercel/production)
    if (isKVAvailable()) {
      try {
        // Get workspace ID from request if available
        const workspaceId = (request as unknown as { workspace?: { workspaceId?: string } }).workspace?.workspaceId || 'default';
        const kvTraces = await getWorkspaceTraces(workspaceId, 1000, 0);

        if (kvTraces.length > 0) {
          const traces = kvTraces.map(kvTraceToTrace);
          const stats = calculateStatsFromTraces(traces);
          return { stats };
        }
      } catch (error) {
        console.error('Failed to get stats from KV, falling back to SQLite:', error);
      }
    }

    // Fallback to SQLite
    const stats = traceRepo.getStats();
    return { stats };
  });
}
