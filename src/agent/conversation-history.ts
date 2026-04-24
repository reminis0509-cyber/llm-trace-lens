/**
 * KV-backed conversation history for the Contract-Based AI Clerk Runtime.
 *
 * Purpose — the Web autonomous mode currently passes the full chat transcript
 * in a single UI-managed state object, but the LINE bot (and any other
 * stateless surface) sees each message in isolation. That caused severe
 * hallucinations: the Planner and ToolInputBuilder LLMs had no way to know
 * "this is a reply to the bot's earlier question about 宛先". Persisting a
 * short sliding window here closes the gap.
 *
 * Design:
 *   - Key  : `conv:history:{conversationId}`. Conversation IDs are opaque —
 *            the LINE bridge uses `lineUserId`, future surfaces could use
 *            any stable per-conversation identifier.
 *   - Value: JSON array of `LlmMessage` (role = user | assistant, no system).
 *   - TTL  : 24 hours. Long enough for a single user's session yet avoids
 *            ballooning KV storage on dormant conversations.
 *   - Cap  : last {@link MAX_HISTORY_TURNS} turns. Keeps Planner / Reviewer
 *            prompts bounded so token costs stay predictable.
 *
 * All operations silently no-op when KV isn't configured (local dev,
 * misconfigured Preview) — history is a nice-to-have; failing open is
 * strictly better than making the agent refuse the request.
 */
import { kv } from '@vercel/kv';
import type { LlmMessage } from '../routes/tools/_shared.js';

/** Sliding-window size — see module JSDoc for rationale. */
export const MAX_HISTORY_TURNS = 20;

/** TTL in seconds. 24h — long enough for a single session, short enough to prune dormant users. */
const HISTORY_TTL_SECONDS = 60 * 60 * 24;

/** The only roles we ever persist. `system` is injected per-call, never stored. */
export type StoredRole = 'user' | 'assistant';

/**
 * Mirror of `isKvAvailable()` in `src/kv/client.ts` and
 * `src/line/workspace-resolver.ts`. Duplicated to avoid a circular import.
 */
function isKvAvailable(): boolean {
  const hasUrl = Boolean(process.env.KV_REST_API_URL || process.env.KV_URL);
  const hasToken = Boolean(process.env.KV_REST_API_TOKEN);
  return hasUrl && hasToken;
}

function historyKey(conversationId: string): string {
  return `conv:history:${conversationId}`;
}

/**
 * Return the persisted past turns for a conversation, or an empty array if
 * KV is unavailable / the key is missing. Never throws.
 *
 * The returned array contains ONLY `{ role: user | assistant, content }`
 * messages — `system` prompts are the caller's responsibility to prepend.
 * The most recent up to {@link MAX_HISTORY_TURNS} turns are returned in
 * chronological order so they can be passed directly as `messages[]`.
 */
export async function loadConversationHistory(
  conversationId: string,
): Promise<LlmMessage[]> {
  if (!isKvAvailable() || !conversationId) return [];
  try {
    const raw = await kv.get<LlmMessage[]>(historyKey(conversationId));
    if (!Array.isArray(raw)) return [];
    // Defensive filter: reject malformed rows so one bad entry can't crash
    // the downstream LLM call.
    const filtered = raw.filter(
      (m): m is LlmMessage =>
        m !== null &&
        typeof m === 'object' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string',
    );
    return filtered.slice(-MAX_HISTORY_TURNS);
  } catch {
    return [];
  }
}

/**
 * Append a single turn to the persisted history.
 *
 * - `content` is trimmed — empty strings are skipped (no point storing them).
 * - Writes are bounded to {@link MAX_HISTORY_TURNS} after append (FIFO trim).
 * - TTL is reset on every write so actively-used conversations don't expire.
 * - Failures are swallowed.
 */
export async function appendConversationTurn(
  conversationId: string,
  role: StoredRole,
  content: string,
): Promise<void> {
  if (!isKvAvailable() || !conversationId) return;
  const trimmed = content.trim();
  if (!trimmed) return;
  try {
    const current = await loadConversationHistory(conversationId);
    const next: LlmMessage[] = [...current, { role, content: trimmed }].slice(
      -MAX_HISTORY_TURNS,
    );
    await kv.set(historyKey(conversationId), next, {
      ex: HISTORY_TTL_SECONDS,
    });
  } catch {
    // Non-fatal — see module JSDoc.
  }
}

/**
 * Forget everything for a conversation — exposed for test cleanup and future
 * "reset" commands from the user.
 */
export async function clearConversationHistory(
  conversationId: string,
): Promise<void> {
  if (!isKvAvailable() || !conversationId) return;
  try {
    await kv.del(historyKey(conversationId));
  } catch {
    // Non-fatal.
  }
}
