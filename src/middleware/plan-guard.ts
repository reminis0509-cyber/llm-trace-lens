/**
 * Plan Guard Middleware
 * プランの月間トレース数制限を強制
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { getWorkspacePlan } from '../plans/storage.js';
import { getUsageStats, incrementTraceCount } from '../plans/usage.js';
import { getEffectiveLimits, getPlanNameJa } from '../plans/index.js';

/**
 * プラン制限チェック対象のパス
 */
const PLAN_CHECK_PATHS = [
  '/v1/chat/completions',
  '/v1/completions',
  '/v1/embeddings',
];

/**
 * プラン制限ミドルウェア
 * 月間トレース数を超過している場合はリクエストをブロック
 */
export async function planGuardMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // トレース発生するエンドポイントのみチェック
  const requiresCheck = PLAN_CHECK_PATHS.some(path => request.url.startsWith(path));
  if (!requiresCheck) {
    return;
  }

  const workspaceId = request.workspace?.workspaceId;
  if (!workspaceId) {
    return; // authミドルウェアが先に処理
  }

  try {
    const plan = await getWorkspacePlan(workspaceId);
    const limits = getEffectiveLimits(plan);
    const usage = await getUsageStats(workspaceId);

    // プラン期限チェック
    if (plan.expiresAt && new Date(plan.expiresAt) < new Date()) {
      return reply.code(402).send({
        error: 'Payment Required',
        message: 'プランの契約期間が終了しました。更新してください。',
        plan: {
          type: plan.planType,
          name: getPlanNameJa(plan.planType),
          expiresAt: plan.expiresAt,
        },
      });
    }

    // トレース数制限チェック
    if (usage.traceCount >= limits.monthlyTraces) {
      const planName = getPlanNameJa(plan.planType);

      // レスポンスヘッダーに使用量を付与
      reply.header('X-Plan-Type', plan.planType);
      reply.header('X-Usage-Traces', usage.traceCount.toString());
      reply.header('X-Limit-Traces', limits.monthlyTraces.toString());

      return reply.code(429).send({
        error: 'Plan Limit Exceeded',
        message: `${planName}プランの月間トレース上限（${limits.monthlyTraces.toLocaleString()}件）に達しました。プランをアップグレードしてください。`,
        usage: {
          current: usage.traceCount,
          limit: limits.monthlyTraces,
          month: usage.month,
        },
        plan: {
          type: plan.planType,
          name: planName,
        },
        upgrade: plan.planType === 'free'
          ? { recommended: 'pro', priceMonthly: 9800 }
          : plan.planType === 'pro'
            ? { recommended: 'enterprise', priceMonthly: null }
            : undefined,
      });
    }

    // トレースカウントをインクリメント
    const newCount = await incrementTraceCount(workspaceId);

    // 使用量をレスポンスヘッダーに付与（クライアント側で残量確認可能）
    reply.header('X-Plan-Type', plan.planType);
    reply.header('X-Usage-Traces', newCount.toString());
    reply.header('X-Limit-Traces', limits.monthlyTraces === Infinity ? 'unlimited' : limits.monthlyTraces.toString());

    // 90%到達で警告ヘッダー
    const usagePercentage = usage.traceCount / limits.monthlyTraces;
    if (usagePercentage >= 0.9 && limits.monthlyTraces !== Infinity) {
      reply.header('X-Plan-Warning', `月間トレース上限の${(usagePercentage * 100).toFixed(0)}%に達しています`);
    }
  } catch (error) {
    console.error('[PlanGuard] プラン制限チェック失敗:', error);
    // プランチェック失敗時はリクエストを許可（プラン機能でサービスを止めない）
    // budget-guardとは異なり、プランは課金機能なのでfail-open
  }
}
