/**
 * Billing Storage
 * Stripe Customer ↔ Workspace のマッピングをKVに保存
 */
import { kv } from '@vercel/kv';

function isKVAvailable(): boolean {
  const hasUrl = !!(process.env.KV_REST_API_URL || process.env.KV_URL);
  const hasToken = !!process.env.KV_REST_API_TOKEN;
  return hasUrl && hasToken;
}

/**
 * ワークスペースに紐づくStripe Customer IDを取得
 */
export async function getStripeCustomerId(workspaceId: string): Promise<string | null> {
  if (!isKVAvailable()) return null;

  try {
    return await kv.get<string>(`workspace:${workspaceId}:stripe_customer_id`);
  } catch (error) {
    console.error('[Billing] Stripe Customer ID取得失敗:', error);
    return null;
  }
}

/**
 * ワークスペースにStripe Customer IDを紐付け
 */
export async function setStripeCustomerId(workspaceId: string, customerId: string): Promise<void> {
  if (!isKVAvailable()) {
    console.warn('[Billing] KV未設定のためStripe Customer IDは保存されません');
    return;
  }

  try {
    // 双方向マッピング
    await kv.set(`workspace:${workspaceId}:stripe_customer_id`, customerId);
    await kv.set(`stripe_customer:${customerId}:workspace_id`, workspaceId);
  } catch (error) {
    console.error('[Billing] Stripe Customer ID保存失敗:', error);
    throw new Error('Stripe Customer IDの保存に失敗しました');
  }
}

/**
 * Stripe Customer IDからワークスペースIDを取得
 */
export async function getWorkspaceByStripeCustomer(customerId: string): Promise<string | null> {
  if (!isKVAvailable()) return null;

  try {
    return await kv.get<string>(`stripe_customer:${customerId}:workspace_id`);
  } catch (error) {
    console.error('[Billing] ワークスペースID取得失敗:', error);
    return null;
  }
}

/**
 * サブスクリプションステータスを保存
 */
export async function setSubscriptionStatus(
  workspaceId: string,
  status: 'active' | 'past_due' | 'canceled' | 'unpaid',
  subscriptionId: string
): Promise<void> {
  if (!isKVAvailable()) return;

  try {
    await kv.set(`workspace:${workspaceId}:subscription_status`, {
      status,
      subscriptionId,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Billing] サブスクリプションステータス保存失敗:', error);
  }
}

/**
 * サブスクリプションステータスを取得
 */
export async function getSubscriptionStatus(workspaceId: string): Promise<{
  status: string;
  subscriptionId: string;
  updatedAt: string;
} | null> {
  if (!isKVAvailable()) return null;

  try {
    return await kv.get(`workspace:${workspaceId}:subscription_status`);
  } catch (error) {
    console.error('[Billing] サブスクリプションステータス取得失敗:', error);
    return null;
  }
}

/**
 * Store default payment method for agent per-use billing.
 */
export async function setDefaultPaymentMethod(workspaceId: string, paymentMethodId: string): Promise<void> {
  if (!isKVAvailable()) return;
  try {
    await kv.set(`workspace:${workspaceId}:default_payment_method`, paymentMethodId);
  } catch (error) {
    console.error('[BillingStorage] Failed to save payment method:', error);
  }
}

/**
 * Get default payment method for agent per-use billing.
 */
export async function getDefaultPaymentMethod(workspaceId: string): Promise<string | null> {
  if (!isKVAvailable()) return null;
  try {
    return await kv.get<string>(`workspace:${workspaceId}:default_payment_method`);
  } catch {
    return null;
  }
}
