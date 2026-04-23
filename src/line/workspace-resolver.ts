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
    return { workspaceId: workspace.id, isNew: true };
  } catch {
    return null;
  }
}
