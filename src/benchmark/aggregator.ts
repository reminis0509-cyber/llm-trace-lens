/**
 * Benchmark Aggregator
 *
 * 各ワークスペースのトレースデータを匿名化・集約し、
 * 業界ベンチマークを生成する。
 *
 * 透明性原則（Aプラン）:
 * - 個社のデータは匿名化され、他社から特定不可能
 * - 業界ベンチマークは3社以上参加時のみ公開
 * - 利用規約に集約利用を明記
 */

import { kv } from '@vercel/kv';
import { getAdapter } from '../storage/adapter.js';
import type { WorkspaceTraceRecord } from '../storage/adapter.js';
import type { EvaluationResult } from '../evaluation/types.js';
import type { TraceEvaluations } from '../types/index.js';
import type {
  IndustryCategory,
  WorkspaceMetrics,
  IndustryBenchmark,
  BenchmarkComparison,
  BenchmarkRanking,
  PercentileData,
} from './types.js';
import { MIN_PARTICIPANTS_FOR_BENCHMARK } from './types.js';

/**
 * ワークスペースの業種設定を取得
 */
export async function getWorkspaceIndustry(workspaceId: string): Promise<IndustryCategory | null> {
  const adapter = await getAdapter();
  return adapter.getWorkspaceSetting<IndustryCategory>(workspaceId, 'industry');
}

/**
 * ワークスペースの業種を設定
 */
export async function setWorkspaceIndustry(workspaceId: string, industry: IndustryCategory): Promise<void> {
  const adapter = await getAdapter();
  await adapter.saveWorkspaceSetting(workspaceId, 'industry', industry);
}

/**
 * 単一ワークスペースのメトリクスを計算
 */
export async function calculateWorkspaceMetrics(
  workspaceId: string,
  period: string // YYYY-MM
): Promise<WorkspaceMetrics | null> {
  const industry = await getWorkspaceIndustry(workspaceId);
  if (!industry) return null;

  const adapter = await getAdapter();

  // 対象期間のトレースを取得
  const [year, month] = period.split('-').map(Number);
  const startTime = new Date(year, month - 1, 1);
  const endTime = new Date(year, month, 0, 23, 59, 59, 999);

  const traces = await adapter.getTraces(workspaceId, {
    startTime,
    endTime,
    limit: 10000,
  });

  if (traces.length === 0) return null;

  // 基本統計
  const latencies = traces.map(t => t.latency_ms).filter(l => l > 0);
  const tokens = traces
    .map(t => t.usage?.total_tokens)
    .filter((t): t is number => t != null && t > 0);
  const costs = traces
    .map(t => t.estimated_cost)
    .filter((c): c is number => c != null && c > 0);

  // LLM-as-Judge評価メトリクス
  const evaluations = traces
    .map(t => t.evaluation)
    .filter((e): e is EvaluationResult => e != null);

  const relevanceScores = evaluations
    .map(e => e.answerRelevance)
    .filter((s): s is number => s != null);
  const faithfulnessScores = evaluations
    .map(e => e.faithfulness)
    .filter((s): s is number => s != null);
  const contextUtilScores = evaluations
    .filter(e => e.isRAG)
    .map(e => e.contextUtilization)
    .filter((s): s is number => s != null);
  const hallucinationScores = evaluations
    .filter(e => e.isRAG)
    .map(e => e.hallucinationRate)
    .filter((s): s is number => s != null);
  const ragTraces = evaluations.filter(e => e.isRAG);

  // パターン評価メトリクス
  const patternEvals = traces
    .map(t => t.evaluations)
    .filter((e): e is TraceEvaluations => e != null);
  const toxicityFlagged = patternEvals.filter(e => e.toxicity?.flagged).length;
  const injectionFlagged = patternEvals.filter(e => e.promptInjection?.flagged).length;

  return {
    workspaceId,
    period,
    industry,
    traceCount: traces.length,
    avgLatencyMs: avg(latencies),
    avgTokensPerRequest: avg(tokens),
    avgCostPerRequest: avg(costs),
    avgAnswerRelevance: relevanceScores.length > 0 ? avg(relevanceScores) : null,
    avgFaithfulness: faithfulnessScores.length > 0 ? avg(faithfulnessScores) : null,
    avgContextUtilization: contextUtilScores.length > 0 ? avg(contextUtilScores) : null,
    avgHallucinationRate: hallucinationScores.length > 0 ? avg(hallucinationScores) : null,
    ragTraceRatio: evaluations.length > 0 ? ragTraces.length / evaluations.length : 0,
    toxicityFlagRate: patternEvals.length > 0 ? toxicityFlagged / patternEvals.length : 0,
    injectionFlagRate: patternEvals.length > 0 ? injectionFlagged / patternEvals.length : 0,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * 業界ベンチマークを集約生成
 * 同一業種のワークスペースメトリクスを匿名化・集約する
 */
export function aggregateIndustryBenchmark(
  industry: IndustryCategory,
  period: string,
  metricsArray: WorkspaceMetrics[]
): IndustryBenchmark | null {
  if (metricsArray.length < MIN_PARTICIPANTS_FOR_BENCHMARK) {
    return null; // 匿名性確保のため最低3社必要
  }

  const latencies = metricsArray.map(m => m.avgLatencyMs);
  const tokens = metricsArray.map(m => m.avgTokensPerRequest);
  const costs = metricsArray.map(m => m.avgCostPerRequest);
  const relevance = metricsArray.map(m => m.avgAnswerRelevance).filter((s): s is number => s != null);
  const faithfulness = metricsArray.map(m => m.avgFaithfulness).filter((s): s is number => s != null);
  const contextUtil = metricsArray.map(m => m.avgContextUtilization).filter((s): s is number => s != null);
  const hallucination = metricsArray.map(m => m.avgHallucinationRate).filter((s): s is number => s != null);
  const ragRatios = metricsArray.map(m => m.ragTraceRatio);
  const toxicity = metricsArray.map(m => m.toxicityFlagRate);
  const injection = metricsArray.map(m => m.injectionFlagRate);

  return {
    industry,
    period,
    participantCount: metricsArray.length,
    avgLatencyMs: avg(latencies),
    medianLatencyMs: median(latencies),
    avgTokensPerRequest: avg(tokens),
    avgCostPerRequest: avg(costs),
    avgAnswerRelevance: relevance.length > 0 ? avg(relevance) : null,
    avgFaithfulness: faithfulness.length > 0 ? avg(faithfulness) : null,
    avgContextUtilization: contextUtil.length > 0 ? avg(contextUtil) : null,
    avgHallucinationRate: hallucination.length > 0 ? avg(hallucination) : null,
    avgRagTraceRatio: avg(ragRatios),
    avgToxicityFlagRate: avg(toxicity),
    avgInjectionFlagRate: avg(injection),
    percentiles: {
      answerRelevance: relevance.length >= MIN_PARTICIPANTS_FOR_BENCHMARK
        ? calculatePercentiles(relevance)
        : null,
      hallucinationRate: hallucination.length >= MIN_PARTICIPANTS_FOR_BENCHMARK
        ? calculatePercentiles(hallucination)
        : null,
      latencyMs: calculatePercentiles(latencies),
      costPerRequest: calculatePercentiles(costs),
    },
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * ワークスペースの業界内ランキングを算出
 */
export function calculateRanking(
  workspace: WorkspaceMetrics,
  benchmark: IndustryBenchmark
): BenchmarkRanking {
  const percentiles: number[] = [];

  // 回答関連性（高いほど良い → 高パーセンタイル = 良い）
  let answerRelevancePercentile: number | null = null;
  if (workspace.avgAnswerRelevance != null && benchmark.percentiles.answerRelevance) {
    answerRelevancePercentile = getPercentilePosition(
      workspace.avgAnswerRelevance,
      benchmark.percentiles.answerRelevance,
      'higher_is_better'
    );
    percentiles.push(answerRelevancePercentile);
  }

  // ハルシネーション率（低いほど良い → 低い値 = 高パーセンタイル）
  let hallucinationRatePercentile: number | null = null;
  if (workspace.avgHallucinationRate != null && benchmark.percentiles.hallucinationRate) {
    hallucinationRatePercentile = getPercentilePosition(
      workspace.avgHallucinationRate,
      benchmark.percentiles.hallucinationRate,
      'lower_is_better'
    );
    percentiles.push(hallucinationRatePercentile);
  }

  // レイテンシ（低いほど良い）
  const latencyPercentile = getPercentilePosition(
    workspace.avgLatencyMs,
    benchmark.percentiles.latencyMs,
    'lower_is_better'
  );
  percentiles.push(latencyPercentile);

  // コスト効率（低いほど良い）
  const costEfficiencyPercentile = getPercentilePosition(
    workspace.avgCostPerRequest,
    benchmark.percentiles.costPerRequest,
    'lower_is_better'
  );
  percentiles.push(costEfficiencyPercentile);

  return {
    answerRelevancePercentile,
    hallucinationRatePercentile,
    latencyPercentile,
    costEfficiencyPercentile,
    overallPercentile: percentiles.length > 0 ? avg(percentiles) : null,
  };
}

/**
 * ベンチマーク比較データを取得（APIレスポンス用）
 */
export async function getBenchmarkComparison(
  workspaceId: string,
  period?: string
): Promise<BenchmarkComparison | null> {
  const targetPeriod = period || getCurrentPeriod();

  // ワークスペースメトリクスを取得（キャッシュ or 計算）
  const cachedWorkspace = await getCachedWorkspaceMetrics(workspaceId, targetPeriod);
  const workspace = cachedWorkspace || await calculateWorkspaceMetrics(workspaceId, targetPeriod);

  if (!workspace) return null;

  // キャッシュ保存
  if (!cachedWorkspace) {
    await cacheWorkspaceMetrics(workspace);
  }

  // 業界ベンチマークを取得
  const benchmark = await getCachedIndustryBenchmark(workspace.industry, targetPeriod);

  // ランキング算出
  const ranking = benchmark ? calculateRanking(workspace, benchmark) : null;

  return { workspace, industry: benchmark, ranking };
}

// ========== キャッシュ操作 ==========

async function getCachedWorkspaceMetrics(
  workspaceId: string,
  period: string
): Promise<WorkspaceMetrics | null> {
  try {
    return await kv.get<WorkspaceMetrics>(`benchmark:workspace:${workspaceId}:${period}`);
  } catch {
    return null;
  }
}

async function cacheWorkspaceMetrics(metrics: WorkspaceMetrics): Promise<void> {
  try {
    // 60日間キャッシュ
    await kv.set(
      `benchmark:workspace:${metrics.workspaceId}:${metrics.period}`,
      metrics,
      { ex: 60 * 24 * 60 * 60 }
    );
  } catch (error) {
    console.error('[Benchmark] Failed to cache workspace metrics:', error);
  }
}

async function getCachedIndustryBenchmark(
  industry: IndustryCategory,
  period: string
): Promise<IndustryBenchmark | null> {
  try {
    return await kv.get<IndustryBenchmark>(`benchmark:industry:${industry}:${period}`);
  } catch {
    return null;
  }
}

export async function cacheIndustryBenchmark(benchmark: IndustryBenchmark): Promise<void> {
  try {
    await kv.set(
      `benchmark:industry:${benchmark.industry}:${benchmark.period}`,
      benchmark,
      { ex: 60 * 24 * 60 * 60 }
    );
  } catch (error) {
    console.error('[Benchmark] Failed to cache industry benchmark:', error);
  }
}

// ========== ユーティリティ ==========

function avg(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculatePercentiles(values: number[]): PercentileData {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
  };
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}

/**
 * 値がパーセンタイル分布のどの位置にいるかを算出（0-100）
 */
function getPercentilePosition(
  value: number,
  pData: PercentileData,
  direction: 'higher_is_better' | 'lower_is_better'
): number {
  // 線形補間でパーセンタイルポジションを推定
  const points = [
    { p: 25, v: pData.p25 },
    { p: 50, v: pData.p50 },
    { p: 75, v: pData.p75 },
    { p: 90, v: pData.p90 },
  ];

  let position: number;

  if (value <= points[0].v) {
    position = value / points[0].v * 25;
  } else if (value >= points[3].v) {
    position = 90 + (value - points[3].v) / (points[3].v * 0.5) * 10;
  } else {
    // 線形補間
    for (let i = 0; i < points.length - 1; i++) {
      if (value >= points[i].v && value <= points[i + 1].v) {
        const range = points[i + 1].v - points[i].v;
        const pRange = points[i + 1].p - points[i].p;
        position = range > 0
          ? points[i].p + ((value - points[i].v) / range) * pRange
          : points[i].p;
        break;
      }
    }
    position = position! ?? 50;
  }

  position = Math.max(0, Math.min(100, position));

  // lower_is_better の場合は反転（低い値 = 高ランク）
  if (direction === 'lower_is_better') {
    position = 100 - position;
  }

  return Math.round(position);
}

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
