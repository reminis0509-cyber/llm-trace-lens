/**
 * Workspace Resolver Service
 *
 * APIキーからワークスペースを特定するサービス
 * - APIキーのハッシュ化による高速検索
 * - インメモリキャッシュ
 * - アクセスログ記録
 * - 期限管理
 */

import { createHash } from 'crypto';
import { kv } from '@vercel/kv';

// ===========================
// Types
// ===========================

export interface ApiKeyMapping {
  apiKeyHash: string;
  workspaceId: string;
  customerId: string;
  customerName?: string;
  provider: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  isActive: boolean;
}

export interface WorkspaceInfo {
  workspaceId: string;
  customerId: string;
  customerName?: string;
  providers: string[];
}

export interface ApiKeyAccessLog {
  id: string;
  apiKeyHash: string;
  workspaceId: string;
  endpoint: string;
  method: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
}

// ===========================
// Constants
// ===========================

const API_KEY_MAPPING_PREFIX = 'api_key_mapping:';
const API_KEY_ACCESS_LOG_PREFIX = 'api_key_access:';
const WORKSPACE_KEYS_PREFIX = 'workspace_keys:';

// キャッシュ設定
const DEFAULT_CACHE_TTL = parseInt(process.env.API_KEY_CACHE_TTL || '300', 10); // 5分
const CACHE_ENABLED = process.env.ENABLE_API_KEY_CACHE !== 'false';

// ===========================
// In-Memory Cache
// ===========================

interface CacheEntry {
  data: WorkspaceInfo;
  expiresAt: number;
}

class ApiKeyCache {
  private cache: Map<string, CacheEntry> = new Map();
  private ttl: number;

  constructor(ttlSeconds: number = DEFAULT_CACHE_TTL) {
    this.ttl = ttlSeconds * 1000; // ms
  }

  get(apiKeyHash: string): WorkspaceInfo | undefined {
    const entry = this.cache.get(apiKeyHash);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(apiKeyHash);
      return undefined;
    }

    return entry.data;
  }

  set(apiKeyHash: string, data: WorkspaceInfo): void {
    this.cache.set(apiKeyHash, {
      data,
      expiresAt: Date.now() + this.ttl,
    });
  }

  invalidate(workspaceId: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.data.workspaceId === workspaceId) {
        this.cache.delete(key);
      }
    }
  }

  invalidateByHash(apiKeyHash: string): void {
    this.cache.delete(apiKeyHash);
  }

  clear(): void {
    this.cache.clear();
  }

  // 定期的な期限切れエントリのクリーンアップ
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// グローバルキャッシュインスタンス
const apiKeyCache = new ApiKeyCache();

// 定期クリーンアップ（5分ごと）
setInterval(() => {
  apiKeyCache.cleanup();
}, 5 * 60 * 1000);

// ===========================
// Utility Functions
// ===========================

/**
 * APIキーをハッシュ化（検索用）
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * KVが利用可能かチェック
 */
function isKVAvailable(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// ===========================
// Core Functions
// ===========================

/**
 * APIキーからワークスペース情報を取得
 * キャッシュ → KV の順で検索
 */
export async function getWorkspaceByApiKey(apiKey: string): Promise<WorkspaceInfo | null> {
  if (!apiKey) return null;

  const apiKeyHash = hashApiKey(apiKey);

  // 1. キャッシュチェック
  if (CACHE_ENABLED) {
    const cached = apiKeyCache.get(apiKeyHash);
    if (cached) {
      // 非同期でlastUsedAtを更新
      updateLastUsed(apiKeyHash).catch(() => {});
      return cached;
    }
  }

  // 2. KVから取得
  if (!isKVAvailable()) {
    // KV未設定時はデフォルトワークスペース
    return {
      workspaceId: 'default',
      customerId: 'default',
      providers: ['openai', 'anthropic', 'gemini', 'deepseek'],
    };
  }

  try {
    const mapping = await kv.get<ApiKeyMapping>(`${API_KEY_MAPPING_PREFIX}${apiKeyHash}`);

    if (!mapping) {
      return null;
    }

    // 有効期限チェック
    if (new Date(mapping.expiresAt) < new Date()) {
      console.warn(`[WorkspaceResolver] API key expired for workspace ${mapping.workspaceId}`);
      return null;
    }

    // 非アクティブチェック
    if (!mapping.isActive) {
      console.warn(`[WorkspaceResolver] API key inactive for workspace ${mapping.workspaceId}`);
      return null;
    }

    // ワークスペースの全プロバイダーを取得
    const providers = await getWorkspaceProviders(mapping.workspaceId);

    const workspaceInfo: WorkspaceInfo = {
      workspaceId: mapping.workspaceId,
      customerId: mapping.customerId,
      customerName: mapping.customerName,
      providers,
    };

    // キャッシュに保存
    if (CACHE_ENABLED) {
      apiKeyCache.set(apiKeyHash, workspaceInfo);
    }

    // lastUsedAt を更新
    updateLastUsed(apiKeyHash).catch(() => {});

    return workspaceInfo;
  } catch (error) {
    console.error('[WorkspaceResolver] Failed to get workspace:', error);
    return null;
  }
}

/**
 * ワークスペースの全プロバイダーを取得
 */
async function getWorkspaceProviders(workspaceId: string): Promise<string[]> {
  if (!isKVAvailable()) {
    return ['openai', 'anthropic', 'gemini', 'deepseek'];
  }

  try {
    const keys = await kv.smembers(`${WORKSPACE_KEYS_PREFIX}${workspaceId}`);
    return keys as string[];
  } catch {
    return [];
  }
}

/**
 * lastUsedAt を更新
 */
async function updateLastUsed(apiKeyHash: string): Promise<void> {
  if (!isKVAvailable()) return;

  try {
    const mapping = await kv.get<ApiKeyMapping>(`${API_KEY_MAPPING_PREFIX}${apiKeyHash}`);
    if (mapping) {
      mapping.lastUsedAt = new Date().toISOString();
      await kv.set(`${API_KEY_MAPPING_PREFIX}${apiKeyHash}`, mapping);
    }
  } catch (error) {
    console.error('[WorkspaceResolver] Failed to update lastUsedAt:', error);
  }
}

/**
 * APIキーマッピングを登録
 */
export async function registerApiKeyMapping(params: {
  apiKey: string;
  workspaceId: string;
  customerId: string;
  customerName?: string;
  provider: string;
  expiryDays?: number;
}): Promise<{ success: boolean; apiKeyHash: string; error?: string }> {
  const {
    apiKey,
    workspaceId,
    customerId,
    customerName,
    provider,
    expiryDays = parseInt(process.env.API_KEY_EXPIRY_DAYS || '90', 10),
  } = params;

  const apiKeyHash = hashApiKey(apiKey);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

  const mapping: ApiKeyMapping = {
    apiKeyHash,
    workspaceId,
    customerId,
    customerName,
    provider,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    isActive: true,
  };

  if (!isKVAvailable()) {
    console.warn('[WorkspaceResolver] KV not available, mapping not persisted');
    return { success: true, apiKeyHash };
  }

  try {
    // マッピングを保存
    await kv.set(`${API_KEY_MAPPING_PREFIX}${apiKeyHash}`, mapping);

    // ワークスペースのプロバイダーリストに追加
    await kv.sadd(`${WORKSPACE_KEYS_PREFIX}${workspaceId}`, provider);

    // ワークスペースのAPIキーハッシュリストに追加（管理用）
    await kv.sadd(`workspace_api_keys:${workspaceId}`, apiKeyHash);

    console.log(`[WorkspaceResolver] Registered API key mapping for workspace ${workspaceId}, provider ${provider}`);

    return { success: true, apiKeyHash };
  } catch (error) {
    console.error('[WorkspaceResolver] Failed to register mapping:', error);
    return { success: false, apiKeyHash, error: String(error) };
  }
}

/**
 * APIキーマッピングを無効化
 */
export async function deactivateApiKey(apiKeyHash: string): Promise<boolean> {
  if (!isKVAvailable()) return false;

  try {
    const mapping = await kv.get<ApiKeyMapping>(`${API_KEY_MAPPING_PREFIX}${apiKeyHash}`);
    if (!mapping) return false;

    mapping.isActive = false;
    await kv.set(`${API_KEY_MAPPING_PREFIX}${apiKeyHash}`, mapping);

    // キャッシュを無効化
    apiKeyCache.invalidateByHash(apiKeyHash);

    return true;
  } catch (error) {
    console.error('[WorkspaceResolver] Failed to deactivate API key:', error);
    return false;
  }
}

/**
 * ワークスペースの全APIキーを無効化
 */
export async function deactivateWorkspaceApiKeys(workspaceId: string): Promise<boolean> {
  if (!isKVAvailable()) return false;

  try {
    const apiKeyHashes = await kv.smembers(`workspace_api_keys:${workspaceId}`);

    for (const hash of apiKeyHashes) {
      await deactivateApiKey(hash as string);
    }

    // キャッシュを無効化
    apiKeyCache.invalidate(workspaceId);

    return true;
  } catch (error) {
    console.error('[WorkspaceResolver] Failed to deactivate workspace API keys:', error);
    return false;
  }
}

/**
 * APIキーの有効期限を延長
 */
export async function extendApiKeyExpiry(
  apiKeyHash: string,
  additionalDays: number
): Promise<boolean> {
  if (!isKVAvailable()) return false;

  try {
    const mapping = await kv.get<ApiKeyMapping>(`${API_KEY_MAPPING_PREFIX}${apiKeyHash}`);
    if (!mapping) return false;

    const currentExpiry = new Date(mapping.expiresAt);
    const newExpiry = new Date(currentExpiry.getTime() + additionalDays * 24 * 60 * 60 * 1000);
    mapping.expiresAt = newExpiry.toISOString();

    await kv.set(`${API_KEY_MAPPING_PREFIX}${apiKeyHash}`, mapping);

    // キャッシュを無効化
    apiKeyCache.invalidateByHash(apiKeyHash);

    return true;
  } catch (error) {
    console.error('[WorkspaceResolver] Failed to extend API key expiry:', error);
    return false;
  }
}

// ===========================
// Access Logging
// ===========================

/**
 * APIキー使用ログを記録
 */
export async function logApiKeyAccess(params: {
  apiKey: string;
  workspaceId: string;
  endpoint: string;
  method: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
}): Promise<void> {
  const apiKeyHash = hashApiKey(params.apiKey);

  const log: ApiKeyAccessLog = {
    id: `access_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    apiKeyHash,
    workspaceId: params.workspaceId,
    endpoint: params.endpoint,
    method: params.method,
    timestamp: new Date().toISOString(),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    success: params.success,
    failureReason: params.failureReason,
  };

  // コンソールログ
  const level = params.success ? 'info' : 'warn';
  console[level]('[WorkspaceResolver] API Key Access:', {
    workspaceId: params.workspaceId,
    endpoint: params.endpoint,
    success: params.success,
    timestamp: log.timestamp,
  });

  if (!isKVAvailable()) return;

  try {
    // ログを保存（30日保持）
    await kv.set(`${API_KEY_ACCESS_LOG_PREFIX}${log.id}`, log, { ex: 60 * 60 * 24 * 30 });

    // インデックスに追加
    await kv.zadd(`${API_KEY_ACCESS_LOG_PREFIX}index:${params.workspaceId}`, {
      score: Date.now(),
      member: log.id,
    });
  } catch (error) {
    console.error('[WorkspaceResolver] Failed to log API key access:', error);
  }
}

/**
 * アクセスログを取得
 */
export async function getApiKeyAccessLogs(
  workspaceId: string,
  limit: number = 100,
  offset: number = 0
): Promise<ApiKeyAccessLog[]> {
  if (!isKVAvailable()) return [];

  try {
    const logIds = await kv.zrange(
      `${API_KEY_ACCESS_LOG_PREFIX}index:${workspaceId}`,
      offset,
      offset + limit - 1,
      { rev: true }
    );

    if (!logIds.length) return [];

    const logs = await Promise.all(
      logIds.map(id => kv.get<ApiKeyAccessLog>(`${API_KEY_ACCESS_LOG_PREFIX}${id}`))
    );

    return logs.filter((log): log is ApiKeyAccessLog => log !== null);
  } catch (error) {
    console.error('[WorkspaceResolver] Failed to get access logs:', error);
    return [];
  }
}

// ===========================
// Management Functions
// ===========================

/**
 * 期限切れ間近のAPIキーを取得
 */
export async function getExpiringApiKeys(daysBeforeExpiry: number = 7): Promise<ApiKeyMapping[]> {
  if (!isKVAvailable()) return [];

  try {
    const checkDate = new Date(Date.now() + daysBeforeExpiry * 24 * 60 * 60 * 1000);
    const expiring: ApiKeyMapping[] = [];

    // ワークスペースリストを取得
    const workspaces = await kv.smembers('workspaces:list');

    for (const wsId of workspaces) {
      const apiKeyHashes = await kv.smembers(`workspace_api_keys:${wsId}`);

      for (const hash of apiKeyHashes) {
        const mapping = await kv.get<ApiKeyMapping>(`${API_KEY_MAPPING_PREFIX}${hash}`);
        if (mapping && mapping.isActive) {
          const expiresAt = new Date(mapping.expiresAt);
          if (expiresAt <= checkDate) {
            expiring.push(mapping);
          }
        }
      }
    }

    return expiring;
  } catch (error) {
    console.error('[WorkspaceResolver] Failed to get expiring API keys:', error);
    return [];
  }
}

/**
 * ワークスペースのAPIキー情報を取得（マスク済み）
 */
export async function getWorkspaceApiKeyInfo(workspaceId: string): Promise<Array<{
  provider: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  isActive: boolean;
  hashPrefix: string;
}>> {
  if (!isKVAvailable()) return [];

  try {
    const apiKeyHashes = await kv.smembers(`workspace_api_keys:${workspaceId}`);
    const info: Array<{
      provider: string;
      createdAt: string;
      expiresAt: string;
      lastUsedAt?: string;
      isActive: boolean;
      hashPrefix: string;
    }> = [];

    for (const hash of apiKeyHashes) {
      const mapping = await kv.get<ApiKeyMapping>(`${API_KEY_MAPPING_PREFIX}${hash}`);
      if (mapping) {
        info.push({
          provider: mapping.provider,
          createdAt: mapping.createdAt,
          expiresAt: mapping.expiresAt,
          lastUsedAt: mapping.lastUsedAt,
          isActive: mapping.isActive,
          hashPrefix: (hash as string).substring(0, 8) + '...',
        });
      }
    }

    return info;
  } catch (error) {
    console.error('[WorkspaceResolver] Failed to get workspace API key info:', error);
    return [];
  }
}

// キャッシュのエクスポート（テスト用）
export { apiKeyCache };
