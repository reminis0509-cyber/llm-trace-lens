/**
 * LINE user_id ↔ FujiTrace workspace resolver.
 *
 * The LINE Official Account (`FujiTrace`) is the first surface on which a
 * Monday-demo lead interacts with the product. We need to associate each
 * `lineUserId` (matching `U[0-9a-f]{32}`) with a workspace so that
 * `executeContractAgent` can dispatch tools and Free / Pro plan logic can
 * apply as usual.
 *
 * Rules:
 *   1. If KV is unavailable, we return `null` — no silent fallback to the
 *      `default` workspace (QA finding H-1 — cross-contamination).
 *   2. On first contact for a lineUserId we create a new workspace via
 *      the canonical `createWorkspace()` helper, which auto-enrols the
 *      workspace in a 30-day Pro trial and grants the ¥10,000 / 90-day
 *      signup credit.
 *   3. We also populate the `workspace_users` table with a pseudo email
 *      `line_{lineUserId}@fujitrace.internal`, which lets the existing
 *      `/api/tools/*` and `/api/agent/*` middlewares (which look up
 *      workspace via `x-user-email`) work without any further changes.
 *   4. We never mutate an existing mapping — repeat visitors always get
 *      the workspace that was created for them on their very first event.
 */
import { kv } from '@vercel/kv';
import { createWorkspace } from '../kv/client.js';
import { getKnex } from '../storage/knex-client.js';
import { ensureAiToolsTables } from '../routes/tools/_shared.js';
import { randomUUID } from 'crypto';

/** KV key for the `lineUserId → workspaceId` mapping. */
function getLineWorkspaceKey(lineUserId: string): string {
  return `user:line:${lineUserId}:workspace`;
}

/** Pseudo email used to register a LINE user in `workspace_users`. */
export function buildLinePseudoEmail(lineUserId: string): string {
  return `line_${lineUserId}@fujitrace.internal`;
}

/** KV availability probe — mirrors the helper inside `src/kv/client.ts`. */
function isKvAvailable(): boolean {
  const hasUrl = Boolean(process.env.KV_REST_API_URL || process.env.KV_URL);
  const hasToken = Boolean(process.env.KV_REST_API_TOKEN);
  return hasUrl && hasToken;
}

/**
 * Ensure a row exists in `workspace_users` so that the default email-based
 * workspace resolver (`resolveWorkspaceId` in `src/routes/tools/_shared.ts`)
 * can map the pseudo email back to the workspace.
 *
 * Errors here are non-fatal — the LINE flow can still reply via the
 * in-memory mapping; the DB row is a convenience for cross-process calls
 * (e.g. `fastify.inject('/api/tools/estimate/create')`).
 */
async function ensureWorkspaceUserRow(
  workspaceId: string,
  email: string,
): Promise<void> {
  try {
    const db = getKnex();
    const existing = await db('workspace_users')
      .where({ workspace_id: workspaceId, email: email.toLowerCase() })
      .first();
    if (existing) return;
    await db('workspace_users').insert({
      id: randomUUID(),
      workspace_id: workspaceId,
      email: email.toLowerCase(),
      role: 'owner',
      invited_by: null,
      created_at: new Date(),
    });
  } catch {
    // Non-fatal — see JSDoc.
  }
}

/**
 * Seed a placeholder `user_business_info` row for a brand-new LINE workspace.
 *
 * Background: the dashboard forces a 会社基本情報モーダル on first login, so
 * every Web workspace has at least one row in `user_business_info`. LINE has
 * no such modal, so `loadCompanyInfo()` in `chat-bridge.ts` returns
 * `undefined` and the Contract Runtime's `buildToolInput` LLM produces an
 * empty `business_info_id` — which then fails the `z.string().min(1)` check
 * in `/api/tools/estimate/create` with HTTP 400, surfacing to the user as
 * "申し訳ありません、もう一度お試しください。".
 *
 * Seeding a placeholder row guarantees that `business_info_id` is always
 * non-empty for LINE-origin workspaces. The user can later overwrite it
 * through the dashboard (the UPSERT by `workspace_id + created_at asc`
 * already picks the oldest row, so late edits win via the update path —
 * see `src/routes/tools/business-info.ts`).
 *
 * All errors are swallowed — if the insert fails (missing table, race on
 * simultaneous first message, etc.) the agent still runs; the only cost is
 * that the user sees a slightly less helpful estimate draft.
 *
 * Column names MUST match `migrations/010_add_ai_tools.ts` exactly:
 *   id, workspace_id, company_name, address, phone, email, invoice_number,
 *   bank_name, bank_branch, account_type, account_number, account_holder,
 *   created_at, updated_at.
 */
async function ensureDefaultBusinessInfo(
  workspaceId: string,
  lineUserId: string,
): Promise<void> {
  try {
    await ensureAiToolsTables();
    const db = getKnex();
    const existing = await db('user_business_info')
      .where({ workspace_id: workspaceId })
      .first();
    if (existing) return;
    const now = new Date();
    await db('user_business_info').insert({
      id: randomUUID(),
      workspace_id: workspaceId,
      company_name: 'デモユーザー',
      address: '',
      phone: '',
      email: buildLinePseudoEmail(lineUserId),
      invoice_number: null,
      bank_name: null,
      bank_branch: null,
      account_type: null,
      account_number: null,
      account_holder: null,
      created_at: now,
      updated_at: now,
    });
  } catch {
    // Non-fatal — agent can still run without this row, it will just
    // surface as an empty-company-info fallback downstream.
  }
}

/**
 * Return an existing workspace id for the LINE user, or create a brand new
 * one (with 30-day Pro trial + signup credit) on first contact.
 *
 * Returns `null` only when KV is unavailable, in which case the caller
 * should surface a friendly "LINE連携が未設定です" message.
 */
export async function resolveLineWorkspace(
  lineUserId: string,
): Promise<{ workspaceId: string; isNew: boolean } | null> {
  if (!isKvAvailable()) {
    return null;
  }

  const key = getLineWorkspaceKey(lineUserId);

  try {
    const existing = await kv.get<string>(key);
    if (existing) {
      // Defence in depth: re-assert the pseudo email row exists. The DB
      // could have been reset in a dev environment while KV still holds
      // the mapping.
      await ensureWorkspaceUserRow(existing, buildLinePseudoEmail(lineUserId));
      return { workspaceId: existing, isNew: false };
    }

    // First contact — mint a workspace using the canonical helper.
    // Pro trial + signup credit are handled inside createWorkspace().
    const workspace = await createWorkspace(`LINE ${lineUserId.slice(0, 8)}`);
    await kv.set(key, workspace.id);
    await ensureWorkspaceUserRow(workspace.id, buildLinePseudoEmail(lineUserId));
    // Seed a placeholder user_business_info row so that the Contract
    // Runtime's tool-input-builder LLM always has a non-empty
    // `business_info_id` to pass to `/api/tools/estimate/create`.
    // Non-fatal on failure — see helper JSDoc.
    await ensureDefaultBusinessInfo(workspace.id, lineUserId);
    return { workspaceId: workspace.id, isNew: true };
  } catch {
    return null;
  }
}
