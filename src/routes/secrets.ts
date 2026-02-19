/**
 * シークレット管理APIルート
 *
 * セキュリティ機能:
 * - Admin権限必須
 * - アクセスログ記録
 * - キーローテーション管理
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash, timingSafeEqual } from 'crypto';
import {
  storeSecret,
  retrieveSecret,
  deleteSecret,
  rotateSecret,
  getAccessLogs,
  getSecretsNeedingRotation,
  getWorkspaceSecrets,
  addAuthorizedUser,
  removeAuthorizedUser,
  getAuthorizedUsers,
  isAuthorizedUser,
  getSecretMetadata,
} from '../security/secret-manager.js';
import {
  registerApiKeyMapping,
  getExpiringApiKeys,
  getWorkspaceApiKeyInfo,
  deactivateApiKey,
  extendApiKeyExpiry,
  hashApiKey,
} from '../services/workspace-resolver.js';
import { randomBytes } from 'crypto';

// ===========================
// Authentication Middleware
// ===========================

/**
 * Admin APIキーでの認証（タイミング攻撃対策）
 */
function verifyAdminKey(providedKey: string): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    console.warn('[Secrets API] ADMIN_API_KEY not configured');
    return false;
  }

  const hashA = createHash('sha256').update(providedKey).digest();
  const hashB = createHash('sha256').update(adminKey).digest();

  return timingSafeEqual(hashA, hashB);
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const authHeader = request.headers.authorization;
  const apiKeyHeader = request.headers['x-admin-api-key'] as string | undefined;

  const providedKey = apiKeyHeader || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

  if (!providedKey || !verifyAdminKey(providedKey)) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Valid admin API key required',
    });
    return false;
  }

  return true;
}

/**
 * リクエストからユーザー情報を抽出
 */
function extractUserInfo(request: FastifyRequest): {
  userId: string;
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  return {
    userId: (request.headers['x-user-id'] as string) || 'admin',
    ipAddress: request.ip || undefined,
    userAgent: request.headers['user-agent'] || undefined,
  };
}

// ===========================
// Routes
// ===========================

export async function secretsRoutes(fastify: FastifyInstance) {
  // ===========================
  // シークレット管理
  // ===========================

  /**
   * シークレットを保存（新規作成・更新）
   */
  fastify.post('/admin/secrets', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await requireAdmin(request, reply)) return;

    const body = request.body as {
      provider: string;
      workspaceId: string;
      apiKey: string;
      description?: string;
      rotationIntervalDays?: number;
    };

    if (!body.provider || !body.workspaceId || !body.apiKey) {
      return reply.code(400).send({
        error: 'Validation error',
        message: 'provider, workspaceId, and apiKey are required',
      });
    }

    const { userId, ipAddress, userAgent } = extractUserInfo(request);

    const result = await storeSecret({
      key: `${body.workspaceId}:${body.provider}`,
      value: body.apiKey,
      provider: body.provider,
      workspaceId: body.workspaceId,
      performedBy: userId,
      description: body.description,
      rotationIntervalDays: body.rotationIntervalDays || 90,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return reply.code(403).send({
        error: 'Failed to store secret',
        message: result.error,
      });
    }

    return {
      success: true,
      message: 'Secret stored successfully',
      provider: body.provider,
      workspaceId: body.workspaceId,
    };
  });

  /**
   * シークレットを取得（マスク済み情報のみ）
   */
  fastify.get('/admin/secrets/:workspaceId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await requireAdmin(request, reply)) return;

    const { workspaceId } = request.params as { workspaceId: string };

    const secrets = await getWorkspaceSecrets(workspaceId);

    return {
      workspaceId,
      secrets: secrets.map(secret => ({
        provider: secret.provider,
        description: secret.description,
        isActive: secret.isActive,
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt,
        createdBy: secret.createdBy,
        rotation: {
          enabled: secret.rotation.enabled,
          intervalDays: secret.rotation.intervalDays,
          lastRotatedAt: secret.rotation.lastRotatedAt,
          nextRotationAt: secret.rotation.nextRotationAt,
          notifyBeforeDays: secret.rotation.notifyBeforeDays,
        },
      })),
    };
  });

  /**
   * シークレットを削除
   */
  fastify.delete('/admin/secrets/:workspaceId/:provider', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await requireAdmin(request, reply)) return;

    const { workspaceId, provider } = request.params as { workspaceId: string; provider: string };
    const { userId, ipAddress, userAgent } = extractUserInfo(request);

    const result = await deleteSecret({
      provider,
      workspaceId,
      performedBy: userId,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return reply.code(400).send({
        error: 'Failed to delete secret',
        message: result.error,
      });
    }

    return {
      success: true,
      message: 'Secret deleted successfully',
    };
  });

  // ===========================
  // キーローテーション
  // ===========================

  /**
   * シークレットをローテーション
   */
  fastify.post('/admin/secrets/:workspaceId/:provider/rotate', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await requireAdmin(request, reply)) return;

    const { workspaceId, provider } = request.params as { workspaceId: string; provider: string };
    const body = request.body as { newApiKey: string };

    if (!body.newApiKey) {
      return reply.code(400).send({
        error: 'Validation error',
        message: 'newApiKey is required',
      });
    }

    const { userId, ipAddress, userAgent } = extractUserInfo(request);

    const result = await rotateSecret({
      provider,
      workspaceId,
      newValue: body.newApiKey,
      performedBy: userId,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return reply.code(400).send({
        error: 'Failed to rotate secret',
        message: result.error,
      });
    }

    return {
      success: true,
      message: 'Secret rotated successfully',
      provider,
      workspaceId,
    };
  });

  /**
   * ローテーションが必要なシークレット一覧
   */
  fastify.get('/admin/secrets/rotation-needed', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await requireAdmin(request, reply)) return;

    const query = request.query as { daysBeforeExpiry?: string };
    const daysBeforeExpiry = parseInt(query.daysBeforeExpiry || '7');

    const secrets = await getSecretsNeedingRotation(daysBeforeExpiry);

    return {
      count: secrets.length,
      secrets: secrets.map(secret => ({
        workspaceId: secret.workspaceId,
        provider: secret.provider,
        description: secret.description,
        nextRotationAt: secret.rotation.nextRotationAt,
        intervalDays: secret.rotation.intervalDays,
      })),
    };
  });

  // ===========================
  // アクセスログ
  // ===========================

  /**
   * アクセスログを取得
   */
  fastify.get('/admin/secrets/access-logs', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await requireAdmin(request, reply)) return;

    const query = request.query as {
      secretKey?: string;
      limit?: string;
      offset?: string;
    };

    const logs = await getAccessLogs({
      secretKey: query.secretKey,
      limit: parseInt(query.limit || '100'),
      offset: parseInt(query.offset || '0'),
    });

    return {
      count: logs.length,
      logs: logs.map(log => ({
        id: log.id,
        action: log.action,
        secretKey: log.secretKey.substring(0, 30) + (log.secretKey.length > 30 ? '...' : ''),
        performedBy: log.performedBy,
        performedAt: log.performedAt,
        ipAddress: log.ipAddress,
        success: log.success,
        failureReason: log.failureReason,
      })),
    };
  });

  // ===========================
  // 認可ユーザー管理
  // ===========================

  /**
   * 認可ユーザー一覧を取得
   */
  fastify.get('/admin/secrets/authorized-users', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await requireAdmin(request, reply)) return;

    const users = await getAuthorizedUsers();

    return {
      users,
    };
  });

  /**
   * 認可ユーザーを追加
   */
  fastify.post('/admin/secrets/authorized-users', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await requireAdmin(request, reply)) return;

    const body = request.body as { userId: string };

    if (!body.userId) {
      return reply.code(400).send({
        error: 'Validation error',
        message: 'userId is required',
      });
    }

    const { userId: adminId } = extractUserInfo(request);

    await addAuthorizedUser(body.userId, adminId);

    return {
      success: true,
      message: `User ${body.userId} added to authorized users`,
    };
  });

  /**
   * 認可ユーザーを削除
   */
  fastify.delete('/admin/secrets/authorized-users/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await requireAdmin(request, reply)) return;

    const { userId } = request.params as { userId: string };
    const { userId: adminId } = extractUserInfo(request);

    await removeAuthorizedUser(userId, adminId);

    return {
      success: true,
      message: `User ${userId} removed from authorized users`,
    };
  });

  // ===========================
  // 顧客オンボーディング
  // ===========================

  /**
   * 顧客用のシークレット設定（簡略化されたエンドポイント）
   *
   * 顧客のAPIキーを預かり、ワークスペースを設定
   * 顧客用のAPIキーを発行（このキーでワークスペースを自動特定）
   *
   * OpenAI SDK完全互換:
   * - baseURLを変更するだけで利用可能
   * - X-Workspace-IDヘッダー不要
   */
  fastify.post('/admin/onboarding/customer', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await requireAdmin(request, reply)) return;

    const body = request.body as {
      customerId: string;
      customerName: string;
      providers: {
        openai?: string;
        anthropic?: string;
        gemini?: string;
        deepseek?: string;
      };
      rotationIntervalDays?: number;
    };

    if (!body.customerId || !body.customerName) {
      return reply.code(400).send({
        error: 'Validation error',
        message: 'customerId and customerName are required',
      });
    }

    if (!body.providers || Object.keys(body.providers).length === 0) {
      return reply.code(400).send({
        error: 'Validation error',
        message: 'At least one provider API key is required',
      });
    }

    const { userId, ipAddress, userAgent } = extractUserInfo(request);
    const workspaceId = `ws_${body.customerId}`;
    const rotationDays = body.rotationIntervalDays || 90;

    // 顧客用のAPIキーを生成（OpenAI形式: sk-xxxxx）
    const customerApiKey = `sk-ltl-${randomBytes(24).toString('hex')}`;

    const results: Array<{ provider: string; success: boolean; error?: string }> = [];
    const mappingResults: Array<{ provider: string; success: boolean; error?: string }> = [];

    for (const [provider, apiKey] of Object.entries(body.providers)) {
      if (!apiKey) continue;

      // 1. APIキーを暗号化して保存
      const storeResult = await storeSecret({
        key: `${workspaceId}:${provider}`,
        value: apiKey,
        provider,
        workspaceId,
        performedBy: userId,
        description: `${body.customerName} - ${provider} API Key`,
        rotationIntervalDays: rotationDays,
        ipAddress,
        userAgent,
      });

      results.push({ provider, success: storeResult.success, error: storeResult.error });

      // 2. 顧客APIキーとワークスペースのマッピングを登録
      const mappingResult = await registerApiKeyMapping({
        apiKey: customerApiKey,
        workspaceId,
        customerId: body.customerId,
        customerName: body.customerName,
        provider,
        expiryDays: rotationDays,
      });

      mappingResults.push({ provider, success: mappingResult.success, error: mappingResult.error });
    }

    const allSuccess = results.every(r => r.success) && mappingResults.every(r => r.success);
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    return {
      success: allSuccess,
      customerId: body.customerId,
      customerName: body.customerName,
      workspaceId,

      // 顧客に提供するAPIキー（1回のみ表示）
      apiKey: customerApiKey,

      // 設定結果
      secretResults: results,
      mappingResults,

      // エンドポイント情報
      endpoints: {
        chatCompletions: `${baseUrl}/v1/chat/completions`,
        health: `${baseUrl}/health`,
      },

      // 顧客向け利用方法
      usage: {
        openaiSdk: {
          description: 'OpenAI SDKを使用する場合（Python）',
          code: `from openai import OpenAI

client = OpenAI(
    api_key="${customerApiKey}",
    base_url="${baseUrl}/v1"
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello!"}]
)`,
        },
        curl: {
          description: 'curlを使用する場合',
          code: `curl ${baseUrl}/v1/chat/completions \\
  -H "Authorization: Bearer ${customerApiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Hello!"}]}'`,
        },
      },

      // 重要な注意事項
      important: {
        warning: 'このAPIキーは一度しか表示されません。安全に保管してください。',
        noHeaderRequired: 'X-Workspace-IDヘッダーは不要です。APIキーだけでワークスペースが特定されます。',
      },

      // ローテーションスケジュール
      rotationSchedule: {
        intervalDays: rotationDays,
        expiresAt: new Date(Date.now() + rotationDays * 24 * 60 * 60 * 1000).toISOString(),
        recommendation: `${rotationDays}日ごとのキーローテーションを推奨`,
      },
    };
  });

  // ===========================
  // APIキー管理（顧客用キー）
  // ===========================

  /**
   * ワークスペースのAPIキー情報を取得
   */
  fastify.get('/admin/api-keys/:workspaceId', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await requireAdmin(request, reply)) return;

    const { workspaceId } = request.params as { workspaceId: string };
    const keyInfo = await getWorkspaceApiKeyInfo(workspaceId);

    return {
      workspaceId,
      apiKeys: keyInfo,
    };
  });

  /**
   * 期限切れ間近のAPIキー一覧
   */
  fastify.get('/admin/api-keys/expiring', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await requireAdmin(request, reply)) return;

    const query = request.query as { days?: string };
    const days = parseInt(query.days || '7');

    const expiring = await getExpiringApiKeys(days);

    return {
      count: expiring.length,
      daysBeforeExpiry: days,
      apiKeys: expiring.map(key => ({
        workspaceId: key.workspaceId,
        customerId: key.customerId,
        customerName: key.customerName,
        provider: key.provider,
        expiresAt: key.expiresAt,
        hashPrefix: key.apiKeyHash.substring(0, 8) + '...',
      })),
    };
  });

  /**
   * APIキーを無効化
   */
  fastify.post('/admin/api-keys/deactivate', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await requireAdmin(request, reply)) return;

    const body = request.body as { apiKeyHash: string };

    if (!body.apiKeyHash) {
      return reply.code(400).send({
        error: 'Validation error',
        message: 'apiKeyHash is required',
      });
    }

    const success = await deactivateApiKey(body.apiKeyHash);

    return {
      success,
      message: success ? 'API key deactivated' : 'Failed to deactivate API key',
    };
  });

  /**
   * APIキーの有効期限を延長
   */
  fastify.post('/admin/api-keys/extend', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await requireAdmin(request, reply)) return;

    const body = request.body as { apiKeyHash: string; additionalDays: number };

    if (!body.apiKeyHash || !body.additionalDays) {
      return reply.code(400).send({
        error: 'Validation error',
        message: 'apiKeyHash and additionalDays are required',
      });
    }

    const success = await extendApiKeyExpiry(body.apiKeyHash, body.additionalDays);

    return {
      success,
      message: success ? `API key extended by ${body.additionalDays} days` : 'Failed to extend API key',
    };
  });

  /**
   * 新しいAPIキーを発行（既存顧客向け）
   */
  fastify.post('/admin/api-keys/issue', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await requireAdmin(request, reply)) return;

    const body = request.body as {
      workspaceId: string;
      customerId: string;
      customerName?: string;
      expiryDays?: number;
    };

    if (!body.workspaceId || !body.customerId) {
      return reply.code(400).send({
        error: 'Validation error',
        message: 'workspaceId and customerId are required',
      });
    }

    // 新しいAPIキーを生成
    const newApiKey = `sk-ltl-${randomBytes(24).toString('hex')}`;
    const expiryDays = body.expiryDays || 90;

    // ワークスペースの全プロバイダーに対してマッピングを登録
    const providers = ['openai', 'anthropic', 'gemini', 'deepseek'];
    const mappingResults: Array<{ provider: string; success: boolean }> = [];

    for (const provider of providers) {
      const result = await registerApiKeyMapping({
        apiKey: newApiKey,
        workspaceId: body.workspaceId,
        customerId: body.customerId,
        customerName: body.customerName,
        provider,
        expiryDays,
      });
      mappingResults.push({ provider, success: result.success });
    }

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    return {
      success: true,
      apiKey: newApiKey,
      workspaceId: body.workspaceId,
      expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
      mappingResults,
      warning: 'このAPIキーは一度しか表示されません。安全に保管してください。',
      usage: `curl ${baseUrl}/v1/chat/completions -H "Authorization: Bearer ${newApiKey}" ...`,
    };
  });
}
