/**
 * Secret Manager - 顧客APIキーの暗号化管理
 *
 * セキュリティ機能:
 * - AES-256-GCM暗号化
 * - アクセスログ記録
 * - キーローテーション管理
 * - 担当者制限
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from 'crypto';
import { kv } from '@vercel/kv';

// ===========================
// Types
// ===========================

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  tag: string;
  createdAt: string;
  expiresAt: string | null;
  createdBy: string;
  lastAccessedAt: string | null;
  accessCount: number;
  version: number;
}

export interface SecretAccessLog {
  id: string;
  secretKey: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'ROTATE';
  performedBy: string;
  performedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  failureReason?: string;
}

export interface RotationConfig {
  enabled: boolean;
  intervalDays: number; // デフォルト90日
  lastRotatedAt: string | null;
  nextRotationAt: string | null;
  notifyBeforeDays: number; // ローテーション前の通知日数
}

export interface SecretMetadata {
  key: string;
  provider: string;
  workspaceId: string;
  description?: string;
  rotation: RotationConfig;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isActive: boolean;
}

// ===========================
// Constants
// ===========================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SECRET_PREFIX = 'encrypted_secret:';
const ACCESS_LOG_PREFIX = 'secret_access_log:';
const METADATA_PREFIX = 'secret_metadata:';
const AUTHORIZED_USERS_KEY = 'secret_manager:authorized_users';

// ===========================
// Encryption Utilities
// ===========================

/**
 * マスターキーを取得（環境変数から）
 * 本番環境では、AWS KMS、HashiCorp Vault、または
 * クラウドプロバイダのSecret Managerを使用することを推奨
 */
function getMasterKey(): Buffer {
  const masterKeyEnv = process.env.SECRET_ENCRYPTION_KEY;

  if (!masterKeyEnv) {
    // 開発環境のフォールバック（本番では必ず設定すること）
    console.warn('[SecretManager] SECRET_ENCRYPTION_KEY not set. Using fallback key (NOT FOR PRODUCTION)');
    return createHash('sha256').update('dev-fallback-key-not-for-production').digest();
  }

  // Base64エンコードされた32バイトのキーを期待
  const key = Buffer.from(masterKeyEnv, 'base64');
  if (key.length !== 32) {
    throw new Error('SECRET_ENCRYPTION_KEY must be a 32-byte key encoded in base64');
  }

  return key;
}

/**
 * シークレットを暗号化
 */
function encryptSecret(plaintext: string): { ciphertext: string; iv: string; tag: string } {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * シークレットを復号
 */
function decryptSecret(ciphertext: string, iv: string, tag: string): string {
  const key = getMasterKey();
  const ivBuffer = Buffer.from(iv, 'base64');
  const tagBuffer = Buffer.from(tag, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(tagBuffer);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ===========================
// KV Availability Check
// ===========================

function isKVAvailable(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// ===========================
// Access Control
// ===========================

/**
 * 担当者が認可されているか確認
 */
export async function isAuthorizedUser(userId: string): Promise<boolean> {
  if (!isKVAvailable()) {
    // 開発環境では全て許可
    return true;
  }

  try {
    const authorizedUsers = await kv.smembers(AUTHORIZED_USERS_KEY);
    return authorizedUsers.includes(userId);
  } catch (error) {
    console.error('[SecretManager] Failed to check authorization:', error);
    return false;
  }
}

/**
 * 担当者を追加
 */
export async function addAuthorizedUser(userId: string, addedBy: string): Promise<void> {
  if (!isKVAvailable()) {
    console.warn('[SecretManager] KV not available, skipping authorization');
    return;
  }

  await kv.sadd(AUTHORIZED_USERS_KEY, userId);
  await logAccess({
    secretKey: 'SYSTEM',
    action: 'CREATE',
    performedBy: addedBy,
    ipAddress: null,
    userAgent: null,
    success: true,
    metadata: { addedUser: userId },
  });
}

/**
 * 担当者を削除
 */
export async function removeAuthorizedUser(userId: string, removedBy: string): Promise<void> {
  if (!isKVAvailable()) {
    return;
  }

  await kv.srem(AUTHORIZED_USERS_KEY, userId);
  await logAccess({
    secretKey: 'SYSTEM',
    action: 'DELETE',
    performedBy: removedBy,
    ipAddress: null,
    userAgent: null,
    success: true,
    metadata: { removedUser: userId },
  });
}

/**
 * 認可された担当者リストを取得
 */
export async function getAuthorizedUsers(): Promise<string[]> {
  if (!isKVAvailable()) {
    return [];
  }

  const users = await kv.smembers(AUTHORIZED_USERS_KEY);
  return users as string[];
}

// ===========================
// Access Logging
// ===========================

interface LogAccessParams {
  secretKey: string;
  action: SecretAccessLog['action'];
  performedBy: string;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * アクセスログを記録
 */
async function logAccess(params: LogAccessParams): Promise<void> {
  const log: SecretAccessLog = {
    id: `log_${Date.now()}_${randomBytes(4).toString('hex')}`,
    secretKey: params.secretKey,
    action: params.action,
    performedBy: params.performedBy,
    performedAt: new Date().toISOString(),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    success: params.success,
    failureReason: params.failureReason,
  };

  // コンソールログ（常に出力）
  const logLevel = params.success ? 'info' : 'warn';
  console[logLevel]('[SecretManager] Access log:', {
    action: log.action,
    secretKey: log.secretKey.substring(0, 20) + '...',
    performedBy: log.performedBy,
    success: log.success,
    timestamp: log.performedAt,
  });

  if (!isKVAvailable()) {
    return;
  }

  try {
    const logKey = `${ACCESS_LOG_PREFIX}${log.id}`;
    await kv.set(logKey, log, { ex: 60 * 60 * 24 * 365 }); // 1年保持

    // インデックスに追加
    await kv.zadd(`${ACCESS_LOG_PREFIX}index`, {
      score: Date.now(),
      member: log.id,
    });

    // シークレットごとのインデックス
    await kv.zadd(`${ACCESS_LOG_PREFIX}by_secret:${params.secretKey}`, {
      score: Date.now(),
      member: log.id,
    });
  } catch (error) {
    console.error('[SecretManager] Failed to save access log:', error);
  }
}

/**
 * アクセスログを取得
 */
export async function getAccessLogs(
  options: {
    secretKey?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<SecretAccessLog[]> {
  if (!isKVAvailable()) {
    return [];
  }

  const { secretKey, limit = 100, offset = 0 } = options;

  try {
    const indexKey = secretKey
      ? `${ACCESS_LOG_PREFIX}by_secret:${secretKey}`
      : `${ACCESS_LOG_PREFIX}index`;

    const logIds = await kv.zrange(indexKey, offset, offset + limit - 1, { rev: true });

    if (!logIds.length) return [];

    const logs = await Promise.all(
      logIds.map(id => kv.get<SecretAccessLog>(`${ACCESS_LOG_PREFIX}${id}`))
    );

    return logs.filter((log): log is SecretAccessLog => log !== null);
  } catch (error) {
    console.error('[SecretManager] Failed to get access logs:', error);
    return [];
  }
}

// ===========================
// Secret CRUD Operations
// ===========================

interface StoreSecretParams {
  key: string;
  value: string;
  provider: string;
  workspaceId: string;
  performedBy: string;
  description?: string;
  rotationIntervalDays?: number;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * シークレットを暗号化して保存
 */
export async function storeSecret(params: StoreSecretParams): Promise<{ success: boolean; error?: string }> {
  const {
    key,
    value,
    provider,
    workspaceId,
    performedBy,
    description,
    rotationIntervalDays = 90,
    ipAddress = null,
    userAgent = null,
  } = params;

  // 認可チェック
  if (!await isAuthorizedUser(performedBy)) {
    await logAccess({
      secretKey: key,
      action: 'CREATE',
      performedBy,
      ipAddress,
      userAgent,
      success: false,
      failureReason: 'Unauthorized user',
    });
    return { success: false, error: 'Unauthorized: User is not authorized to manage secrets' };
  }

  try {
    // 暗号化
    const { ciphertext, iv, tag } = encryptSecret(value);

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + rotationIntervalDays * 24 * 60 * 60 * 1000).toISOString();

    const encryptedSecret: EncryptedSecret = {
      ciphertext,
      iv,
      tag,
      createdAt: now,
      expiresAt,
      createdBy: performedBy,
      lastAccessedAt: null,
      accessCount: 0,
      version: 1,
    };

    const metadata: SecretMetadata = {
      key,
      provider,
      workspaceId,
      description,
      rotation: {
        enabled: true,
        intervalDays: rotationIntervalDays,
        lastRotatedAt: now,
        nextRotationAt: expiresAt,
        notifyBeforeDays: 7,
      },
      createdAt: now,
      updatedAt: now,
      createdBy: performedBy,
      isActive: true,
    };

    if (isKVAvailable()) {
      await kv.set(`${SECRET_PREFIX}${workspaceId}:${provider}`, encryptedSecret);
      await kv.set(`${METADATA_PREFIX}${workspaceId}:${provider}`, metadata);

      // ワークスペースのシークレットインデックス
      await kv.sadd(`secrets:workspace:${workspaceId}`, `${provider}`);
    }

    await logAccess({
      secretKey: key,
      action: 'CREATE',
      performedBy,
      ipAddress,
      userAgent,
      success: true,
    });

    return { success: true };
  } catch (error) {
    await logAccess({
      secretKey: key,
      action: 'CREATE',
      performedBy,
      ipAddress,
      userAgent,
      success: false,
      failureReason: String(error),
    });

    console.error('[SecretManager] Failed to store secret:', error);
    return { success: false, error: 'Failed to store secret' };
  }
}

interface RetrieveSecretParams {
  provider: string;
  workspaceId: string;
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * シークレットを取得（復号）
 */
export async function retrieveSecret(params: RetrieveSecretParams): Promise<{ success: boolean; value?: string; error?: string }> {
  const { provider, workspaceId, performedBy, ipAddress = null, userAgent = null } = params;
  const secretKey = `${workspaceId}:${provider}`;

  // 認可チェック
  if (!await isAuthorizedUser(performedBy)) {
    await logAccess({
      secretKey,
      action: 'READ',
      performedBy,
      ipAddress,
      userAgent,
      success: false,
      failureReason: 'Unauthorized user',
    });
    return { success: false, error: 'Unauthorized: User is not authorized to access secrets' };
  }

  try {
    // 環境変数フォールバック（開発環境）
    if (!isKVAvailable()) {
      const envKeyMap: Record<string, string | undefined> = {
        openai: process.env.OPENAI_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
        gemini: process.env.GOOGLE_API_KEY,
        deepseek: process.env.DEEPSEEK_API_KEY,
      };

      const envValue = envKeyMap[provider.toLowerCase()];
      if (envValue) {
        await logAccess({
          secretKey,
          action: 'READ',
          performedBy,
          ipAddress,
          userAgent,
          success: true,
          metadata: { source: 'env' },
        });
        return { success: true, value: envValue };
      }

      return { success: false, error: 'Secret not found' };
    }

    const encryptedSecret = await kv.get<EncryptedSecret>(`${SECRET_PREFIX}${secretKey}`);

    if (!encryptedSecret) {
      await logAccess({
        secretKey,
        action: 'READ',
        performedBy,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'Secret not found',
      });
      return { success: false, error: 'Secret not found' };
    }

    // 復号
    const value = decryptSecret(encryptedSecret.ciphertext, encryptedSecret.iv, encryptedSecret.tag);

    // アクセス情報を更新
    encryptedSecret.lastAccessedAt = new Date().toISOString();
    encryptedSecret.accessCount += 1;
    await kv.set(`${SECRET_PREFIX}${secretKey}`, encryptedSecret);

    await logAccess({
      secretKey,
      action: 'READ',
      performedBy,
      ipAddress,
      userAgent,
      success: true,
    });

    return { success: true, value };
  } catch (error) {
    await logAccess({
      secretKey,
      action: 'READ',
      performedBy,
      ipAddress,
      userAgent,
      success: false,
      failureReason: String(error),
    });

    console.error('[SecretManager] Failed to retrieve secret:', error);
    return { success: false, error: 'Failed to retrieve secret' };
  }
}

/**
 * シークレットを削除
 */
export async function deleteSecret(params: {
  provider: string;
  workspaceId: string;
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { provider, workspaceId, performedBy, ipAddress = null, userAgent = null } = params;
  const secretKey = `${workspaceId}:${provider}`;

  // 認可チェック
  if (!await isAuthorizedUser(performedBy)) {
    await logAccess({
      secretKey,
      action: 'DELETE',
      performedBy,
      ipAddress,
      userAgent,
      success: false,
      failureReason: 'Unauthorized user',
    });
    return { success: false, error: 'Unauthorized' };
  }

  try {
    if (isKVAvailable()) {
      await kv.del(`${SECRET_PREFIX}${secretKey}`);
      await kv.del(`${METADATA_PREFIX}${secretKey}`);
      await kv.srem(`secrets:workspace:${workspaceId}`, provider);
    }

    await logAccess({
      secretKey,
      action: 'DELETE',
      performedBy,
      ipAddress,
      userAgent,
      success: true,
    });

    return { success: true };
  } catch (error) {
    await logAccess({
      secretKey,
      action: 'DELETE',
      performedBy,
      ipAddress,
      userAgent,
      success: false,
      failureReason: String(error),
    });

    return { success: false, error: 'Failed to delete secret' };
  }
}

// ===========================
// Key Rotation
// ===========================

/**
 * シークレットをローテーション
 */
export async function rotateSecret(params: {
  provider: string;
  workspaceId: string;
  newValue: string;
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { provider, workspaceId, newValue, performedBy, ipAddress = null, userAgent = null } = params;
  const secretKey = `${workspaceId}:${provider}`;

  // 認可チェック
  if (!await isAuthorizedUser(performedBy)) {
    await logAccess({
      secretKey,
      action: 'ROTATE',
      performedBy,
      ipAddress,
      userAgent,
      success: false,
      failureReason: 'Unauthorized user',
    });
    return { success: false, error: 'Unauthorized' };
  }

  try {
    if (!isKVAvailable()) {
      await logAccess({
        secretKey,
        action: 'ROTATE',
        performedBy,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'KV not available',
      });
      return { success: false, error: 'KV storage not available' };
    }

    // 既存のシークレットを取得
    const existingSecret = await kv.get<EncryptedSecret>(`${SECRET_PREFIX}${secretKey}`);
    const existingMetadata = await kv.get<SecretMetadata>(`${METADATA_PREFIX}${secretKey}`);

    if (!existingSecret || !existingMetadata) {
      await logAccess({
        secretKey,
        action: 'ROTATE',
        performedBy,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'Secret not found',
      });
      return { success: false, error: 'Secret not found' };
    }

    // 新しい暗号化
    const { ciphertext, iv, tag } = encryptSecret(newValue);

    const now = new Date().toISOString();
    const rotationDays = existingMetadata.rotation.intervalDays;
    const nextRotationAt = new Date(Date.now() + rotationDays * 24 * 60 * 60 * 1000).toISOString();

    const newEncryptedSecret: EncryptedSecret = {
      ciphertext,
      iv,
      tag,
      createdAt: now,
      expiresAt: nextRotationAt,
      createdBy: performedBy,
      lastAccessedAt: null,
      accessCount: 0,
      version: existingSecret.version + 1,
    };

    const updatedMetadata: SecretMetadata = {
      ...existingMetadata,
      updatedAt: now,
      rotation: {
        ...existingMetadata.rotation,
        lastRotatedAt: now,
        nextRotationAt,
      },
    };

    await kv.set(`${SECRET_PREFIX}${secretKey}`, newEncryptedSecret);
    await kv.set(`${METADATA_PREFIX}${secretKey}`, updatedMetadata);

    await logAccess({
      secretKey,
      action: 'ROTATE',
      performedBy,
      ipAddress,
      userAgent,
      success: true,
      metadata: { newVersion: newEncryptedSecret.version },
    });

    return { success: true };
  } catch (error) {
    await logAccess({
      secretKey,
      action: 'ROTATE',
      performedBy,
      ipAddress,
      userAgent,
      success: false,
      failureReason: String(error),
    });

    console.error('[SecretManager] Failed to rotate secret:', error);
    return { success: false, error: 'Failed to rotate secret' };
  }
}

/**
 * ローテーションが必要なシークレットを取得
 */
export async function getSecretsNeedingRotation(
  daysBeforeExpiry: number = 7
): Promise<SecretMetadata[]> {
  if (!isKVAvailable()) {
    return [];
  }

  try {
    // 全ワークスペースのシークレットをスキャン
    const workspaces = await kv.smembers('workspaces:list');
    const needingRotation: SecretMetadata[] = [];

    const checkDate = new Date(Date.now() + daysBeforeExpiry * 24 * 60 * 60 * 1000);

    for (const wsId of workspaces) {
      const providers = await kv.smembers(`secrets:workspace:${wsId}`);

      for (const provider of providers) {
        const metadata = await kv.get<SecretMetadata>(`${METADATA_PREFIX}${wsId}:${provider}`);

        if (metadata && metadata.isActive && metadata.rotation.enabled) {
          const nextRotation = new Date(metadata.rotation.nextRotationAt || 0);

          if (nextRotation <= checkDate) {
            needingRotation.push(metadata);
          }
        }
      }
    }

    return needingRotation;
  } catch (error) {
    console.error('[SecretManager] Failed to get secrets needing rotation:', error);
    return [];
  }
}

/**
 * シークレットのメタデータを取得
 */
export async function getSecretMetadata(
  workspaceId: string,
  provider: string
): Promise<SecretMetadata | null> {
  if (!isKVAvailable()) {
    return null;
  }

  try {
    return await kv.get<SecretMetadata>(`${METADATA_PREFIX}${workspaceId}:${provider}`);
  } catch (error) {
    console.error('[SecretManager] Failed to get secret metadata:', error);
    return null;
  }
}

/**
 * ワークスペースの全シークレットメタデータを取得
 */
export async function getWorkspaceSecrets(workspaceId: string): Promise<SecretMetadata[]> {
  if (!isKVAvailable()) {
    return [];
  }

  try {
    const providers = await kv.smembers(`secrets:workspace:${workspaceId}`);
    const metadata: SecretMetadata[] = [];

    for (const provider of providers) {
      const meta = await kv.get<SecretMetadata>(`${METADATA_PREFIX}${workspaceId}:${provider}`);
      if (meta) {
        metadata.push(meta);
      }
    }

    return metadata;
  } catch (error) {
    console.error('[SecretManager] Failed to get workspace secrets:', error);
    return [];
  }
}

// ===========================
// Integration with Existing System
// ===========================

/**
 * 既存のgetApiKey関数の代替
 * 暗号化されたシークレットから取得
 */
export async function getSecureApiKey(
  provider: string,
  workspaceId: string = 'default'
): Promise<string> {
  // システムユーザーとして取得（内部呼び出し用）
  const result = await retrieveSecret({
    provider,
    workspaceId,
    performedBy: 'SYSTEM',
  });

  if (!result.success || !result.value) {
    throw new Error(`API key for ${provider} not found or not accessible`);
  }

  return result.value;
}
