import type { FastifyRequest, FastifyReply } from 'fastify';

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authEnabled = process.env.ENABLE_AUTH === 'true';

  if (!authEnabled) {
    return; // 認証無効の場合はスキップ
  }

  const apiKeys = process.env.API_KEYS?.split(',').map(k => k.trim()).filter(Boolean) || [];

  if (apiKeys.length === 0) {
    console.warn('ENABLE_AUTH is true but no API_KEYS configured. Allowing all requests.');
    return;
  }

  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.code(401).send({
      error: 'Missing Authorization header'
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!apiKeys.includes(token)) {
    return reply.code(401).send({
      error: 'Invalid API key'
    });
  }

  // 認証成功
}
