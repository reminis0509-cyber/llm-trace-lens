/**
 * Trace Processor
 * トレースの後処理（保存・コスト追跡・評価・Webhook通知）を一元管理
 * handler.ts のストリーミング/非ストリーミングで重複していたロジックを統合
 */
import type { StructuredResponse, TraceType, AgentTrace } from '../types/index.js';
import type { EnhancedValidationResult } from '../validation/confidence.js';
import { ConfidenceValidator } from '../validation/confidence.js';
import { RiskScanner } from '../validation/risk.js';
import { RiskScorer, type RiskFactors } from '../validation/scoring.js';
import { TraceStore } from '../storage/trace-store.js';
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
import { evaluateTrace, evaluateTracePatterns, buildEvaluationOptions } from '../evaluation/index.js';
import { config, evaluationConfig } from '../config.js';
import type { EvaluationResult } from '../evaluation/types.js';
import type { TraceEvaluations } from '../types/index.js';
import { broadcastNewTrace } from '../lib/realtime.js';
import { getWorkspacePlan } from '../plans/storage.js';
import { getEffectiveLimits } from '../plans/index.js';
import { getUsageStats, incrementEvaluationCount } from '../plans/usage.js';

const confidenceValidator = new ConfidenceValidator();
const riskScanner = new RiskScanner();
const riskScorer = new RiskScorer();
const traceStore = new TraceStore();
const webhookSender = new WebhookSender();

export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface TraceWithCost {
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
  evaluations?: TraceEvaluations;
  messages?: Array<{ role: string; content: string }>;
  traceType?: TraceType;
  agentTrace?: AgentTrace;
}

/**
 * バリデーション実行
 */
export async function runValidation(
  structuredResponse: StructuredResponse,
  workspaceId: string
): Promise<{
  confidenceResult: { status: string; issues: string[] };
  riskResult: { status: string; issues: string[] };
  riskScore: { score: number; level: 'low' | 'medium' | 'high'; explanation: string };
  overallStatus: string;
}> {
  const confidenceResult = confidenceValidator.validate(structuredResponse);
  const riskResult = riskScanner.scan(structuredResponse);

  const riskFactors: RiskFactors = {
    confidence: structuredResponse.confidence || 0,
    evidenceCount: structuredResponse.evidence?.length || 0,
    hasPII: riskResult.status === 'BLOCK' || riskResult.status === 'WARN',
    hasHistoricalViolations: false,
  };
  const riskScore = await riskScorer.calculateRiskScore(workspaceId, riskFactors);

  const overallStatus =
    riskResult.status === 'BLOCK' ? 'BLOCK' :
    (confidenceResult.status === 'WARN' || riskResult.status === 'WARN') ? 'WARN' :
    'PASS';

  return { confidenceResult, riskResult, riskScore, overallStatus };
}

/**
 * トレースレコードを生成
 */
export function createTrace(params: {
  startTime: number;
  provider: string;
  model: string;
  prompt: string;
  structuredResponse: StructuredResponse;
  confidenceResult: { status: string; issues: string[] };
  riskResult: { status: string; issues: string[] };
  riskScore: { score: number; level: 'low' | 'medium' | 'high'; explanation: string };
  overallStatus: string;
  workspaceId: string;
  messages?: Array<{ role: string; content: string }>;
  traceType?: TraceType;
  agentTrace?: AgentTrace;
}): TraceWithCost {
  return {
    requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    provider: params.provider,
    model: params.model,
    prompt: params.prompt,
    structuredResponse: params.structuredResponse,
    validationResults: {
      confidence: params.confidenceResult,
      risk: params.riskResult,
      overall: params.overallStatus,
      riskScore: params.riskScore.score,
      riskLevel: params.riskScore.level,
      explanation: params.riskScore.explanation,
    },
    latencyMs: Date.now() - params.startTime,
    internalTrace: null,
    workspaceId: params.workspaceId,
    messages: params.messages,
    traceType: params.traceType || 'standard',
    agentTrace: params.agentTrace,
  };
}

/**
 * コスト追跡と予算チェック（非同期）
 */
export async function trackCostAndCheckBudget(
  trace: TraceWithCost,
  provider: string,
  model: string
): Promise<void> {
  if (!trace.usage) return;

  const cost = calculateCost(model, trace.usage.promptTokens, trace.usage.completionTokens);
  trace.estimatedCost = cost;

  const month = new Date().toISOString().slice(0, 7);
  await incrementCost(month, provider, model, cost);

  try {
    const budgetConfig = await getBudgetConfig();
    if (budgetConfig && budgetConfig.monthlyLimit > 0) {
      const costStats = await getCostStats(month);
      const percentage = (costStats.totalCost / budgetConfig.monthlyLimit) * 100;

      for (const threshold of budgetConfig.alertThresholds) {
        const thresholdPercentage = threshold * 100;
        if (percentage >= thresholdPercentage && percentage < thresholdPercentage + 1) {
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
              details: { message: `コストアラート: 予算の${percentage.toFixed(1)}%を使用` },
            }).catch(err => console.error('[TraceProcessor] コストアラートWebhook送信失敗:', err));
          }
          break;
        }
      }
    }
  } catch (error) {
    console.error('[TraceProcessor] 予算チェック失敗:', error);
  }
}

/**
 * トレースの保存・コスト追跡・評価・Webhook通知を一括実行
 */
export function processTracePostActions(trace: TraceWithCost): void {
  const workspaceId = trace.workspaceId;

  // コスト追跡（非同期）
  trackCostAndCheckBudget(trace, trace.provider, trace.model).catch(err =>
    console.error('[TraceProcessor] コスト追跡失敗:', err)
  );

  // ワークスペース別コスト追跡
  if (workspaceId) {
    const month = new Date().toISOString().slice(0, 7);
    incrementWorkspaceCost(workspaceId, month, trace.provider, trace.model, trace.estimatedCost || 0).catch(err =>
      console.error('[TraceProcessor] ワークスペースコスト追跡失敗:', err)
    );
  }

  // DB保存
  traceStore.save(trace);
  if (workspaceId) {
    saveWorkspaceTrace(workspaceId, trace as unknown as Record<string, unknown>).catch(err =>
      console.error('[TraceProcessor] ワークスペーストレース保存失敗:', err)
    );

    broadcastNewTrace(workspaceId, {
      id: trace.requestId,
      model: trace.model,
      timestamp: trace.timestamp || new Date().toISOString(),
      totalTokens: trace.usage?.totalTokens,
      status: trace.validationResults?.riskLevel || trace.validationResults?.overall,
      latencyMs: trace.latencyMs,
    });
  }

  // LLM-as-Judge 評価（fire-and-forget）
  if (config.enableEvaluation) {
    runLLMEvaluation(trace);
  }

  // パターンマッチベース評価（fire-and-forget）
  if (evaluationConfig.enabled) {
    runPatternEvaluation(trace);
  }

  // Webhook通知
  sendWebhookNotifications(trace);
}

/**
 * メッセージ配列からRAGコンテキストを抽出
 * RAGパイプラインでは通常、systemメッセージに取得した文書が埋め込まれる
 *
 * 検出パターン:
 * 1. system メッセージ内の「コンテキスト」「参考情報」「context」等のセクション
 * 2. system メッセージが一定長以上（取得文書が埋め込まれている可能性）
 * 3. 明示的な区切り（---、===、「以下の情報」等）の後のテキスト
 */
function extractRAGContext(messages?: Array<{ role: string; content: string }>): string | undefined {
  if (!messages || messages.length === 0) return undefined;

  const systemMessages = messages.filter(m => m.role === 'system');
  if (systemMessages.length === 0) return undefined;

  const systemContent = systemMessages.map(m => m.content).join('\n');

  // パターン1: 明示的なコンテキストセクションを検出
  const contextPatterns = [
    // 英語パターン
    /(?:context|reference|retrieved documents?|source documents?|knowledge base|relevant information)\s*[:：]\s*\n?([\s\S]{100,})/i,
    // 日本語パターン
    /(?:コンテキスト|参考情報|参照文書|取得文書|ナレッジベース|関連情報|以下の(?:情報|文書|資料|内容)(?:を(?:参考に|基に|元に|使って)))\s*[:：]?\s*\n?([\s\S]{100,})/,
    // 区切り文字パターン（---、===の後に長いテキスト）
    /(?:---+|===+)\s*\n([\s\S]{200,}?)(?:\n(?:---+|===+)|$)/,
    // XMLタグパターン（<context>...</context>）
    /<(?:context|documents?|sources?|reference)>([\s\S]{100,}?)<\/(?:context|documents?|sources?|reference)>/i,
  ];

  for (const pattern of contextPatterns) {
    const match = systemContent.match(pattern);
    if (match?.[1]) {
      // コンテキストを最大4000文字に切り詰め（LLM評価コストを制御）
      return match[1].trim().substring(0, 4000);
    }
  }

  // パターン2: systemメッセージが500文字以上かつ構造的（改行多め）→ RAGの可能性高
  if (systemContent.length > 500) {
    const lineCount = systemContent.split('\n').length;
    const avgLineLength = systemContent.length / lineCount;
    // 短い行が多い = 箇条書きや文書断片 = RAGコンテキストの可能性
    if (lineCount > 5 && avgLineLength < 200) {
      return systemContent.substring(0, 4000);
    }
  }

  return undefined;
}

function runLLMEvaluation(trace: TraceWithCost): void {
  setImmediate(async () => {
    try {
      const workspaceId = trace.workspaceId || 'default';

      // プランの評価上限チェック
      const plan = await getWorkspacePlan(workspaceId);
      const limits = getEffectiveLimits(plan);

      if (limits.monthlyEvaluations <= 0) {
        // Freeプラン: LLM-as-Judge は利用不可
        return;
      }

      if (limits.monthlyEvaluations !== Infinity) {
        const usage = await getUsageStats(workspaceId);
        if (usage.evaluationCount >= limits.monthlyEvaluations) {
          console.warn(`[TraceProcessor] LLM評価上限到達: ${workspaceId} (${usage.evaluationCount}/${limits.monthlyEvaluations})`);
          return;
        }
      }

      const userMessages = trace.messages?.filter((m) => m.role === 'user') ?? [];
      const question = userMessages[userMessages.length - 1]?.content ?? trace.prompt;
      const answer = trace.structuredResponse?.answer ?? '';

      // RAGコンテキストを自動抽出
      const context = extractRAGContext(trace.messages);

      if (question && answer) {
        const evalResult = await evaluateTrace({ question, answer, context });

        if (context) {
          console.info(`[TraceProcessor] RAG検出: コンテキスト${context.length}文字 → 4指標で評価`);
        }

        trace.evaluation = evalResult;
        if (trace.workspaceId) {
          await updateTraceEvaluation(trace.workspaceId, trace.requestId, evalResult);
        }
        // 評価回数をカウント
        await incrementEvaluationCount(workspaceId);
      }
    } catch (err) {
      console.error('[TraceProcessor] LLM評価失敗:', err);
    }
  });
}

function runPatternEvaluation(trace: TraceWithCost): void {
  setImmediate(async () => {
    try {
      const userMessages = trace.messages?.filter((m) => m.role === 'user') ?? [];
      const userInput = userMessages[userMessages.length - 1]?.content ?? trace.prompt;
      const llmOutput = trace.structuredResponse?.answer ?? '';

      if (userInput || llmOutput) {
        const options = buildEvaluationOptions();
        const evaluations = await evaluateTracePatterns(userInput, llmOutput, options);
        trace.evaluations = evaluations;
      }
    } catch (err) {
      console.warn(`[TraceProcessor] パターン評価失敗 traceId=${trace.requestId}:`, err);
    }
  });
}

function sendWebhookNotifications(trace: TraceWithCost): void {
  const overallStatus = trace.validationResults.overall;
  const confidenceResult = trace.validationResults.confidence;
  const riskResult = trace.validationResults.risk;

  if (overallStatus === 'BLOCK') {
    webhookSender.sendBlockEvent(
      trace.requestId,
      trace.model,
      { confidence: confidenceResult, risk: riskResult },
      trace.prompt.substring(0, 100)
    ).catch(err => console.error('[TraceProcessor] Webhook送信失敗:', err));

    webhookManager.sendAll({
      event: 'BLOCK',
      timestamp: trace.timestamp,
      traceId: trace.requestId,
      provider: trace.provider,
      model: trace.model,
      risk: riskResult.issues.join(', ') || 'バリデーションによりブロック',
      details: { confidence: confidenceResult, risk: riskResult },
    }).catch(err => console.error('[TraceProcessor] Webhook BLOCK送信失敗:', err));
  } else if (overallStatus === 'WARN') {
    webhookManager.sendAll({
      event: 'WARN',
      timestamp: trace.timestamp,
      traceId: trace.requestId,
      provider: trace.provider,
      model: trace.model,
      risk: [...confidenceResult.issues, ...riskResult.issues].join(', ') || 'バリデーション警告',
      details: { confidence: confidenceResult, risk: riskResult },
    }).catch(err => console.error('[TraceProcessor] Webhook WARN送信失敗:', err));
  }
}

/**
 * クライアントレスポンス用にトレースをサニタイズ（内部閾値データを除外）
 */
export function sanitizeTraceForResponse(trace: TraceWithCost): object {
  return {
    requestId: trace.requestId,
    timestamp: trace.timestamp,
    provider: trace.provider,
    model: trace.model,
    latencyMs: trace.latencyMs,
    usage: trace.usage,
    estimatedCost: trace.estimatedCost,
    validationResults: {
      riskScore: trace.validationResults.riskScore,
      riskLevel: trace.validationResults.riskLevel,
      explanation: trace.validationResults.explanation,
      passed: trace.validationResults.overall !== 'BLOCK',
      overall: trace.validationResults.overall,
      issueCount: (trace.validationResults.confidence?.issues?.length || 0) +
                  (trace.validationResults.risk?.issues?.length || 0),
    },
    traceType: trace.traceType || 'standard',
    agentTrace: trace.agentTrace ? {
      agentId: trace.agentTrace.agentId,
      agentName: trace.agentTrace.agentName,
      goal: trace.agentTrace.goal,
      stepCount: trace.agentTrace.stepCount,
      toolCallCount: trace.agentTrace.toolCallCount,
      totalDurationMs: trace.agentTrace.totalDurationMs,
      status: trace.agentTrace.status,
    } : undefined,
  };
}
