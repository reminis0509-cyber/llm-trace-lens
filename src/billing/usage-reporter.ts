/**
 * Usage Overage Reporter
 * ワークスペースの使用量超過分を Stripe に報告する
 *
 * Trace overage: 10,000 トレース単位（切り上げ）
 * Eval overage: 1,000 評価単位（切り上げ）
 */
import Stripe from 'stripe';
import { getStripe, getMeteredPriceIds, type MeteredPlanId } from '../billing/stripe.js';
import { getUsageStats } from '../plans/usage.js';
import { getPlanLimits, type PlanType } from '../plans/index.js';
import { getStripeCustomerId, getSubscriptionStatus } from '../billing/storage.js';
import { getWorkspacePlan } from '../plans/storage.js';

export interface OverageResult {
  traceOverage: number;
  evalOverage: number;
}

/**
 * ワークスペースの当月使用量とプラン上限を比較し、超過分を算出する
 * 超過がない場合は 0 を返す
 */
export async function calculateOverage(workspaceId: string): Promise<OverageResult> {
  const [usage, plan] = await Promise.all([
    getUsageStats(workspaceId),
    getWorkspacePlan(workspaceId),
  ]);

  const limits = getPlanLimits(plan.planType);

  // monthlyTraces が -1 または Infinity の場合は超過なし
  const traceOverage =
    limits.monthlyTraces > 0
      ? Math.max(0, usage.traceCount - limits.monthlyTraces)
      : 0;

  // monthlyEvaluations が 0 の場合（Free プラン）は超過カウントしない
  // Infinity の場合（Enterprise）も超過なし
  const evalOverage =
    limits.monthlyEvaluations > 0 && isFinite(limits.monthlyEvaluations)
      ? Math.max(0, usage.evaluationCount - limits.monthlyEvaluations)
      : 0;

  return { traceOverage, evalOverage };
}

/**
 * Stripe サブスクリプションから指定 Price ID のサブスクリプションアイテム ID を取得する
 */
async function findSubscriptionItemId(
  stripe: Stripe,
  subscriptionId: string,
  priceId: string
): Promise<string | null> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data'],
  });

  const item = subscription.items.data.find(
    (si: Stripe.SubscriptionItem) => si.price.id === priceId
  );

  return item?.id ?? null;
}

/**
 * PlanType を MeteredPlanId に変換する
 * free / enterprise はメータード課金の対象外のため null を返す
 */
function toMeteredPlanId(planType: PlanType): MeteredPlanId | null {
  if (planType === 'pro') return 'pro';
  // 将来の Enterprise サブティア対応用
  // if (planType === 'standard') return 'standard';
  // if (planType === 'plus') return 'plus';
  // if (planType === 'premium') return 'premium';
  return null;
}

/**
 * ワークスペースの使用量超過分を Stripe に報告する
 *
 * - subscriptionItems.createUsageRecord() で action: 'set' を使用し、
 *   当月の累計超過量を冪等に報告する（increment ではない）
 * - Trace overage: 10,000 トレース単位（切り上げ）
 * - Eval overage: 1,000 評価単位（切り上げ）
 */
export async function reportUsageToStripe(workspaceId: string): Promise<void> {
  const plan = await getWorkspacePlan(workspaceId);
  const meteredPlanId = toMeteredPlanId(plan.planType);

  if (!meteredPlanId) {
    // Free / Enterprise プランは従量課金対象外
    return;
  }

  const meteredPrices = getMeteredPriceIds(meteredPlanId);
  if (!meteredPrices.traceOveragePriceId && !meteredPrices.evalOveragePriceId) {
    // 従量課金が設定されていない場合はスキップ
    return;
  }

  const subscriptionInfo = await getSubscriptionStatus(workspaceId);
  if (!subscriptionInfo || subscriptionInfo.status !== 'active') {
    // アクティブなサブスクリプションがない場合はスキップ
    return;
  }

  const overage = await calculateOverage(workspaceId);
  const stripe = getStripe();
  const subscriptionId = subscriptionInfo.subscriptionId;

  // Trace overage の報告
  if (meteredPrices.traceOveragePriceId && overage.traceOverage > 0) {
    const traceUnits = Math.ceil(overage.traceOverage / 10_000);
    const itemId = await findSubscriptionItemId(
      stripe,
      subscriptionId,
      meteredPrices.traceOveragePriceId
    );

    if (itemId) {
      await stripe.subscriptionItems.createUsageRecord(itemId, {
        quantity: traceUnits,
        action: 'set',
        timestamp: 'now',
      });
    }
  }

  // Eval overage の報告
  if (meteredPrices.evalOveragePriceId && overage.evalOverage > 0) {
    const evalUnits = Math.ceil(overage.evalOverage / 1_000);
    const itemId = await findSubscriptionItemId(
      stripe,
      subscriptionId,
      meteredPrices.evalOveragePriceId
    );

    if (itemId) {
      await stripe.subscriptionItems.createUsageRecord(itemId, {
        quantity: evalUnits,
        action: 'set',
        timestamp: 'now',
      });
    }
  }
}
