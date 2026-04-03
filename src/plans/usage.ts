/**
 * Usage Tracking
 * ワークスペースごとの月間/日次トレース数・評価回数をカウント
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

/** 日次カウンターの有効期限: 48時間（日次リセットに余裕を持たせる） */
const DAILY_COUNTER_EXPIRY_SECONDS = 60 * 60 * 48;

export interface UsageStats {
  /** 当月のトレース数 */
  traceCount: number;
  /** 当月のLLM-as-Judge評価回数 */
  evaluationCount: number;
  /** 当月の月識別子 (YYYY-MM) */
  month: string;
}

export interface DailyUsageStats {
  /** 当日のトレース数 */
  traceCount: number;
  /** 当日の日付識別子 (YYYY-MM-DD) in JST */
  date: string;
}

/**
 * 現在の月を YYYY-MM 形式で取得
 */
function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * 現在のJST日付を YYYY-MM-DD 形式で取得
 */
function getCurrentDateJST(): string {
  const now = new Date();
  // UTC+9 for JST
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(now.getTime() + jstOffset);
  return jstDate.toISOString().slice(0, 10);
}

/**
 * 次のJST深夜0時のISO文字列を取得
 */
export function getNextJSTMidnight(): string {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  // JST tomorrow at 00:00:00
  const jstTomorrow = new Date(Date.UTC(
    jstNow.getUTCFullYear(),
    jstNow.getUTCMonth(),
    jstNow.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  // Convert back from JST to UTC
  const utcMidnight = new Date(jstTomorrow.getTime() - jstOffset);
  return utcMidnight.toISOString();
}

/**
 * 次の月初のISO文字列を取得
 */
export function getNextMonthStart(): string {
  const now = new Date();
  const nextMonth = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1, 0, 0, 0, 0
  ));
  return nextMonth.toISOString();
}

/**
 * 月次使用量キー生成
 */
function getUsageKey(workspaceId: string, month: string, metric: string): string {
  return getWorkspaceKey(workspaceId, `usage:${month}:${metric}`);
}

/**
 * 日次使用量キー生成
 */
function getDailyUsageKey(workspaceId: string, date: string, metric: string): string {
  return getWorkspaceKey(workspaceId, `usage:daily:${date}:${metric}`);
}

/**
 * トレース数をインクリメント（月次）
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
    // プランチェック失敗時はfail-open
    return 0;
  }
}

/**
 * トレース数をインクリメント（日次 - Freeプラン用）
 */
export async function incrementDailyTraceCount(workspaceId: string): Promise<number> {
  if (!isKVAvailable()) {
    return 0;
  }

  const date = getCurrentDateJST();
  const key = getDailyUsageKey(workspaceId, date, 'traces');

  try {
    const count = await kv.incr(key);
    if (count === 1) {
      await kv.expire(key, DAILY_COUNTER_EXPIRY_SECONDS);
    }
    return count;
  } catch (error) {
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
    return 0;
  }
}

/**
 * 当月の使用量統計を取得（月次）
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
    return defaultStats;
  }
}

/**
 * 当日のトレース使用量を取得（日次 - Freeプラン用、JST基準）
 */
export async function getDailyUsageStats(workspaceId: string): Promise<DailyUsageStats> {
  const date = getCurrentDateJST();
  const defaultStats: DailyUsageStats = { traceCount: 0, date };

  if (!isKVAvailable()) {
    return defaultStats;
  }

  try {
    const traceCount = await kv.get<number>(getDailyUsageKey(workspaceId, date, 'traces'));
    return {
      traceCount: traceCount || 0,
      date,
    };
  } catch (error) {
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
    return defaultStats;
  }
}
