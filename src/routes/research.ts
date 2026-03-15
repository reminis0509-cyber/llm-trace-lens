/**
 * Research Agent Routes
 * Public SSE endpoint for the research agent demo.
 * Streams agent step updates as Server-Sent Events.
 *
 * POST /api/research
 * Request:  { topic: string (2-200 chars) }
 * Response: SSE stream with events:
 *   - { type: "step", step: AgentStep }
 *   - { type: "report", report: ResearchReport }
 *   - { type: "done" }
 *   - { type: "error", message: string }
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { runResearchAgent } from '../agent/index.js';
import type { AgentStep } from '../agent/types.js';

const requestSchema = z.object({
  topic: z.string().min(2).max(200),
});

export async function researchRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/research
   * Public research agent endpoint.
   * Rate limited to 3 requests per hour per IP.
   */
  fastify.post('/api/research', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 hour',
        keyGenerator: (request: FastifyRequest) => request.ip,
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = requestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        message: 'トピックは2〜200文字で入力してください',
      });
    }

    const { topic } = parseResult.data;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return reply.code(503).send({
        error: 'Service unavailable',
        message: 'リサーチエージェントは現在利用できません',
      });
    }

    // SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendEvent = (data: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const onStepUpdate = (step: AgentStep) => {
      sendEvent({ type: 'step', step });
    };

    try {
      const report = await runResearchAgent(fastify, { topic }, onStepUpdate, apiKey);
      sendEvent({ type: 'report', report });
      sendEvent({ type: 'done' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Research failed';
      request.log.error({ err }, '[Research] Agent execution error');
      sendEvent({ type: 'error', message });
    }

    reply.raw.end();
  });
}

export default researchRoutes;
