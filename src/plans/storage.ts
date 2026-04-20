/**
 * Plan Storage
 * ワークスペースのプラン情報の永続化
 */
import { kv } from '@vercel/kv';
import { isValidPlanType, type WorkspacePlan, type PlanType } from './index.js';

function isKVAvailable(): boolean {
  const hasUrl = !!(process.env.KV_REST_API_URL || process.env.KV_URL);
  const hasToken = !!process.env.KV_REST_API_TOKEN;
  return hasUrl && hasToken;
}

function getPlanKey(workspaceId: string): string {
  return `workspace:${workspaceId}:plan`;
}

/**
 * ワークスペースのプラン情報を取得
 * 未設定の場合はFreeプランをデフォルトで返す
 */
export async function getWorkspacePlan(workspaceId: string): Promise<WorkspacePlan> {
  const defaultPlan: WorkspacePlan = {
    workspaceId,
    planType: 'free',
    startedAt: new Date().toISOString(),
  };

  if (!isKVAvailable()) {
    // 環境変数でデフォルトプランを指定可能
    const envPlan = process.env.DEFAULT_PLAN as PlanType | undefined;
    if (envPlan && isValidPlanType(envPlan)) {
      return { ...defaultPlan, planType: envPlan };
    }
    return defaultPlan;
  }

  try {
    const plan = await kv.get<WorkspacePlan>(getPlanKey(workspaceId));
    return plan || defaultPlan;
  } catch (error) {
    console.error('[PlanStorage] プラン情報取得失敗:', error);
    return defaultPlan;
  }
}

/**
 * ワークスペースのプラン情報を保存
 */
export async function saveWorkspacePlan(plan: WorkspacePlan): Promise<void> {
  if (!isKVAvailable()) {
    console.warn('[PlanStorage] KV未設定のためプラン情報は保存されません');
    return;
  }

  try {
    await kv.set(getPlanKey(plan.workspaceId), plan);
  } catch (error) {
    console.error('[PlanStorage] プラン保存失敗:', error);
    throw new Error('プラン情報の保存に失敗しました');
  }
}

/**
 * ワークスペースのプランを変更
 */
export async function updateWorkspacePlan(
  workspaceId: string,
  planType: PlanType,
  options?: {
    subscriptionId?: string;
    expiresAt?: string;
    customLimits?: WorkspacePlan['customLimits'];
    trialStartedAt?: string;
    seats?: number;
  }
): Promise<WorkspacePlan> {
  const existing = await getWorkspacePlan(workspaceId);

  const updated: WorkspacePlan = {
    workspaceId,
    planType,
    startedAt: new Date().toISOString(),
    subscriptionId: options?.subscriptionId || existing.subscriptionId,
    expiresAt: options?.expiresAt,
    customLimits: options?.customLimits,
    seats: options?.seats ?? (planType === 'team' ? existing.seats : undefined),
    trialStartedAt: options?.trialStartedAt || existing.trialStartedAt,
  };

  await saveWorkspacePlan(updated);
  return updated;
}
