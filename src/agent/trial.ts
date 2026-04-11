/**
 * Agent trial counting and billing enforcement.
 *
 * Business rule:
 *   - First 3 uses per workspace are free (lifetime, not monthly).
 *   - After that, each use costs ¥10 via Stripe PaymentIntent (off_session).
 *   - If no payment method is on file, the user is prompted to set one up.
 *
 * Usage is tracked in the `ai_tools_usage` table (migration 010)
 * with tool_name='agent' and action='chat'.
 */
import { getKnex } from '../storage/knex-client.js';

export const AGENT_FREE_TRIAL_LIMIT = 3;
export const AGENT_PER_USE_PRICE_YEN = 10;

export interface TrialInfo {
  used: number;
  limit: number;
  remaining: number;
  isTrialExhausted: boolean;
}

/**
 * Count lifetime agent chat uses for a workspace.
 * Returns 0 if the ai_tools_usage table does not exist yet.
 */
export async function getAgentUsageCount(workspaceId: string): Promise<number> {
  try {
    const db = getKnex();
    const row = await db('ai_tools_usage')
      .where({ workspace_id: workspaceId, tool_name: 'agent', action: 'chat' })
      .count('* as cnt')
      .first();
    return Number((row as Record<string, unknown>)?.cnt ?? 0);
  } catch {
    // Table may not exist in some environments (e.g. fresh dev setup).
    return 0;
  }
}

/**
 * Get the current trial status for a workspace.
 */
export async function getTrialStatus(workspaceId: string): Promise<TrialInfo> {
  const used = await getAgentUsageCount(workspaceId);
  const remaining = Math.max(0, AGENT_FREE_TRIAL_LIMIT - used);
  return {
    used,
    limit: AGENT_FREE_TRIAL_LIMIT,
    remaining,
    isTrialExhausted: remaining === 0,
  };
}

export interface BillingResult {
  allowed: boolean;
  trialInfo: TrialInfo;
  error?: string;
  /** URL for payment method setup (returned when no payment method on file) */
  setupUrl?: string;
  /** true if ¥10 was charged for this use */
  charged?: boolean;
}

/**
 * Main billing gate: determine whether a workspace is allowed to use the
 * agent right now.
 *
 * - used < 3  -> allowed (free trial)
 * - used >= 3, payment method on file -> attempt ¥10 charge
 * - used >= 3, no payment method -> blocked with setup prompt
 */
export async function enforceAgentBilling(workspaceId: string): Promise<BillingResult> {
  const trialInfo = await getTrialStatus(workspaceId);

  // Free trial still available
  if (!trialInfo.isTrialExhausted) {
    return { allowed: true, trialInfo };
  }

  // Trial exhausted — attempt per-use charge
  const { getStripeCustomerId, getDefaultPaymentMethod } = await import('../billing/storage.js');
  const { chargeAgentPerUse } = await import('../billing/stripe.js');

  const customerId = await getStripeCustomerId(workspaceId);
  const paymentMethodId = await getDefaultPaymentMethod(workspaceId);

  // No payment method on file — need setup
  if (!customerId || !paymentMethodId) {
    return {
      allowed: false,
      trialInfo,
      error: `無料トライアル（${AGENT_FREE_TRIAL_LIMIT}回）が終了しました。ご利用を継続するには、お支払い方法の登録が必要です。`,
    };
  }

  // Attempt charge
  const chargeResult = await chargeAgentPerUse(customerId, paymentMethodId, workspaceId);
  if (chargeResult.success) {
    return { allowed: true, trialInfo, charged: true };
  }

  return {
    allowed: false,
    trialInfo,
    error: '決済に失敗しました。お支払い方法をご確認ください。',
  };
}
