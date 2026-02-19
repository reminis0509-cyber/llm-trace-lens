import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  getWorkspaceByApiKey,
  logApiKeyAccess,
  type WorkspaceInfo,
} from '../services/workspace-resolver.js';

// FastifyRequestにworkspace情報を追加する型拡張
declare module 'fastify' {
  interface FastifyRequest {
    workspace?: WorkspaceInfo;
    apiKey?: string;
  }
}

/**
 * 認証ミドルウェア
 *
 * APIキーからワークスペースを自動特定
 * X-Workspace-IDヘッダーは不要（後方互換のため一時的にサポート）
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authEnabled = process.env.ENABLE_AUTH === 'true';

  if (!authEnabled) {
    // 認証無効時はデフォルトワークスペース
    request.workspace = {
      workspaceId: 'default',
      customerId: 'default',
      providers: ['openai', 'anthropic', 'gemini', 'deepseek'],
    };
    return;
  }

  // 認証ヘッダーからAPIキーを取得
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    await logApiKeyAccess({
      apiKey: 'unknown',
      workspaceId: 'unknown',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      success: false,
      failureReason: 'Missing Authorization header',
    });

    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'API key required. Set Authorization: Bearer <your-api-key>',
    });
  }

  const apiKey = authHeader.replace(/^Bearer\s+/i, '');

  if (!apiKey) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid Authorization header format. Use: Bearer <your-api-key>',
    });
  }

  // レガシーAPI_KEYS（環境変数）のチェック
  const legacyApiKeys = process.env.API_KEYS?.split(',').map(k => k.trim()).filter(Boolean) || [];
  if (legacyApiKeys.includes(apiKey)) {
    // レガシーキーはデフォルトワークスペースにマップ
    request.workspace = {
      workspaceId: 'default',
      customerId: 'default',
      providers: ['openai', 'anthropic', 'gemini', 'deepseek'],
    };
    request.apiKey = apiKey;
    return;
  }

  // APIキーからワークスペースを特定
  const workspace = await getWorkspaceByApiKey(apiKey);

  if (!workspace) {
    await logApiKeyAccess({
      apiKey,
      workspaceId: 'unknown',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      success: false,
      failureReason: 'Invalid or expired API key',
    });

    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired API key',
    });
  }

  // ワークスペース情報をリクエストに添付
  request.workspace = workspace;
  request.apiKey = apiKey;

  // アクセスログ記録（非同期、非ブロッキング）
  logApiKeyAccess({
    apiKey,
    workspaceId: workspace.workspaceId,
    endpoint: request.url,
    method: request.method,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
    success: true,
  }).catch(() => {});
}

/**
 * 認証をスキップするパスのリスト
 */
const AUTH_SKIP_PATHS = [
  '/health',
  '/api/setup-status',
  '/auth/',
  '/admin/', // Admin APIは独自の認証を使用
];

/**
 * 認証が必要かどうかを判定
 */
export function requiresAuth(path: string): boolean {
  return !AUTH_SKIP_PATHS.some(skipPath => path.startsWith(skipPath));
}

/**
 * ワークスペース必須ミドルウェア
 * 認証後にワークスペースが設定されていることを確認
 */
export async function requireWorkspace(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (!request.workspace) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Valid API key with workspace mapping required',
    });
  }
}
