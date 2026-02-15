/**
 * Input Validation Middleware
 * リクエストボディの入力値をサニタイズチェックする防御層
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { validateObject, isValidWorkspaceId } from '../utils/sanitize.js';

/** バリデーション対象のパスパターン */
const VALIDATION_PATHS = [
  '/v1/chat/completions',
  '/api/',
  '/admin/',
];

/** リクエストボディの最大サイズ (bytes) */
const MAX_BODY_SIZE = 1024 * 1024; // 1MB

/**
 * 入力バリデーションミドルウェア
 * SQLインジェクション・XSSパターンの検出
 */
export async function inputValidationMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // バリデーション対象のパスのみチェック
  const requiresValidation = VALIDATION_PATHS.some(path => request.url.startsWith(path));
  if (!requiresValidation) {
    return;
  }

  // POSTリクエストのボディをチェック
  if (request.body && typeof request.body === 'object') {
    const result = validateObject(request.body as Record<string, unknown>);
    if (!result.safe) {
      console.warn(`[InputValidation] 危険な入力を検出: field=${result.field}, reason=${result.reason}, ip=${request.ip}`);
      return reply.code(400).send({
        error: 'Bad Request',
        message: `入力値に不正なパターンが検出されました: ${result.reason}`,
      });
    }
  }

  // ヘッダーのワークスペースIDをチェック
  const workspaceIdHeader = request.headers['x-workspace-id'] as string | undefined;
  if (workspaceIdHeader && !isValidWorkspaceId(workspaceIdHeader)) {
    return reply.code(400).send({
      error: 'Bad Request',
      message: '不正なワークスペースIDです',
    });
  }
}
