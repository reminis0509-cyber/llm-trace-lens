/**
 * routes/wide-research.ts — Wide Research endpoint.
 *
 * POST /api/research/wide
 *   body: { query: string, sources?: string[] }
 *   resp: SSE stream of `WideResearchSseEvent` + final `data: [DONE]`
 *
 * Pro-plan gate mirrors the contract-chat route: Wide Research is strictly
 * Pro-and-above because of the wall-clock budget.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { runWideResearch } from '../agent/wide-research.js';
import { isFreePlan, resolveWorkspaceId } from './tools/_shared.js';

const bodySchema = z.object({
  query: z.string().min(2).max(1000),
  sources: z.array(z.string().url()).max(10).optional(),
});

export default async function wideResearchRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/research/wide', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) {
      return reply.code(401).send({ success: false, error: '認証が必要です' });
    }

    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) {
      return reply.code(401).send({ success: false, error: 'ワークスペース未解決' });
    }

    if (await isFreePlan(workspaceId)) {
      return reply.code(403).send({
        success: false,
        error: 'Wide Research は Pro プラン以上でご利用いただけます',
      });
    }

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    try {
      for await (const event of runWideResearch({
        query: parsed.data.query,
        sources: parsed.data.sources,
        userId: userEmail,
        workspaceId,
      })) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      request.log.error({ err }, 'wide-research failed');
      reply.raw.write(
        `data: ${JSON.stringify({ type: 'error', code: 'INTERNAL', message: err instanceof Error ? err.message : 'unknown' })}\n\n`,
      );
    } finally {
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    }
    return reply;
  });
}
