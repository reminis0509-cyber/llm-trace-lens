/**
 * routes/slide-builder.ts — AI 社員 v2.1 Slide Builder endpoint.
 *
 * POST /api/agent/slide-builder
 *   body: { topic: string, audience?: string, slideCount?: number, style?: 'business'|'casual'|'pitch' }
 *   resp: { success, data: { marp, html, pptxBase64, slideCount, warnings } }
 *
 * Backward-compat alias:
 *   POST /api/agent/web-app-builder  (deprecated — logs a warning, delegates
 *   to the same handler so existing frontend builds keep working during the
 *   rollout. Will be removed once the dashboard ships the rename.)
 *
 * Auth: session / Supabase JWT (same pattern as rest of /api/agent/...).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { buildSlidePresentation } from '../agent/slide-builder.js';

const bodySchema = z.object({
  topic: z.string().min(2).max(1000),
  audience: z.string().max(200).optional(),
  slideCount: z.number().int().min(3).max(20).optional(),
  style: z.enum(['business', 'casual', 'pitch']).optional(),
});

async function handleBuild(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userEmail = request.user?.email;
  if (!userEmail) {
    reply.code(401).send({ success: false, error: '認証が必要です' });
    return;
  }

  const parsed = bodySchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400).send({
      success: false,
      error: parsed.error.issues.map((i) => i.message).join('; '),
    });
    return;
  }

  try {
    const output = await buildSlidePresentation(fastify, parsed.data);
    reply.send({ success: true, data: output });
  } catch (err) {
    request.log.error({ err }, '[slide-builder] build failed');
    reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
  }
}

export default async function slideBuilderRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/agent/slide-builder', async (request, reply) => {
    await handleBuild(fastify, request, reply);
  });

  // Deprecated alias — keep the old path alive so the dashboard does not 404
  // while the rename ships. Log a warning per call so we can watch telemetry
  // and retire the route once traffic goes to zero.
  fastify.post('/api/agent/web-app-builder', async (request, reply) => {
    request.log.warn(
      '[slide-builder] /api/agent/web-app-builder is deprecated; use /api/agent/slide-builder',
    );
    await handleBuild(fastify, request, reply);
  });
}
