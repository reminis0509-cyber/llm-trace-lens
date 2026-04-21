/**
 * routes/web-app-builder.ts — Web App Builder β endpoint.
 *
 * POST /api/agent/web-app-builder
 *   body: { spec: string, name?: string }
 *   resp: { success, data: WebAppBuilderOutput }
 *
 * Auth: session / Supabase JWT (same as rest of /api/agent/...).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildWebAppScaffold } from '../agent/web-app-builder.js';

const bodySchema = z.object({
  spec: z.string().min(5).max(8000),
  name: z.string().min(1).max(60).optional(),
});

export default async function webAppBuilderRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/agent/web-app-builder', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }

    try {
      const output = buildWebAppScaffold(parsed.data);
      return reply.send({ success: true, data: output });
    } catch (err) {
      request.log.error({ err }, '[web-app-builder] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });
}
