/**
 * Usage Tracking
 * ワークスペースごとの月間トレース数・評価回数をカウント
 */
import { kv } from '@vercel/kv';
import { getWorkspaceKey } from '../storage/models.js';

function isKVAvailable(): boolean {
  const hasUrl = !!(process.env.KV_REST_API_URL || process.env.KV_URL);
  const hasToken = !!process.env.KV_REST_API_TOKEN;
  return hasUrl && hasToken;
}

/** 使用量カウンターの有効期限: 35日間（月次リセットに余裕を持たせる） */
const USAGE_COUNTER_EXPIRY_SECONDS = 60 * 60 * 24 * 35;

export interface UsageStats {
  /** 当月のトレース数 */
  traceCount: number;
  /** 当月のLLM-as-Judge評価回数 */
  evaluationCount: number;
  /** 当月の月識別子 (YYYY-MM) */
  month: string;
}

/**
 * 現在の月を YYYY-MM 形式で取得
 */
function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * 使用量キー生成
 */
function getUsageKey(workspaceId: string, month: string, metric: string): string {
  return getWorkspaceKey(workspaceId, `usage:${month}:${metric}`);
}

/**
 * トレース数をインクリメント
 */
export async function incrementTraceCount(workspaceId: string): Promise<number> {
  if (!isKVAvailable()) {
    return 0;
  }

  const month = getCurrentMonth();
  const key = getUsageKey(workspaceId, month, 'traces');

  try {
    const count = await kv.incr(key);
    // 初回なら有効期限を設定
    if (count === 1) {
      await kv.expire(key, USAGE_COUNTER_EXPIRY_SECONDS);
    }
    return count;
  } catch (error) {
    console.error('[Usage] トレースカウント更新失敗:', error);
    return 0;
  }
}

/**
 * LLM-as-Judge 評価回数をインクリメント
 */
export async function incrementEvaluationCount(workspaceId: string): Promise<number> {
  if (!isKVAvailable()) {
    return 0;
  }

  const month = getCurrentMonth();
  const key = getUsageKey(workspaceId, month, 'evaluations');

  try {
    const count = await kv.incr(key);
    if (count === 1) {
      await kv.expire(key, USAGE_COUNTER_EXPIRY_SECONDS);
    }
    return count;
  } catch (error) {
    console.error('[Usage] 評価カウント更新失敗:', error);
    return 0;
  }
}

/**
 * 当月の使用量統計を取得
 */
export async function getUsageStats(workspaceId: string): Promise<UsageStats> {
  const month = getCurrentMonth();
  const defaultStats: UsageStats = { traceCount: 0, evaluationCount: 0, month };

  if (!isKVAvailable()) {
    return defaultStats;
  }

  try {
    const [traceCount, evaluationCount] = await Promise.all([
      kv.get<number>(getUsageKey(workspaceId, month, 'traces')),
      kv.get<number>(getUsageKey(workspaceId, month, 'evaluations')),
    ]);

    return {
      traceCount: traceCount || 0,
      evaluationCount: evaluationCount || 0,
      month,
    };
  } catch (error) {
    console.error('[Usage] 使用量取得失敗:', error);
    return defaultStats;
  }
}

/**
 * 指定月の使用量統計を取得
 */
export async function getUsageStatsForMonth(workspaceId: string, month: string): Promise<UsageStats> {
  const defaultStats: UsageStats = { traceCount: 0, evaluationCount: 0, month };

  if (!isKVAvailable()) {
    return defaultStats;
  }

  try {
    const [traceCount, evaluationCount] = await Promise.all([
      kv.get<number>(getUsageKey(workspaceId, month, 'traces')),
      kv.get<number>(getUsageKey(workspaceId, month, 'evaluations')),
    ]);

    return {
      traceCount: traceCount || 0,
      evaluationCount: evaluationCount || 0,
      month,
    };
  } catch (error) {
    console.error('[Usage] 使用量取得失敗:', error);
    return defaultStats;
  }
}
