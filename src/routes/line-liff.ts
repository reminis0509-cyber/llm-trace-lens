/**
 * LIFF-facing API routes for LINE-originated document rendering.
 *
 * Only one endpoint for now:
 *
 *   GET /api/line/liff-doc/:shortId
 *     → returns `{ type, data, issuer, createdAt }` so the LIFF page can
 *       reuse `packages/dashboard/src/lib/pdf/` to render the PDF on the
 *       user's device. Token is a 24-char base64url id minted by
 *       `saveDocForLiff()` with 1-hour TTL. 404 on miss / expiry.
 *
 * Intentionally does NOT require workspace authentication — the unguessable
 * token IS the capability. LIFF apps running inside the LINE in-app browser
 * cannot reliably carry dashboard auth cookies, so a capability-based token
 * design is the simplest scheme that works end-to-end.
 *
 * Rate limit isn't added here because KV TTL keeps the attack window short
 * and the endpoint returns pure JSON (no PDF render, no LLM call). If
 * abuse shows up in logs, tighten it then.
 */
import type { FastifyInstance } from 'fastify';
import { loadDocForLiff } from '../line/doc-store.js';

export default async function lineLiffRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.get<{ Params: { shortId: string } }>(
    '/api/line/liff-doc/:shortId',
    async (request, reply) => {
      const shortId = request.params.shortId;
      // Fail-fast shape check so obviously malformed ids don't hit KV.
      if (!shortId || !/^[A-Za-z0-9_-]{20,32}$/.test(shortId)) {
        return reply
          .code(400)
          .send({ success: false, error: 'invalid shortId' });
      }

      const record = await loadDocForLiff(shortId);
      if (!record) {
        return reply.code(404).send({
          success: false,
          error: 'document not found or expired (max 1 hour)',
        });
      }

      return reply.send({
        success: true,
        data: {
          type: record.type,
          data: record.data,
          issuer: record.issuer,
          createdAt: record.createdAt,
        },
      });
    },
  );
}
