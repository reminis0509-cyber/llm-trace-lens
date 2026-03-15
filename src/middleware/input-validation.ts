/**
 * Input Validation Middleware
 * リクエストボディの入力値をサニタイズチェックする防御層
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { validateObject, isValidWorkspaceId } from '../utils/sanitize.js';

/**
 * /v1/chat/completions のリクエストボディから messages と agentTrace の
 * テキスト内容を除外し、構造フィールド (model, temperature 等) のみ返す。
 * LLMの会話内容はURL・コード・自然言語を含むため、SQLi/XSS誤検出を防ぐ。
 */
function excludeMessageContent(body: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'messages' || key === 'agentTrace' || key === 'message' || key === 'history') {
      // Skip LLM conversation content and agent trace metadata
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

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
    // /v1/chat/completions はプロキシエンドポイント。
    // messagesフィールドはLLMの会話内容であり、URL・コードスニペット等を
    // 含むのが正常なため、構造フィールドのみバリデーションする。
    const isChatCompletions = request.url.startsWith('/v1/chat/completions');
    const isChatbot = request.url.startsWith('/api/chatbot') || request.url.startsWith('/api/research');
    const bodyToValidate = (isChatCompletions || isChatbot)
      ? excludeMessageContent(request.body as Record<string, unknown>)
      : (request.body as Record<string, unknown>);

    const result = validateObject(bodyToValidate);
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
