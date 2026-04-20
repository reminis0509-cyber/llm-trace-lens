/**
 * Stripe Client
 * Stripe SDK の初期化と設定
 */
import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

/**
 * Stripe クライアントを取得（シングルトン）
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY が設定されていません');
    }

    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
      typescript: true,
    });
  }

  return stripeInstance;
}

/**
 * Stripe が設定済みかチェック
 */
export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRO_PRICE_ID
  );
}

/**
 * プラン別の Price ID 環境変数マッピング
 *
 * ¥0 の Free と 個別見積の Enterprise は Stripe Subscription を持たないため除外.
 * Team は seat 課金 (quantity=seats で同じ Price を使用).
 */
const SUBSCRIBABLE_PRICE_ENV_VARS = {
  pro: 'STRIPE_PRO_PRICE_ID',
  team: 'STRIPE_TEAM_PRICE_ID',
  max: 'STRIPE_MAX_PRICE_ID',
} as const satisfies Record<'pro' | 'team' | 'max', string>;

export type SubscribablePlanId = keyof typeof SUBSCRIBABLE_PRICE_ENV_VARS;

/**
 * Pro プランの Price ID を取得
 */
export function getProPriceId(): string {
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    throw new Error('STRIPE_PRO_PRICE_ID が設定されていません');
  }
  return priceId;
}

/**
 * 指定プランの Stripe Subscription Price ID を取得
 * Free / Enterprise は Subscription を持たないため null を返す
 */
export function getSubscriptionPriceId(planId: SubscribablePlanId): string | undefined {
  const envName = SUBSCRIBABLE_PRICE_ENV_VARS[planId];
  return process.env[envName] || undefined;
}

/**
 * Webhook シークレットを取得
 */
export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET が設定されていません');
  }
  return secret;
}

// ===========================
// Metered Billing (Usage Overage)
// ===========================

/**
 * 従量課金対応プラン識別子
 *
 * Free は overage 発生前に block されるため対象外.
 * Enterprise は個別契約で overage 単価を決定するため, 環境変数はオプショナル.
 */
export type MeteredPlanId = 'pro' | 'team' | 'max' | 'enterprise';

export interface MeteredPriceIds {
  traceOveragePriceId: string | undefined;
  evalOveragePriceId: string | undefined;
}

/**
 * 環境変数名のマッピング（プラン別）
 *
 * 超過単価 (2026-04-20 承認):
 *   Pro        : trace ¥300/10K, eval ¥200/1K
 *   Team       : trace ¥300/10K, eval ¥200/1K
 *   Max        : trace ¥200/10K, eval ¥150/1K
 *   Enterprise : trace ¥100/10K, eval ¥100/1K (個別契約ベース)
 */
const METERED_ENV_VARS: Record<MeteredPlanId, { trace: string; eval: string }> = {
  pro: {
    trace: 'STRIPE_TRACE_OVERAGE_PRO_PRICE_ID',
    eval: 'STRIPE_EVAL_OVERAGE_PRO_PRICE_ID',
  },
  team: {
    trace: 'STRIPE_TRACE_OVERAGE_TEAM_PRICE_ID',
    eval: 'STRIPE_EVAL_OVERAGE_TEAM_PRICE_ID',
  },
  max: {
    trace: 'STRIPE_TRACE_OVERAGE_MAX_PRICE_ID',
    eval: 'STRIPE_EVAL_OVERAGE_MAX_PRICE_ID',
  },
  enterprise: {
    trace: 'STRIPE_TRACE_OVERAGE_ENTERPRISE_PRICE_ID',
    eval: 'STRIPE_EVAL_OVERAGE_ENTERPRISE_PRICE_ID',
  },
};

/**
 * 指定プランの従量課金 Price ID を取得
 * 環境変数が未設定の場合は undefined を返す（graceful degradation）
 */
export function getMeteredPriceIds(planId: MeteredPlanId): MeteredPriceIds {
  const envVars = METERED_ENV_VARS[planId];
  return {
    traceOveragePriceId: process.env[envVars.trace] || undefined,
    evalOveragePriceId: process.env[envVars.eval] || undefined,
  };
}

/**
 * 指定プランで従量課金が設定済みかチェック
 * トレースと評価の両方の Price ID が設定されている場合に true
 */
export function isMeteredBillingConfigured(planId: MeteredPlanId): boolean {
  const prices = getMeteredPriceIds(planId);
  return !!(prices.traceOveragePriceId && prices.evalOveragePriceId);
}

// ===========================
// Agent Per-Use Billing (¥10/use)
// ===========================

const AGENT_PER_USE_AMOUNT_JPY = 10;

/**
 * Get the Stripe Price ID for agent per-use billing (¥10/use).
 */
export function getAgentPerUsePriceId(): string | undefined {
  return process.env.STRIPE_AGENT_PRICE_ID;
}

/**
 * Create and confirm a PaymentIntent for per-use agent billing.
 * Uses off_session: true for automatic charging.
 */
export async function chargeAgentPerUse(
  customerId: string,
  paymentMethodId: string,
  workspaceId: string,
): Promise<{ success: boolean; paymentIntentId?: string; error?: string }> {
  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: AGENT_PER_USE_AMOUNT_JPY,
      currency: 'jpy',
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata: {
        type: 'agent_per_use',
        workspace_id: workspaceId,
      },
    });

    if (paymentIntent.status === 'succeeded') {
      return { success: true, paymentIntentId: paymentIntent.id };
    }
    return { success: false, error: `Payment status: ${paymentIntent.status}` };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Stripe] Agent per-use charge failed:', message);
    return { success: false, error: message };
  }
}
