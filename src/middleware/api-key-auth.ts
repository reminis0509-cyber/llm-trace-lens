/**
 * middleware/api-key-auth.ts — External API key preHandler.
 *
 * Accepts `Authorization: Bearer fjk_<...>` on every `/api/external-api/v1/*`
 * request. On success, populates `request.user.email` with the owning user's
 * email so downstream routes behave identically to cookie/Supabase-auth'd
 * callers.
 *
 * SECURITY: this middleware NEVER reads `x-user-email` or any other client
 * header to establish identity.
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { findApiKeyByRaw, touchApiKey } from '../auth/api-key.js';

export async function apiKeyAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    reply.code(401).send({ success: false, error: 'API key required' });
    return;
  }
  const raw = header.slice(7).trim();
  if (raw.length < 10) {
    reply.code(401).send({ success: false, error: 'API key malformed' });
    return;
  }

  const key = await findApiKeyByRaw(raw);
  if (!key) {
    reply.code(401).send({ success: false, error: 'API key invalid or revoked' });
    return;
  }

  // Populate `request.user` so existing routes can share auth logic.
  (request as unknown as { user: { id: string; email: string } }).user = {
    id: key.user_id,
    email: key.user_id,
  };

  // Fire-and-forget last-used update.
  touchApiKey(key.id).catch(() => {
    // swallow — never fail a request on analytics write
  });
}
