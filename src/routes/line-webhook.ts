/**
 * POST /webhook/line — LINE Messaging API webhook.
 *
 * Request:
 *   - Method: POST
 *   - Headers: `X-Line-Signature` (base64 HMAC-SHA256 of raw body keyed by
 *     LINE_CHANNEL_SECRET).
 *   - Body:   `CallbackRequest` JSON — `{ destination, events: Event[] }`.
 *
 * Response:
 *   - 200 OK immediately on valid signature (processing is async so LINE's
 *     10-second delivery timeout cannot double-deliver).
 *   - 401 on invalid / missing signature.
 *   - 503 if LINE integration is not configured (all three env vars unset).
 *
 * Async dispatch strategy:
 *   On Vercel serverless, the function execution context is torn down the
 *   moment the HTTP response flushes. A bare `setImmediate(...)` therefore
 *   silently drops `dispatchLineEvents`, `replyLineMessage`, and the
 *   Contract Agent run — which is exactly the bug we hit 2026-04-23 (friend
 *   follow ACK never delivered, message replies never sent).
 *
 *   The fix is `waitUntil` from `@vercel/functions`: it registers a Promise
 *   with the platform so the function instance stays alive until the Promise
 *   settles, while still letting us return 200 OK to LINE immediately (LINE
 *   retries on anything other than 2xx within 10s, so we MUST respond fast).
 *
 *   On non-Vercel runtimes (local `npm run dev`, Node test runner) `waitUntil`
 *   is a no-op that merely invokes the Promise — which is the correct
 *   behaviour there because the Node event loop naturally keeps the process
 *   alive until all Promises settle.
 *
 *   Fallback (unused as of 2026-04-23): if `waitUntil` ever fails to keep the
 *   function alive, split the heavy work into a second internal endpoint
 *   (e.g. POST /api/internal/line-heavy-task) and fire it via `void fetch(...)`
 *   from the webhook with an internal-secret header. The second endpoint then
 *   awaits the full pipeline and only returns 200 after completion. This was
 *   considered and rejected in favour of `waitUntil` for simplicity.
 */
import type { FastifyInstance } from 'fastify';
import { validateSignature } from '@line/bot-sdk';
import type { webhook as lineWebhook } from '@line/bot-sdk';
import { waitUntil } from '@vercel/functions';
import { lineConfig } from '../config.js';
import { dispatchLineEvents } from '../line/event-handler.js';

/**
 * Type-narrowing guard: a CallbackRequest has `events: Event[]`.
 */
function isCallbackRequest(value: unknown): value is lineWebhook.CallbackRequest {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.events);
}

export default async function lineWebhookRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  if (!lineConfig.enabled) {
    fastify.log.warn(
      '[LINE] Integration disabled — missing one or more of LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN / LINE_LIFF_ID',
    );
  }

  fastify.post('/webhook/line', async (request, reply) => {
    // ── Feature-flag gate ───────────────────────────────────────────────
    if (!lineConfig.enabled || !lineConfig.channelSecret) {
      return reply
        .code(503)
        .send({ success: false, error: 'LINE integration not configured' });
    }

    // ── Signature verification (HMAC-SHA256) ────────────────────────────
    const signature = request.headers['x-line-signature'];
    const signatureStr = typeof signature === 'string' ? signature : '';
    const rawBody = (request as unknown as { rawBody?: string | Buffer }).rawBody;
    if (!rawBody) {
      request.log.warn('[LINE] rawBody missing — check contentTypeParser');
      return reply.code(401).send({ success: false, error: 'Invalid signature' });
    }

    let valid = false;
    try {
      valid = validateSignature(
        typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8'),
        lineConfig.channelSecret,
        signatureStr,
      );
    } catch {
      valid = false;
    }
    if (!valid) {
      return reply.code(401).send({ success: false, error: 'Invalid signature' });
    }

    // ── Parse body ──────────────────────────────────────────────────────
    const body = request.body;
    if (!isCallbackRequest(body)) {
      // Empty `events: []` is valid (LINE verification ping).
      return reply.code(200).send({ success: true });
    }

    // ── 200 OK first, process later ─────────────────────────────────────
    // LINE retries on anything other than 2xx, so we absolutely must reply
    // before kicking off the LLM / tool work. `waitUntil` keeps the Vercel
    // serverless instance alive until the dispatch Promise settles, which
    // `setImmediate` cannot guarantee (see module docstring above).
    waitUntil(
      dispatchLineEvents(fastify, body.events).catch((err: unknown) => {
        fastify.log.error({ err }, '[LINE] dispatchLineEvents crashed');
      }),
    );

    return reply.code(200).send({ success: true });
  });
}
