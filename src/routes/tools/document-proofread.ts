/**
 * routes/tools/document-proofread.ts — AI 社員 v2.1 Japanese proofreader.
 *
 * POST /api/tools/document-proofread
 *   body: {
 *     text: string,
 *     style: 'business'|'casual'|'formal',
 *     checkLevel: 'light'|'strict'
 *   }
 *   resp: { success, data: { corrections, corrected, summary } }
 *
 * Size cap: 100 KB text (UTF-8). Larger documents should be split by the
 * caller; we reject rather than silently truncate so the output is faithful.
 *
 * Auth: session / Supabase JWT.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { proofreadDocument } from '../../agent/document-proofreader.js';

const bodySchema = z.object({
  text: z.string().min(1).max(200_000),
  style: z.enum(['business', 'casual', 'formal']),
  checkLevel: z.enum(['light', 'strict']),
});

const MAX_TEXT_BYTES = 100 * 1024;

export default async function documentProofreadRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/tools/document-proofread', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }

    const byteLength = Buffer.byteLength(parsed.data.text, 'utf8');
    if (byteLength > MAX_TEXT_BYTES) {
      return reply.code(400).send({
        success: false,
        error: `テキストが上限(100KB)を超えています。`,
      });
    }

    try {
      const output = await proofreadDocument(fastify, parsed.data);
      return reply.send({ success: true, data: output });
    } catch (err) {
      request.log.error({ err }, '[document-proofread] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });
}
