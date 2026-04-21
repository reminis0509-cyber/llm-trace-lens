/**
 * routes/tools/excel-analyze.ts — AI 社員 v2.1 Excel analysis endpoint.
 *
 * POST /api/tools/excel-analyze
 *   body: { fileBase64: string, sheetName?: string, question: string }
 *   resp: { success, data: ExcelAnalyzerOutput }
 *
 * Size cap: 10 MB (approx base64-decoded). Enforced pre-parse so an oversized
 * payload never reaches the xlsx parser.
 *
 * Auth: session / Supabase JWT (standard AI Employee path).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { analyzeExcel } from '../../agent/excel-analyzer.js';

const bodySchema = z.object({
  fileBase64: z.string().min(1).max(15_000_000), // base64 overhead ~1.37x
  sheetName: z.string().max(200).optional(),
  question: z.string().min(2).max(2000),
});

const MAX_DECODED_BYTES = 10 * 1024 * 1024;

export default async function excelAnalyzeRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/tools/excel-analyze', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }

    const approxBytes = Math.floor((parsed.data.fileBase64.length * 3) / 4);
    if (approxBytes > MAX_DECODED_BYTES) {
      return reply.code(400).send({
        success: false,
        error: `ファイルサイズが上限(10MB)を超えています。`,
      });
    }

    try {
      const output = await analyzeExcel(fastify, parsed.data);
      return reply.send({ success: true, data: output });
    } catch (err) {
      request.log.error({ err }, '[excel-analyze] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });
}
