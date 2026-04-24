/**
 * KV-backed short-lived store for structured document data shown in LIFF.
 *
 * Problem — LINE can't render a PDF inline; the closest thing is a Flex
 * button that opens a URL. To keep the client-side PDF rendering path
 * (already in `packages/dashboard/src/lib/pdf/`), we stash the structured
 * document data (estimate / invoice / …) in KV under an unguessable short
 * id, then send the user a LIFF URL that carries that id. The LIFF page
 * fetches the data and renders PDF in the user's device — exactly the
 * same code path as the Web dashboard.
 *
 * Security — the `shortId` is 24 random base64url characters (144 bits of
 * entropy). Combined with a 1-hour TTL, brute-force enumeration is not a
 * practical risk even without per-user auth. The LIFF endpoint additionally
 * scopes reads by workspaceId so a leaked token only exposes the one
 * document it was minted for.
 *
 * Failure modes — all helpers silently no-op when KV is unavailable so
 * that a transient KV outage degrades the LINE bridge to "no PDF button,
 * just Markdown reply" rather than crashing the whole run.
 */
import { kv } from '@vercel/kv';
import crypto from 'crypto';

/** 1-hour TTL. Long enough that the user can tap the button on their phone,
 * short enough that KV storage cost stays bounded at any traffic level. */
const DOC_TTL_SECONDS = 60 * 60;

/** Random id length — 18 bytes → 24 base64url characters. 144 bits of entropy
 * is sufficient for a 1-hour unguessable token even under aggressive brute
 * force (2^144 guesses at 1M rps ≈ 7e29 years). */
const DOC_ID_BYTES = 18;

/** Document types that the LIFF PDF page knows how to render. Must stay in
 * sync with the switch in `AiClerkChat.generateDocumentPdf`. */
export type LiffDocType =
  | 'estimate'
  | 'invoice'
  | 'delivery-note'
  | 'purchase-order'
  | 'cover-letter';

/** Shape persisted in KV. `data` is the structured payload the PDF modules
 * consume; `issuer` is the `IssuerInfo` (company info) used in the header. */
export interface LiffDocRecord {
  type: LiffDocType;
  data: Record<string, unknown>;
  issuer: Record<string, unknown>;
  /** Used for authorisation hardening if we ever add user-scoped reads. */
  workspaceId: string;
  createdAt: number;
}

/** KV availability probe — duplicated here to avoid a circular import. */
function isKvAvailable(): boolean {
  const hasUrl = Boolean(process.env.KV_REST_API_URL || process.env.KV_URL);
  const hasToken = Boolean(process.env.KV_REST_API_TOKEN);
  return hasUrl && hasToken;
}

function docKey(shortId: string): string {
  return `line:doc:${shortId}`;
}

/**
 * Mint a random 24-character base64url id. Exported for tests.
 * Separated from persistence so the id format can be asserted in isolation.
 */
export function mintDocShortId(): string {
  return crypto
    .randomBytes(DOC_ID_BYTES)
    .toString('base64url');
}

/**
 * Persist document data and return the short id the LIFF button should
 * carry. Returns null when KV is unavailable — caller should fall back
 * to sending a text-only reply.
 */
export async function saveDocForLiff(
  record: Omit<LiffDocRecord, 'createdAt'>,
): Promise<string | null> {
  if (!isKvAvailable()) return null;
  const shortId = mintDocShortId();
  const payload: LiffDocRecord = {
    ...record,
    createdAt: Date.now(),
  };
  try {
    await kv.set(docKey(shortId), payload, { ex: DOC_TTL_SECONDS });
    return shortId;
  } catch {
    return null;
  }
}

/**
 * Fetch previously stored data. Returns null on missing / expired / KV
 * unavailable. The API endpoint that calls this is responsible for
 * returning the right HTTP status to the LIFF client.
 */
export async function loadDocForLiff(
  shortId: string,
): Promise<LiffDocRecord | null> {
  if (!isKvAvailable() || !shortId) return null;
  try {
    const raw = await kv.get<LiffDocRecord>(docKey(shortId));
    if (!raw || typeof raw !== 'object' || !('type' in raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * Early deletion hook — useful for "delete after download" flows in the
 * future. Currently unused; TTL handles the common case.
 */
export async function deleteDocForLiff(shortId: string): Promise<void> {
  if (!isKvAvailable() || !shortId) return;
  try {
    await kv.del(docKey(shortId));
  } catch {
    // Non-fatal.
  }
}
