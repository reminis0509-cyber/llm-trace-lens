/**
 * Signup Credit Storage
 *
 * Manages the ¥10,000 signup bonus granted to every newly-created workspace
 * (90-day expiry). The credit acts as a bridge allowing Free-tier users who
 * exceed their daily trace limit to continue using the product up to the
 * credit's JPY equivalent cost — before being forced to upgrade to Pro.
 *
 * Architecture:
 *   - Runtime balance lives in KV (Upstash Redis) — atomic decrement via incrby.
 *   - DB (`workspace_settings.signup_credit_jpy` / `signup_credit_expires_at`)
 *     holds the original grant for audit purposes. We do NOT mirror the balance
 *     back to DB on every decrement (would make hot-path writes expensive).
 *
 * Design decisions:
 *   - Grant is workspace-scoped, not user-scoped: this codebase has no
 *     standalone `users` table; a workspace is 1:1 with the signup email
 *     (see `src/auth/google.ts` -> `createWorkspace`). Granting per-workspace
 *     prevents trivial "create N workspaces" abuse because only the first
 *     workspace for an email gets a workspace created at all — subsequent
 *     logins reuse the existing mapping.
 *   - JPY integer only. No fractional yen. All USD → JPY conversion happens
 *     upstream via `src/chatbot/exchange-rate.ts::usdToJpy`.
 *   - No cron for expiry: expiry is checked lazily on every read.
 *     Expired credits are treated as zero but the DB row is preserved.
 */
import { kv } from '@vercel/kv';
import { getKnex } from '../storage/knex-client.js';
import { getWorkspaceKey } from '../storage/models.js';

/** Credit amount granted on signup (JPY, integer yen). */
export const SIGNUP_CREDIT_AMOUNT_JPY = 10_000;

/** Credit validity period (days). */
export const SIGNUP_CREDIT_VALIDITY_DAYS = 90;

/** KV key suffix for the mutable credit balance (integer yen). */
const CREDIT_BALANCE_SUFFIX = 'signup_credit:balance_jpy';

/** KV key suffix for the credit expiry ISO timestamp. */
const CREDIT_EXPIRES_SUFFIX = 'signup_credit:expires_at';

/** KV expiry for the balance key (days → seconds, with a 1-day grace period). */
const KV_TTL_SECONDS = (SIGNUP_CREDIT_VALIDITY_DAYS + 1) * 24 * 60 * 60;

function isKVAvailable(): boolean {
  const hasUrl = !!(process.env.KV_REST_API_URL || process.env.KV_URL);
  const hasToken = !!process.env.KV_REST_API_TOKEN;
  return hasUrl && hasToken;
}

/**
 * Current snapshot of the workspace's signup credit.
 */
export interface SignupCreditStatus {
  /** Current remaining balance in JPY (integer yen). Zero if expired or never granted. */
  balanceJpy: number;
  /** Original expiry ISO timestamp, or null if no credit was ever granted. */
  expiresAt: string | null;
  /** True iff balance > 0 AND expiresAt > now. */
  active: boolean;
}

/**
 * Grant the signup credit to a newly-created workspace.
 *
 * Idempotent-ish: if a credit was already granted (DB row has a non-null
 * `signup_credit_expires_at`) this is a no-op. This guards against the same
 * workspace being "re-granted" if `createWorkspace` is ever called twice.
 *
 * @returns true if a fresh credit was granted, false if one already existed.
 */
export async function grantSignupCredit(workspaceId: string): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SIGNUP_CREDIT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
  const expiresIso = expiresAt.toISOString();

  // 1. Persist the grant in DB (audit trail + source of truth).
  // If workspace_settings row already exists with a non-null expires_at,
  // skip — we never re-grant.
  try {
    const db = getKnex();
    const existing = await db('workspace_settings')
      .where({ workspace_id: workspaceId })
      .select('signup_credit_expires_at')
      .first();

    if (existing && existing.signup_credit_expires_at) {
      return false;
    }

    if (existing) {
      await db('workspace_settings')
        .where({ workspace_id: workspaceId })
        .update({
          signup_credit_jpy: SIGNUP_CREDIT_AMOUNT_JPY,
          signup_credit_expires_at: expiresIso,
        });
    } else {
      await db('workspace_settings').insert({
        workspace_id: workspaceId,
        signup_credit_jpy: SIGNUP_CREDIT_AMOUNT_JPY,
        signup_credit_expires_at: expiresIso,
      });
    }
  } catch (error) {
    // DB failure is non-fatal: we still try to write to KV so the user
    // gets the credit at runtime. But we log loudly.
    console.error('[SignupCredit] DB grant failed for workspace', workspaceId, error);
  }

  // 2. Write runtime balance + expiry to KV.
  if (isKVAvailable()) {
    try {
      const balanceKey = getWorkspaceKey(workspaceId, CREDIT_BALANCE_SUFFIX);
      const expiresKey = getWorkspaceKey(workspaceId, CREDIT_EXPIRES_SUFFIX);
      await kv.set(balanceKey, SIGNUP_CREDIT_AMOUNT_JPY, { ex: KV_TTL_SECONDS });
      await kv.set(expiresKey, expiresIso, { ex: KV_TTL_SECONDS });
    } catch (error) {
      console.error('[SignupCredit] KV grant failed for workspace', workspaceId, error);
    }
  }

  return true;
}

/**
 * Read the current credit status for a workspace.
 *
 * Lookup order: KV (hot) → DB (fallback). If the credit has expired
 * (expiresAt <= now), returns balanceJpy=0 regardless of stored value.
 * The stored DB row is not mutated on expiry — history is preserved.
 */
export async function getSignupCreditStatus(workspaceId: string): Promise<SignupCreditStatus> {
  const inactive: SignupCreditStatus = { balanceJpy: 0, expiresAt: null, active: false };

  // 1. Try KV.
  if (isKVAvailable()) {
    try {
      const balanceKey = getWorkspaceKey(workspaceId, CREDIT_BALANCE_SUFFIX);
      const expiresKey = getWorkspaceKey(workspaceId, CREDIT_EXPIRES_SUFFIX);
      const [rawBalance, rawExpires] = await Promise.all([
        kv.get<number | string>(balanceKey),
        kv.get<string>(expiresKey),
      ]);

      if (rawExpires) {
        const balance = typeof rawBalance === 'number' ? rawBalance : Number(rawBalance ?? 0);
        return buildStatus(balance, rawExpires);
      }
    } catch (error) {
      console.error('[SignupCredit] KV status fetch failed', error);
    }
  }

  // 2. Fall back to DB.
  try {
    const db = getKnex();
    const row = await db('workspace_settings')
      .where({ workspace_id: workspaceId })
      .select('signup_credit_jpy', 'signup_credit_expires_at')
      .first();

    if (!row || !row.signup_credit_expires_at) {
      return inactive;
    }

    const expiresIso =
      row.signup_credit_expires_at instanceof Date
        ? row.signup_credit_expires_at.toISOString()
        : String(row.signup_credit_expires_at);
    const balance = Number(row.signup_credit_jpy ?? 0);
    return buildStatus(balance, expiresIso);
  } catch (error) {
    console.error('[SignupCredit] DB status fetch failed', error);
    return inactive;
  }
}

function buildStatus(balanceJpy: number, expiresAtIso: string): SignupCreditStatus {
  const expiresAtMs = Date.parse(expiresAtIso);
  const isExpired = Number.isFinite(expiresAtMs) ? expiresAtMs <= Date.now() : true;
  const effectiveBalance = isExpired ? 0 : Math.max(0, Math.floor(balanceJpy));
  return {
    balanceJpy: effectiveBalance,
    expiresAt: expiresAtIso,
    active: !isExpired && effectiveBalance > 0,
  };
}

/**
 * Attempt to atomically consume `costJpy` from the workspace's signup credit.
 *
 * Returns:
 *   - `{ consumed: true,  remainingJpy: n }` on success (the caller should let the request proceed).
 *   - `{ consumed: false, remainingJpy: 0 }` if the credit is expired, unfunded, or insufficient.
 *
 * We use KV.decrby for atomic decrement. If the post-decrement balance would
 * go negative, we revert (incrby back). This preserves the invariant
 * "balance >= 0".
 */
export async function consumeSignupCredit(
  workspaceId: string,
  costJpy: number
): Promise<{ consumed: boolean; remainingJpy: number }> {
  if (!Number.isFinite(costJpy) || costJpy < 0) {
    return { consumed: false, remainingJpy: 0 };
  }

  // Zero-cost request: trivially consume, no KV work.
  if (costJpy === 0) {
    const status = await getSignupCreditStatus(workspaceId);
    return { consumed: status.active, remainingJpy: status.balanceJpy };
  }

  const status = await getSignupCreditStatus(workspaceId);
  if (!status.active || status.balanceJpy < costJpy) {
    return { consumed: false, remainingJpy: status.balanceJpy };
  }

  if (!isKVAvailable()) {
    // No atomic store available — best-effort DB decrement.
    try {
      const db = getKnex();
      const rowsAffected = await db('workspace_settings')
        .where({ workspace_id: workspaceId })
        .andWhere('signup_credit_jpy', '>=', costJpy)
        .andWhere('signup_credit_expires_at', '>', new Date())
        .decrement('signup_credit_jpy', costJpy);
      if (rowsAffected === 0) {
        return { consumed: false, remainingJpy: status.balanceJpy };
      }
      return { consumed: true, remainingJpy: status.balanceJpy - costJpy };
    } catch (error) {
      console.error('[SignupCredit] DB decrement failed', error);
      return { consumed: false, remainingJpy: status.balanceJpy };
    }
  }

  // Atomic KV decrement with rollback-on-negative.
  const balanceKey = getWorkspaceKey(workspaceId, CREDIT_BALANCE_SUFFIX);
  try {
    const roundedCost = Math.ceil(costJpy);
    const after = await kv.decrby(balanceKey, roundedCost);
    if (typeof after === 'number' && after < 0) {
      // Insufficient funds — revert.
      await kv.incrby(balanceKey, roundedCost);
      return { consumed: false, remainingJpy: Math.max(0, after + roundedCost) };
    }
    return { consumed: true, remainingJpy: Math.max(0, Number(after)) };
  } catch (error) {
    console.error('[SignupCredit] KV decrement failed', error);
    return { consumed: false, remainingJpy: status.balanceJpy };
  }
}
