/**
 * Data Retention Manager
 * プランに応じたデータ保持期間の自動削除
 */
import { kv } from '@vercel/kv';
import { getWorkspaceKey } from '../storage/models.js';
import { getWorkspacePlan } from './storage.js';
import { getEffectiveLimits } from './index.js';

function isKVAvailable(): boolean {
  const hasUrl = !!(process.env.KV_REST_API_URL || process.env.KV_URL);
  const hasToken = !!process.env.KV_REST_API_TOKEN;
  return hasUrl && hasToken;
}

/** クリーンアップ間隔: 6時間（ミリ秒） */
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** 最後のクリーンアップ実行時刻を記録するキー */
const LAST_CLEANUP_KEY = 'system:last_retention_cleanup';

/**
 * ワークスペースの期限切れトレースを削除
 */
export async function cleanupExpiredTraces(workspaceId: string): Promise<number> {
  if (!isKVAvailable()) return 0;

  try {
    const plan = await getWorkspacePlan(workspaceId);
    const limits = getEffectiveLimits(plan);
    const cutoffTimestamp = Date.now() - (limits.retentionDays * 24 * 60 * 60 * 1000);

    const indexKey = getWorkspaceKey(workspaceId, 'traces:index');

    // retentionDays より古いトレースを取得（byScoreでスコア範囲指定）
    const expiredKeys = await kv.zrange<string[]>(indexKey, 0, cutoffTimestamp, { byScore: true });

    if (expiredKeys.length === 0) return 0;

    // トレースデータとインデックスの両方を削除
    await Promise.all(
      expiredKeys.map((key: string) => kv.del(key))
    );
    await kv.zremrangebyscore(indexKey, 0, cutoffTimestamp);

    console.log(`[Retention] ${workspaceId}: ${expiredKeys.length}件の期限切れトレースを削除`);
    return expiredKeys.length;
  } catch (error) {
    console.error(`[Retention] ${workspaceId}: クリーンアップ失敗:`, error);
    return 0;
  }
}

/**
 * 全ワークスペースの期限切れトレースを一括クリーンアップ
 */
export async function runRetentionCleanup(): Promise<{ total: number; workspaces: number }> {
  if (!isKVAvailable()) return { total: 0, workspaces: 0 };

  try {
    // 前回の実行から十分な時間が経過しているかチェック
    const lastCleanup = await kv.get<number>(LAST_CLEANUP_KEY);
    if (lastCleanup && Date.now() - lastCleanup < CLEANUP_INTERVAL_MS) {
      return { total: 0, workspaces: 0 };
    }

    const workspaceIds = await kv.smembers('workspaces:list');
    let totalDeleted = 0;
    let workspacesProcessed = 0;

    for (const wsId of workspaceIds) {
      const deleted = await cleanupExpiredTraces(wsId as string);
      if (deleted > 0) {
        totalDeleted += deleted;
        workspacesProcessed++;
      }
    }

    // 実行時刻を記録
    await kv.set(LAST_CLEANUP_KEY, Date.now());

    if (totalDeleted > 0) {
      console.log(`[Retention] クリーンアップ完了: ${totalDeleted}件削除 (${workspacesProcessed}ワークスペース)`);
    }

    return { total: totalDeleted, workspaces: workspacesProcessed };
  } catch (error) {
    console.error('[Retention] 一括クリーンアップ失敗:', error);
    return { total: 0, workspaces: 0 };
  }
}

/**
 * 定期的なクリーンアップを開始
 * サーバー起動時に呼び出す
 */
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function startRetentionScheduler(): void {
  if (cleanupTimer) return;

  // 起動後5分で初回実行
  setTimeout(() => {
    runRetentionCleanup().catch(err =>
      console.error('[Retention] 初回クリーンアップ失敗:', err)
    );
  }, 5 * 60 * 1000);

  // その後6時間ごとに実行
  cleanupTimer = setInterval(() => {
    runRetentionCleanup().catch(err =>
      console.error('[Retention] 定期クリーンアップ失敗:', err)
    );
  }, CLEANUP_INTERVAL_MS);

  console.log('[Retention] データ保持スケジューラ開始');
}

export function stopRetentionScheduler(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
