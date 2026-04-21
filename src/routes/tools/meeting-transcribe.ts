/**
 * routes/tools/meeting-transcribe.ts — AI 社員 v2.1 Voice-to-minutes endpoint.
 *
 * POST /api/tools/meeting-transcribe
 *   body: {
 *     audioBase64: string,
 *     audioFormat: 'mp3'|'wav'|'m4a',
 *     language?: string  // ISO-639-1, default 'ja'
 *   }
 *   resp: { success, data: { transcript, minutes } }
 *
 * Size cap: 25 MB decoded (Whisper API limit).
 *
 * Auth: session / Supabase JWT.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { transcribeMeeting } from '../../agent/meeting-transcriber.js';

const bodySchema = z.object({
  audioBase64: z.string().min(1).max(40_000_000), // base64 overhead ~1.37x
  audioFormat: z.enum(['mp3', 'wav', 'm4a']),
  language: z
    .string()
    .regex(/^[a-z]{2}$/i, 'language must be ISO-639-1')
    .optional(),
});

const MAX_DECODED_BYTES = 25 * 1024 * 1024;

export default async function meetingTranscribeRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/tools/meeting-transcribe', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }

    const approxBytes = Math.floor((parsed.data.audioBase64.length * 3) / 4);
    if (approxBytes > MAX_DECODED_BYTES) {
      return reply.code(400).send({
        success: false,
        error: `音声ファイルのサイズが上限(25MB)を超えています。`,
      });
    }

    try {
      const output = await transcribeMeeting(fastify, parsed.data);
      return reply.send({ success: true, data: output });
    } catch (err) {
      request.log.error({ err }, '[meeting-transcribe] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });
}
