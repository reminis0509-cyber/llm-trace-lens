/**
 * Agent trial counting and billing enforcement.
 *
 * Business rule:
 *   - First 3 uses per workspace are free (lifetime, not monthly).
 *   - After that, each use costs ¥10.
 *   - Until Stripe metered billing is wired, uses >= 3 are simply blocked
 *     with a message asking the user to contact sales.
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

/**
 * Main billing gate: determine whether a workspace is allowed to use the
 * agent right now.
 *
 * - used < 3  -> allowed
 * - used >= 3 -> blocked with Japanese error message
 */
export async function enforceAgentBilling(workspaceId: string): Promise<{
  allowed: boolean;
  trialInfo: TrialInfo;
  error?: string;
}> {
  const trialInfo = await getTrialStatus(workspaceId);

  if (!trialInfo.isTrialExhausted) {
    return { allowed: true, trialInfo };
  }

  return {
    allowed: false,
    trialInfo,
    error:
      '無料トライアル（3回）が終了しました。従量課金（¥10/回）でご利用を継続するにはお問い合わせください。',
  };
}
