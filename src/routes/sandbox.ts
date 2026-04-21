/**
 * routes/sandbox.ts — VM sandbox endpoints (dev-only guard).
 *
 * Endpoint:
 *   POST /api/sandbox/run
 *     body: { code: string, language?: 'python' | 'node' }
 *     resp: { success, data: { stdout, stderr, result, error? } }
 *
 * Guard: `SANDBOX_ENABLED` must be set to `1` or `true`. Absent the env
 * var the endpoint returns 501. This prevents accidental exposure of
 * arbitrary-code-execution on production before real VM sandboxing is
 * hardened.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getSandboxClient } from '../sandbox/e2b-client.js';

const runSchema = z.object({
  code: z.string().min(1).max(50_000),
  language: z.enum(['python', 'node']).optional(),
});

function isSandboxEnabled(): boolean {
  const v = process.env.SANDBOX_ENABLED;
  return v === '1' || v === 'true';
}

export default async function sandboxRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/sandbox/run', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

    if (!isSandboxEnabled()) {
      return reply.code(501).send({
        success: false,
        error: 'sandbox is disabled (set SANDBOX_ENABLED=1 in development to enable)',
      });
    }

    const parsed = runSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }

    try {
      const client = getSandboxClient();
      const result = await client.run(parsed.data.code, parsed.data.language ?? 'python');
      return reply.send({ success: true, data: result });
    } catch (err) {
      request.log.error({ err }, '[sandbox] run failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });
}
