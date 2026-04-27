/**
 * POST /api/agent/capi-bucho-comment
 *
 * Web 版カピぶちょー応答生成エンドポイント (戦略 doc Section 18.2.L)。
 *
 * AiClerkChat (Web) が AI 本体応答を表示した後にこのエンドポイントを呼び、
 * 関西弁のフキダシを 2 メッセージ目として表示する。LINE と同じ
 * `generateCapiBuchoCommentWithMeta` を共有することで「2 キャラ並走モデル」
 * (Section 7.3) の口調混在禁止ルール (Section 19.5) を Web でも徹底する。
 *
 * Request:
 *   {
 *     userMessage: string,                  // ユーザーの直近メッセージ (1..2000)
 *     aiResponse: string,                   // AI 本体の応答 (1..10000)
 *     context?: Record<string, unknown>     // 任意の追加コンテキスト (現状は未使用)
 *   }
 *
 * Response (200):
 *   {
 *     success: true,
 *     data: {
 *       comment: string | null,             // null なら吹き出し非表示
 *       tokensUsed?: number                 // 任意のメタ情報 (LLM 課金把握用)
 *     }
 *   }
 *
 * Auth: workspace required (resolveWorkspaceId、Issue #1 に従い x-user-email
 *       単独は信用しない)。Body の `workspaceId` は受け付けない。
 *       認証無し → 401。
 *
 * Rate limit: 60 req / hour / workspace。LINE と異なり 1 ターンに 1 回だけ
 *             呼ぶ想定なので AI 本体 (`/api/agent/chat` 20/h) よりは緩めに
 *             設定するが、無制限にはしない (LLM コスト保護)。
 *
 * Trace: 内部の generateCapiBuchoCore が recordLlmTrace を呼ぶので、
 *        ここで追加の trace 記録は不要。
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { resolveWorkspaceId } from '../tools/_shared.js';
import { generateCapiBuchoCommentWithMeta } from '../../line/capi-bucho.js';

const requestSchema = z.object({
  userMessage: z
    .string()
    .min(1, 'userMessage を入力してください')
    .max(2000, 'userMessage は2000文字以内にしてください'),
  aiResponse: z
    .string()
    .min(1, 'aiResponse を入力してください')
    .max(10000, 'aiResponse は10000文字以内にしてください'),
  // 将来拡張用。現状は使わないが Body 検証段階で reject しないように受け付ける。
  context: z.record(z.unknown()).optional(),
});

export default async function capiBuchoCommentRoute(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.post(
    '/api/agent/capi-bucho-comment',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 hour',
          keyGenerator: async (request: FastifyRequest) => {
            const workspaceId = await resolveWorkspaceId(request);
            return workspaceId
              ? `capi-bucho:ws:${workspaceId}`
              : `capi-bucho:ip:${request.ip}`;
          },
          errorResponseBuilder: () => ({
            success: false,
            error: 'リクエスト制限を超えました。しばらくお待ちください。',
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        // 1. Auth — workspaceId は header / session 由来のみ信用する。
        //    Body の workspaceId は受け付けない (Issue #1 IDOR 対策の継承)。
        const workspaceId = await resolveWorkspaceId(request);
        if (!workspaceId) {
          return reply
            .code(401)
            .send({ success: false, error: '認証が必要です' });
        }

        // 2. Input validation。
        const parsed = requestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            error: parsed.error.issues.map((i) => i.message).join('; '),
          });
        }
        const { userMessage, aiResponse } = parsed.data;

        // 3. カピぶちょー LLM 呼び出し。Web には journey の概念が無いので
        //    journeyStep は指定しない (= 確率判定 + 感情語判定で決まる)。
        const result = await generateCapiBuchoCommentWithMeta(
          fastify,
          workspaceId,
          {
            userMessage,
            aiResponse,
          },
        );

        // 4. レスポンス。tokensUsed は数値が取れた時だけ含める (任意フィールド)。
        return reply.code(200).send({
          success: true,
          data: {
            comment: result.comment,
            ...(result.tokensUsed !== null
              ? { tokensUsed: result.tokensUsed }
              : {}),
          },
        });
      } catch (error: unknown) {
        request.log.error(error, 'capi-bucho-comment route failed');
        return reply.code(500).send({
          success: false,
          error: '内部エラーが発生しました。しばらくしてからお試しください。',
        });
      }
    },
  );
}
