/**
 * routes/api-keys.ts — user-facing API key management.
 *
 * Endpoints (auth via session / Supabase JWT — the same auth the dashboard uses):
 *   POST   /api/api-keys            body: { name }
 *     → 201 { success, data: { apiKey: { id, name, prefix, secret, createdAt } } }
 *     The `secret` field is returned exactly once.
 *   GET    /api/api-keys            → list (never includes secret)
 *   DELETE /api/api-keys/:id        → revoke
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { listApiKeys, mintApiKey, revokeApiKey, rowToPublic } from '../auth/api-key.js';

const createSchema = z.object({ name: z.string().min(1).max(200) });

export default async function apiKeyRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/api-keys', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }

    try {
      const minted = await mintApiKey({ userId: userEmail, name: parsed.data.name });
      return reply.code(201).send({ success: true, data: { apiKey: minted } });
    } catch (err) {
      request.log.error({ err }, '[api-keys POST] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });

  fastify.get('/api/api-keys', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });
    try {
      const rows = await listApiKeys(userEmail);
      return reply.send({ success: true, data: { apiKeys: rows.map(rowToPublic) } });
    } catch (err) {
      request.log.error({ err }, '[api-keys GET] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });

  fastify.delete<{ Params: { id: string } }>(
    '/api/api-keys/:id',
    async (request, reply) => {
      const userEmail = request.user?.email;
      if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });
      try {
        const ok = await revokeApiKey(userEmail, request.params.id);
        if (!ok) return reply.code(404).send({ success: false, error: 'not found' });
        return reply.send({ success: true });
      } catch (err) {
        request.log.error({ err }, '[api-keys DELETE] failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );
}
