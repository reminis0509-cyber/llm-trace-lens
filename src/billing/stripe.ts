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
 * Webhook シークレットを取得
 */
export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET が設定されていません');
  }
  return secret;
}
