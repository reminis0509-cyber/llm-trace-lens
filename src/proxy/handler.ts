import type { FastifyRequest, FastifyReply } from 'fastify';
import type { LLMRequest, StructuredResponse } from '../types/index.js';
import { createEnforcer } from '../enforcer/factory.js';
import { ConfidenceValidator, type EnhancedValidationResult } from '../validation/confidence.js';
import { RiskScanner } from '../validation/risk.js';
import { RiskScorer, type RiskFactors } from '../validation/scoring.js';
import { TraceStore } from '../storage/trace-store.js';
import { OpenAIEnforcer } from '../enforcer/openai.js';
import { AnthropicEnforcer } from '../enforcer/anthropic.js';
import { GeminiEnforcer } from '../enforcer/gemini.js';
import { DeepSeekEnforcer } from '../enforcer/deepseek.js';
import { WebhookSender, webhookManager } from '../webhook/sender.js';
import { calculateCost } from '../cost/pricing.js';
import {
  incrementCost,
  getBudgetConfig,
  getCostStats,
  saveWorkspaceTrace,
  incrementWorkspaceCost,
  updateTraceEvaluation
} from '../kv/client.js';
import { evaluateTrace } from '../evaluation/index.js';
import { config } from '../config.js';
import type { EvaluationResult } from '../evaluation/types.js';

const confidenceValidator = new ConfidenceValidator();
const riskScanner = new RiskScanner();
const riskScorer = new RiskScorer();
const traceStore = new TraceStore();
const webhookSender = new WebhookSender();

interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface TraceWithCost {
  requestId: string;
  timestamp: string;
  provider: string;
  model: string;
  prompt: string;
  structuredResponse: StructuredResponse;
  validationResults: {
    confidence: { status: string; issues: string[] };
    risk: { status: string; issues: string[] };
    overall: string;
    // Enhanced validation results (blackboxed - no raw thresholds)
    riskScore?: number;
    riskLevel?: 'low' | 'medium' | 'high';
    explanation?: string;
  };
  latencyMs: number;
  internalTrace: null;
  usage?: UsageInfo;
  estimatedCost?: number;
  workspaceId?: string;
  evaluation?: EvaluationResult;
  // Original messages for evaluation
  messages?: Array<{ role: string; content: string }>;
}

/**
 * Sanitize trace for client response - removes internal threshold data
 * Implements threshold blackboxing by exposing only abstracted risk info
 */
function sanitizeTraceForResponse(trace: TraceWithCost): object {
  return {
    requestId: trace.requestId,
    timestamp: trace.timestamp,
    provider: trace.provider,
    model: trace.model,
    latencyMs: trace.latencyMs,
    usage: trace.usage,
    estimatedCost: trace.estimatedCost,
    validationResults: {
      // Only expose abstracted risk information
      riskScore: trace.validationResults.riskScore,
      riskLevel: trace.validationResults.riskLevel,
      explanation: trace.validationResults.explanation,
      passed: trace.validationResults.overall !== 'BLOCK',
      overall: trace.validationResults.overall,
      // Keep issue summaries but no raw confidence/threshold values
      issueCount: (trace.validationResults.confidence?.issues?.length || 0) +
                  (trace.validationResults.risk?.issues?.length || 0),
    },
  };
}

async function trackCostAndCheckBudget(
  trace: TraceWithCost,
  provider: string,
  model: string
): Promise<void> {
  if (!trace.usage) return;

  const cost = calculateCost(model, trace.usage.promptTokens, trace.usage.completionTokens);
  trace.estimatedCost = cost;

  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  await incrementCost(month, provider, model, cost);

  // Check budget alerts
  try {
    const budgetConfig = await getBudgetConfig();
    if (budgetConfig && budgetConfig.monthlyLimit > 0) {
      const costStats = await getCostStats(month);
      const percentage = (costStats.totalCost / budgetConfig.monthlyLimit) * 100;

      // Check if we crossed any threshold
      for (const threshold of budgetConfig.alertThresholds) {
        const thresholdPercentage = threshold * 100;
        // Only alert if we just crossed the threshold (within a small margin)
        if (percentage >= thresholdPercentage && percentage < thresholdPercentage + 1) {
          // Send cost alert via webhook manager
          if (webhookManager.hasSenders()) {
            webhookManager.sendAll({
              event: 'COST_ALERT',
              timestamp: new Date().toISOString(),
              traceId: trace.requestId,
              provider,
              model,
              costInfo: {
                current: costStats.totalCost,
                budget: budgetConfig.monthlyLimit,
                percentage,
              },
              details: { message: `Cost alert: ${percentage.toFixed(1)}% of budget used` },
            }).catch(err => console.error('[Handler] Cost alert webhook failed:', err));
          }
          break;
        }
      }
    }
  } catch (error) {
    console.error('[Handler] Failed to check budget:', error);
  }
}

/**
 * Helper function to iterate through generator and capture return value
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

export async function handleCompletion(
  request: FastifyRequest<{ Body: LLMRequest }>,
  reply: FastifyReply
) {
  const startTime = Date.now();
  const llmRequest = request.body;

  // ワークスペースは認証ミドルウェアで設定済み（APIキーから自動特定）
  // X-Workspace-IDヘッダーは不要になりました
  const workspaceId = request.workspace?.workspaceId || 'default';

  try {
    // ストリーミングチェック
    const isStreaming = llmRequest.stream === true;

    const enforcer = await createEnforcer(
      llmRequest.provider || 'openai',
      llmRequest.model,
      workspaceId
    );

    // ストリーミング対応
    if (isStreaming) {
      // OpenAI, Anthropic, Gemini, DeepSeekをサポート
      const supportedProviders = ['openai', 'anthropic', 'gemini', 'deepseek'];
      if (!supportedProviders.includes(llmRequest.provider || 'openai')) {
        return reply.code(400).send({
          error: 'Streaming is only supported for OpenAI, Anthropic, Gemini, and DeepSeek providers'
        });
      }

      // SSEヘッダー設定
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      try {
        if (enforcer instanceof OpenAIEnforcer || enforcer instanceof AnthropicEnforcer || enforcer instanceof GeminiEnforcer || enforcer instanceof DeepSeekEnforcer) {
          // ストリーミング実行 - return valueを正しくキャプチャ
          const generator = enforcer.enforceStream(llmRequest);

          const structuredResponse = await consumeGeneratorWithReturn(
            generator,
            (chunk: string) => {
              // SSE形式でチャンクを送信
              const sseData = `data: ${JSON.stringify({
                choices: [{
                  delta: { content: chunk },
                  index: 0
                }]
              })}\n\n`;
              reply.raw.write(sseData);
            }
          );

          // 検証実行
          const confidenceResult = confidenceValidator.validate(structuredResponse);
          const riskResult = riskScanner.scan(structuredResponse);

          // Calculate risk score for threshold blackboxing
          const riskFactors: RiskFactors = {
            confidence: structuredResponse.confidence || 0,
            evidenceCount: structuredResponse.evidence?.length || 0,
            hasPII: riskResult.status === 'BLOCK' || riskResult.status === 'WARN',
            hasHistoricalViolations: false,
          };
          const riskScore = await riskScorer.calculateRiskScore(workspaceId || 'default', riskFactors);

          const overallStatus =
            riskResult.status === 'BLOCK' ? 'BLOCK' :
            (confidenceResult.status === 'WARN' || riskResult.status === 'WARN') ? 'WARN' :
            'PASS';

          // トレース作成
          const trace: TraceWithCost = {
            requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            provider: llmRequest.provider || 'openai',
            model: llmRequest.model || 'unknown',
            prompt: llmRequest.prompt || JSON.stringify(llmRequest.messages),
            structuredResponse,
            validationResults: {
              confidence: confidenceResult,
              risk: riskResult,
              overall: overallStatus,
              // Enhanced validation results (threshold blackboxing)
              riskScore: riskScore.score,
              riskLevel: riskScore.level,
              explanation: riskScore.explanation,
            },
            latencyMs: Date.now() - startTime,
            internalTrace: null,
            workspaceId,
            messages: llmRequest.messages,
          };

          // Track cost (async, non-blocking)
          trackCostAndCheckBudget(trace, trace.provider, trace.model).catch(err =>
            console.error('[Handler] Cost tracking failed:', err)
          );

          // Workspace cost tracking
          if (workspaceId) {
            const month = new Date().toISOString().slice(0, 7);
            incrementWorkspaceCost(workspaceId, month, trace.provider, trace.model, trace.estimatedCost || 0).catch(err =>
              console.error('[Handler] Workspace cost tracking failed:', err)
            );
          }

          // DB保存 (workspace-scoped if available)
          traceStore.save(trace);
          if (workspaceId) {
            saveWorkspaceTrace(workspaceId, trace as unknown as Record<string, unknown>).catch(err =>
              console.error('[Handler] Workspace trace save failed:', err)
            );
          }

          // LLM-as-Judge 評価（fire-and-forget）
          if (config.enableEvaluation) {
            const traceRef = trace;
            setImmediate(async () => {
              try {
                const userMessages = traceRef.messages?.filter((m: { role: string; content: string }) => m.role === 'user') ?? [];
                const question = userMessages[userMessages.length - 1]?.content ?? traceRef.prompt;
                const answer = traceRef.structuredResponse?.answer ?? '';

                if (question && answer) {
                  const evalResult = await evaluateTrace({ question, answer });
                  traceRef.evaluation = evalResult;
                  if (traceRef.workspaceId) {
                    await updateTraceEvaluation(traceRef.workspaceId, traceRef.requestId, evalResult);
                  }
                }
              } catch (err) {
                console.error('[Evaluation] Failed to evaluate trace:', err);
              }
            });
          }

          // Webhook通知（BLOCK/WARNイベント）
          if (overallStatus === 'BLOCK') {
            webhookSender.sendBlockEvent(
              trace.requestId,
              trace.model,
              { confidence: confidenceResult, risk: riskResult },
              trace.prompt.substring(0, 100)
            ).catch(err => console.error('Webhook send failed:', err));

            // Also send via webhook manager
            webhookManager.sendAll({
              event: 'BLOCK',
              timestamp: trace.timestamp,
              traceId: trace.requestId,
              provider: trace.provider,
              model: trace.model,
              risk: riskResult.issues.join(', ') || 'Blocked by validation',
              details: { confidence: confidenceResult, risk: riskResult },
            }).catch(err => console.error('[Handler] Webhook manager BLOCK failed:', err));
          } else if (overallStatus === 'WARN') {
            // Send WARN events via webhook manager
            webhookManager.sendAll({
              event: 'WARN',
              timestamp: trace.timestamp,
              traceId: trace.requestId,
              provider: trace.provider,
              model: trace.model,
              risk: [...confidenceResult.issues, ...riskResult.issues].join(', ') || 'Warning from validation',
              details: { confidence: confidenceResult, risk: riskResult },
            }).catch(err => console.error('[Handler] Webhook manager WARN failed:', err));
          }

          // 最終チャンクに_traceを含める (sanitized for threshold blackboxing)
          const finalData = `data: ${JSON.stringify({
            choices: [{
              delta: {},
              index: 0,
              finish_reason: 'stop'
            }],
            _trace: sanitizeTraceForResponse(trace)
          })}\n\n`;
          reply.raw.write(finalData);

          // ストリーム終了
          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();
        }
      } catch (streamError) {
        const errorData = `data: ${JSON.stringify({
          error: streamError instanceof Error ? streamError.message : 'Streaming error'
        })}\n\n`;
        reply.raw.write(errorData);
        reply.raw.end();
      }

      return;
    }

    // 非ストリーミング（既存フロー）
    const structuredResponse = await enforcer.enforce(llmRequest);

    const confidenceResult = confidenceValidator.validate(structuredResponse);
    const riskResult = riskScanner.scan(structuredResponse);

    // Calculate risk score for threshold blackboxing
    const riskFactors: RiskFactors = {
      confidence: structuredResponse.confidence || 0,
      evidenceCount: structuredResponse.evidence?.length || 0,
      hasPII: riskResult.status === 'BLOCK' || riskResult.status === 'WARN',
      hasHistoricalViolations: false, // TODO: Check workspace history
    };
    const riskScore = await riskScorer.calculateRiskScore(workspaceId || 'default', riskFactors);

    const overallStatus =
      riskResult.status === 'BLOCK' ? 'BLOCK' :
      (confidenceResult.status === 'WARN' || riskResult.status === 'WARN') ? 'WARN' :
      'PASS';

    const trace: TraceWithCost = {
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      provider: llmRequest.provider || 'openai',
      model: llmRequest.model || 'unknown',
      prompt: llmRequest.prompt || JSON.stringify(llmRequest.messages),
      structuredResponse,
      validationResults: {
        confidence: confidenceResult,
        risk: riskResult,
        overall: overallStatus,
        // Enhanced validation results (threshold blackboxing)
        riskScore: riskScore.score,
        riskLevel: riskScore.level,
        explanation: riskScore.explanation,
      },
      latencyMs: Date.now() - startTime,
      internalTrace: null,
      workspaceId,
      messages: llmRequest.messages,
    };

    // Track cost (async, non-blocking)
    trackCostAndCheckBudget(trace, trace.provider, trace.model).catch(err =>
      console.error('[Handler] Cost tracking failed:', err)
    );

    // Workspace cost tracking
    if (workspaceId) {
      const month = new Date().toISOString().slice(0, 7);
      incrementWorkspaceCost(workspaceId, month, trace.provider, trace.model, trace.estimatedCost || 0).catch(err =>
        console.error('[Handler] Workspace cost tracking failed:', err)
      );
    }

    // DB保存 (workspace-scoped if available)
    traceStore.save(trace);
    if (workspaceId) {
      saveWorkspaceTrace(workspaceId, trace as unknown as Record<string, unknown>).catch(err =>
        console.error('[Handler] Workspace trace save failed:', err)
      );
    }

    // LLM-as-Judge 評価（fire-and-forget）
    if (config.enableEvaluation) {
      const traceRef = trace;
      setImmediate(async () => {
        try {
          const userMessages = traceRef.messages?.filter((m: { role: string; content: string }) => m.role === 'user') ?? [];
          const question = userMessages[userMessages.length - 1]?.content ?? traceRef.prompt;
          const answer = traceRef.structuredResponse?.answer ?? '';

          if (question && answer) {
            const evalResult = await evaluateTrace({ question, answer });
            traceRef.evaluation = evalResult;
            if (traceRef.workspaceId) {
              await updateTraceEvaluation(traceRef.workspaceId, traceRef.requestId, evalResult);
            }
          }
        } catch (err) {
          console.error('[Evaluation] Failed to evaluate trace:', err);
        }
      });
    }

    // Webhook通知（BLOCK/WARNイベント）
    if (overallStatus === 'BLOCK') {
      webhookSender.sendBlockEvent(
        trace.requestId,
        trace.model,
        { confidence: confidenceResult, risk: riskResult },
        trace.prompt.substring(0, 100)
      ).catch(err => console.error('Webhook send failed:', err));

      // Also send via webhook manager
      webhookManager.sendAll({
        event: 'BLOCK',
        timestamp: trace.timestamp,
        traceId: trace.requestId,
        provider: trace.provider,
        model: trace.model,
        risk: riskResult.issues.join(', ') || 'Blocked by validation',
        details: { confidence: confidenceResult, risk: riskResult },
      }).catch(err => console.error('[Handler] Webhook manager BLOCK failed:', err));
    } else if (overallStatus === 'WARN') {
      // Send WARN events via webhook manager
      webhookManager.sendAll({
        event: 'WARN',
        timestamp: trace.timestamp,
        traceId: trace.requestId,
        provider: trace.provider,
        model: trace.model,
        risk: [...confidenceResult.issues, ...riskResult.issues].join(', ') || 'Warning from validation',
        details: { confidence: confidenceResult, risk: riskResult },
      }).catch(err => console.error('[Handler] Webhook manager WARN failed:', err));
    }

    // Return sanitized trace (threshold blackboxing)
    return reply.send({
      ...structuredResponse,
      _trace: sanitizeTraceForResponse(trace)
    });

  } catch (error) {
    console.error('Error in completion handler:', error);
    return reply.code(500).send({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
