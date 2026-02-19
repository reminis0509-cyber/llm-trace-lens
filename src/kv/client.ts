import { kv } from '@vercel/kv';
import type { WebhookConfig } from '../webhook/sender.js';

export interface LLMProviderKeys {
  openai?: string;
  anthropic?: string;
  gemini?: string;
  deepseek?: string;
}

export interface ValidationRules {
  requireHighConfidence: boolean;
  blockInsufficientEvidence: boolean;
  blockPII: boolean;
  customRules?: string[];
}

export interface AppConfig {
  providers: LLMProviderKeys;
  validation: ValidationRules;
  setupCompleted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BudgetConfig {
  monthlyLimit: number; // USD
  alertThresholds: number[]; // e.g., [0.8, 0.95] for 80% and 95%
}

export interface CostStats {
  currentMonth: string; // YYYY-MM
  totalCost: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byUser?: Record<string, number>;
}

const CONFIG_KEY = 'app:config';
const TRACE_PREFIX = 'trace:';
const WEBHOOK_CONFIG_KEY = 'webhook:config';
const BUDGET_CONFIG_KEY = 'budget:config';

// Check if KV is available
function isKVAvailable(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function getConfig(): Promise<AppConfig | null> {
  if (!isKVAvailable()) {
    // Fallback to environment variables for local development
    return getConfigFromEnv();
  }

  try {
    const config = await kv.get<AppConfig>(CONFIG_KEY);
    return config;
  } catch (error) {
    console.error('Failed to get config from KV:', error);
    // Fallback to environment variables
    return getConfigFromEnv();
  }
}

function getConfigFromEnv(): AppConfig | null {
  const hasAnyKey = process.env.OPENAI_API_KEY ||
                    process.env.ANTHROPIC_API_KEY ||
                    process.env.GOOGLE_API_KEY ||
                    process.env.DEEPSEEK_API_KEY;

  if (!hasAnyKey) {
    return null;
  }

  return {
    providers: {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      gemini: process.env.GOOGLE_API_KEY,
      deepseek: process.env.DEEPSEEK_API_KEY,
    },
    validation: {
      requireHighConfidence: true,
      blockInsufficientEvidence: true,
      blockPII: true,
    },
    setupCompleted: true,
  };
}

export async function saveConfig(config: Partial<AppConfig>): Promise<void> {
  if (!isKVAvailable()) {
    console.warn('KV not configured, configuration not persisted');
    return;
  }

  try {
    const existing = await getConfig();
    const updated: AppConfig = {
      providers: { ...existing?.providers, ...config.providers },
      validation: {
        requireHighConfidence: true,
        blockInsufficientEvidence: true,
        blockPII: true,
        ...existing?.validation,
        ...config.validation
      },
      setupCompleted: config.setupCompleted ?? existing?.setupCompleted ?? false,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(CONFIG_KEY, updated);
  } catch (error) {
    console.error('Failed to save config to KV:', error);
    throw new Error('Configuration save failed');
  }
}

export async function getApiKey(provider: string, workspaceId?: string): Promise<string> {
  // If workspace ID is provided, try encrypted Secret Manager first
  if (workspaceId && workspaceId !== 'default') {
    try {
      const { getSecureApiKey } = await import('../security/secret-manager.js');
      return await getSecureApiKey(provider, workspaceId);
    } catch {
      // Fall through to other methods
    }
  }

  // First try environment variables (for local development)
  const envKeyMap: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GOOGLE_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
  };

  const envKey = envKeyMap[provider.toLowerCase()];
  if (envKey) {
    return envKey;
  }

  // Then try KV store (legacy)
  const config = await getConfig();
  if (!config || !config.providers) {
    throw new Error('Configuration not found. Please complete setup at /setup');
  }

  const key = config.providers[provider.toLowerCase() as keyof LLMProviderKeys];
  if (!key) {
    throw new Error(`API key for ${provider} not configured. Please update settings at /setup`);
  }

  return key;
}

export async function getValidationRules(): Promise<ValidationRules> {
  const config = await getConfig();
  return config?.validation ?? {
    requireHighConfidence: true,
    blockInsufficientEvidence: true,
    blockPII: true,
  };
}

export async function saveTrace(trace: Record<string, unknown>): Promise<void> {
  if (!isKVAvailable()) {
    console.warn('KV not configured, trace not persisted');
    return;
  }

  try {
    const traceId = `${TRACE_PREFIX}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await kv.set(traceId, trace, { ex: 60 * 60 * 24 * 7 }); // Expire after 7 days

    // Add to sorted set for ordering (score = timestamp)
    await kv.zadd('traces:index', { score: Date.now(), member: traceId });

    // Keep only last 100 traces
    const count = await kv.zcard('traces:index');
    if (count > 100) {
      const toRemove = await kv.zrange('traces:index', 0, count - 101);
      if (toRemove.length > 0) {
        await kv.zrem('traces:index', ...toRemove);
        await Promise.all(toRemove.map(id => kv.del(id as string)));
      }
    }
  } catch (error) {
    console.error('Failed to save trace to KV:', error);
  }
}

export async function getTraces(limit = 50, offset = 0): Promise<Record<string, unknown>[]> {
  if (!isKVAvailable()) {
    return [];
  }

  try {
    const traceIds = await kv.zrange('traces:index', offset, offset + limit - 1, { rev: true });
    if (!traceIds.length) return [];

    const traces = await Promise.all(
      traceIds.map(id => kv.get<Record<string, unknown>>(id as string))
    );

    return traces.filter((t): t is Record<string, unknown> => t !== null);
  } catch (error) {
    console.error('Failed to get traces from KV:', error);
    return [];
  }
}

export async function getTraceById(id: string): Promise<Record<string, unknown> | null> {
  if (!isKVAvailable()) {
    return null;
  }

  try {
    return await kv.get<Record<string, unknown>>(id);
  } catch (error) {
    console.error('Failed to get trace from KV:', error);
    return null;
  }
}

// ===========================
// Webhook Configuration
// ===========================

export async function saveWebhookConfig(config: WebhookConfig): Promise<void> {
  if (!isKVAvailable()) {
    console.warn('KV not configured, webhook config not persisted');
    return;
  }

  try {
    await kv.set(WEBHOOK_CONFIG_KEY, config);
  } catch (error) {
    console.error('Failed to save webhook config to KV:', error);
    throw new Error('Webhook configuration save failed');
  }
}

export async function getWebhookConfig(): Promise<WebhookConfig | null> {
  // Try environment variables first
  const envUrl = process.env.WEBHOOK_URL;
  const envEnabled = process.env.WEBHOOK_ENABLED === 'true';

  if (envEnabled && envUrl) {
    const events = (process.env.WEBHOOK_EVENTS || 'BLOCK,WARN').split(',') as ('BLOCK' | 'WARN' | 'COST_ALERT')[];
    return {
      url: envUrl,
      events,
      retries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '3'),
      timeout: parseInt(process.env.WEBHOOK_TIMEOUT_MS || '5000'),
    };
  }

  if (!isKVAvailable()) {
    return null;
  }

  try {
    return await kv.get<WebhookConfig>(WEBHOOK_CONFIG_KEY);
  } catch (error) {
    console.error('Failed to get webhook config from KV:', error);
    return null;
  }
}

export async function deleteWebhookConfig(): Promise<void> {
  if (!isKVAvailable()) {
    return;
  }

  try {
    await kv.del(WEBHOOK_CONFIG_KEY);
  } catch (error) {
    console.error('Failed to delete webhook config from KV:', error);
    throw new Error('Webhook configuration delete failed');
  }
}

// ===========================
// Budget Configuration
// ===========================

export async function saveBudgetConfig(config: BudgetConfig): Promise<void> {
  if (!isKVAvailable()) {
    console.warn('KV not configured, budget config not persisted');
    return;
  }

  try {
    await kv.set(BUDGET_CONFIG_KEY, config);
  } catch (error) {
    console.error('Failed to save budget config to KV:', error);
    throw new Error('Budget configuration save failed');
  }
}

export async function getBudgetConfig(): Promise<BudgetConfig | null> {
  // Try environment variables first
  const envLimit = process.env.MONTHLY_BUDGET;
  if (envLimit) {
    const thresholds = (process.env.BUDGET_ALERT_THRESHOLDS || '0.8,0.95')
      .split(',')
      .map(t => parseFloat(t.trim()));
    return {
      monthlyLimit: parseFloat(envLimit),
      alertThresholds: thresholds,
    };
  }

  if (!isKVAvailable()) {
    return null;
  }

  try {
    return await kv.get<BudgetConfig>(BUDGET_CONFIG_KEY);
  } catch (error) {
    console.error('Failed to get budget config from KV:', error);
    return null;
  }
}

// ===========================
// Cost Tracking
// ===========================

export async function incrementCost(
  month: string,
  provider: string,
  model: string,
  cost: number,
  userId?: string
): Promise<void> {
  if (!isKVAvailable()) {
    console.warn('KV not configured, cost not tracked');
    return;
  }

  try {
    const totalKey = `cost:${month}:total`;
    const providerKey = `cost:${month}:provider:${provider}`;
    const modelKey = `cost:${month}:model:${model}`;

    // Convert to cents to avoid floating point issues
    const costCents = Math.round(cost * 100);

    await kv.incrby(totalKey, costCents);
    await kv.incrby(providerKey, costCents);
    await kv.incrby(modelKey, costCents);

    if (userId) {
      const userKey = `cost:${month}:user:${userId}`;
      await kv.incrby(userKey, costCents);
    }
  } catch (error) {
    console.error('Failed to increment cost in KV:', error);
  }
}

export async function getCostStats(month: string): Promise<CostStats> {
  const defaultStats: CostStats = {
    currentMonth: month,
    totalCost: 0,
    byProvider: {},
    byModel: {},
  };

  if (!isKVAvailable()) {
    return defaultStats;
  }

  try {
    const totalKey = `cost:${month}:total`;
    const total = await kv.get<number>(totalKey);

    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};

    // Get costs by provider
    const providers = ['openai', 'anthropic', 'google', 'deepseek'];
    for (const provider of providers) {
      const value = await kv.get<number>(`cost:${month}:provider:${provider}`);
      if (value) {
        byProvider[provider] = value / 100; // Convert from cents
      }
    }

    return {
      currentMonth: month,
      totalCost: (total || 0) / 100, // Convert from cents
      byProvider,
      byModel,
    };
  } catch (error) {
    console.error('Failed to get cost stats from KV:', error);
    return defaultStats;
  }
}

// ===========================
// Workspace / Multi-tenant Support
// ===========================

import {
  Workspace,
  ApiKey,
  WorkspaceSettings,
  ValidationConfig,
  ValidationConfigData,
  TraceFeedback,
  getWorkspaceKey,
  getTraceKey,
  getApiKeyToWorkspaceKey,
  getWorkspaceSettingsKey,
  getCustomPatternsKey,
  getValidationConfigKey,
  getFeedbackKey,
  getFeedbackByTraceKey,
  getWorkspaceFeedbackIndexKey,
} from '../storage/models.js';

const DEFAULT_WORKSPACE_ID = 'default';

/**
 * Get workspace ID from API key
 */
export async function getWorkspaceFromApiKey(apiKey: string): Promise<string | null> {
  if (!isKVAvailable()) {
    // In local development without KV, use default workspace
    return DEFAULT_WORKSPACE_ID;
  }

  try {
    const workspaceId = await kv.get<string>(getApiKeyToWorkspaceKey(apiKey));
    return workspaceId || null;
  } catch (error) {
    console.error('Failed to get workspace from API key:', error);
    return null;
  }
}

/**
 * Create a new workspace
 */
export async function createWorkspace(name: string): Promise<Workspace> {
  const workspace: Workspace = {
    id: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    created_at: new Date()
  };

  if (isKVAvailable()) {
    await kv.set(getWorkspaceKey(workspace.id, 'info'), workspace);
    await kv.sadd('workspaces:list', workspace.id);
  }

  return workspace;
}

/**
 * Get workspace by ID
 */
export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  if (!isKVAvailable()) {
    if (workspaceId === DEFAULT_WORKSPACE_ID) {
      return {
        id: DEFAULT_WORKSPACE_ID,
        name: 'Default Workspace',
        created_at: new Date()
      };
    }
    return null;
  }

  try {
    return await kv.get<Workspace>(getWorkspaceKey(workspaceId, 'info'));
  } catch (error) {
    console.error('Failed to get workspace:', error);
    return null;
  }
}

/**
 * Create API key for workspace
 */
export async function createApiKeyForWorkspace(workspaceId: string, keyName?: string): Promise<ApiKey> {
  const key = `ltl_${Math.random().toString(36).substr(2, 32)}`;
  const apiKey: ApiKey = {
    key,
    workspace_id: workspaceId,
    name: keyName,
    created_at: new Date(),
    is_active: true
  };

  if (isKVAvailable()) {
    // Store key -> workspace mapping
    await kv.set(getApiKeyToWorkspaceKey(key), workspaceId);
    // Store key info in workspace
    await kv.sadd(getWorkspaceKey(workspaceId, 'api_keys'), key);
    await kv.set(getWorkspaceKey(workspaceId, `api_key:${key}`), apiKey);
  }

  return apiKey;
}

/**
 * Validate API key and return workspace ID
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; workspaceId?: string }> {
  if (!apiKey) {
    return { valid: false };
  }

  const workspaceId = await getWorkspaceFromApiKey(apiKey);
  if (!workspaceId) {
    return { valid: false };
  }

  return { valid: true, workspaceId };
}

/**
 * Save trace with workspace isolation
 */
export async function saveWorkspaceTrace(
  workspaceId: string,
  trace: Record<string, unknown>
): Promise<void> {
  if (!isKVAvailable()) {
    console.warn('KV not configured, trace not persisted');
    return;
  }

  try {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const traceKey = getTraceKey(workspaceId, traceId);

    await kv.set(traceKey, { ...trace, workspace_id: workspaceId }, { ex: 60 * 60 * 24 * 30 }); // 30 days

    // Add to workspace's trace index
    await kv.zadd(getWorkspaceKey(workspaceId, 'traces:index'), {
      score: Date.now(),
      member: traceKey
    });

    // Keep only last 1000 traces per workspace
    const count = await kv.zcard(getWorkspaceKey(workspaceId, 'traces:index'));
    if (count > 1000) {
      const toRemove = await kv.zrange(getWorkspaceKey(workspaceId, 'traces:index'), 0, count - 1001);
      if (toRemove.length > 0) {
        await kv.zrem(getWorkspaceKey(workspaceId, 'traces:index'), ...toRemove);
        await Promise.all(toRemove.map(id => kv.del(id as string)));
      }
    }
  } catch (error) {
    console.error('Failed to save workspace trace:', error);
  }
}

/**
 * Get traces for a workspace
 */
export async function getWorkspaceTraces(
  workspaceId: string,
  limit = 50,
  offset = 0
): Promise<Record<string, unknown>[]> {
  if (!isKVAvailable()) {
    return [];
  }

  try {
    const traceKeys = await kv.zrange(
      getWorkspaceKey(workspaceId, 'traces:index'),
      offset,
      offset + limit - 1,
      { rev: true }
    );

    if (!traceKeys.length) return [];

    const traces = await Promise.all(
      traceKeys.map(key => kv.get<Record<string, unknown>>(key as string))
    );

    return traces.filter((t): t is Record<string, unknown> => t !== null);
  } catch (error) {
    console.error('Failed to get workspace traces:', error);
    return [];
  }
}

/**
 * Get workspace settings
 */
export async function getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings | null> {
  if (!isKVAvailable()) {
    return null;
  }

  try {
    return await kv.get<WorkspaceSettings>(getWorkspaceSettingsKey(workspaceId));
  } catch (error) {
    console.error('Failed to get workspace settings:', error);
    return null;
  }
}

/**
 * Save workspace settings
 */
export async function saveWorkspaceSettings(settings: WorkspaceSettings): Promise<void> {
  if (!isKVAvailable()) {
    console.warn('KV not configured, settings not persisted');
    return;
  }

  try {
    await kv.set(getWorkspaceSettingsKey(settings.workspace_id), settings);
  } catch (error) {
    console.error('Failed to save workspace settings:', error);
    throw new Error('Settings save failed');
  }
}

/**
 * Get custom validation patterns for workspace
 */
export async function getCustomPatterns(workspaceId: string): Promise<string[]> {
  if (!isKVAvailable()) {
    return [];
  }

  try {
    const patterns = await kv.smembers(getCustomPatternsKey(workspaceId));
    return patterns as string[];
  } catch (error) {
    console.error('Failed to get custom patterns:', error);
    return [];
  }
}

/**
 * Add custom validation pattern for workspace
 */
export async function addCustomPattern(workspaceId: string, pattern: string): Promise<void> {
  if (!isKVAvailable()) {
    console.warn('KV not configured, pattern not persisted');
    return;
  }

  try {
    await kv.sadd(getCustomPatternsKey(workspaceId), pattern);
  } catch (error) {
    console.error('Failed to add custom pattern:', error);
    throw new Error('Pattern add failed');
  }
}

/**
 * Remove custom validation pattern for workspace
 */
export async function removeCustomPattern(workspaceId: string, pattern: string): Promise<void> {
  if (!isKVAvailable()) {
    return;
  }

  try {
    await kv.srem(getCustomPatternsKey(workspaceId), pattern);
  } catch (error) {
    console.error('Failed to remove custom pattern:', error);
    throw new Error('Pattern remove failed');
  }
}

/**
 * Track cost for workspace
 */
export async function incrementWorkspaceCost(
  workspaceId: string,
  month: string,
  provider: string,
  model: string,
  cost: number
): Promise<void> {
  if (!isKVAvailable()) {
    console.warn('KV not configured, cost not tracked');
    return;
  }

  try {
    const totalKey = getWorkspaceKey(workspaceId, `cost:${month}:total`);
    const providerKey = getWorkspaceKey(workspaceId, `cost:${month}:provider:${provider}`);
    const modelKey = getWorkspaceKey(workspaceId, `cost:${month}:model:${model}`);

    // Convert to cents to avoid floating point issues
    const costCents = Math.round(cost * 100);

    await kv.incrby(totalKey, costCents);
    await kv.incrby(providerKey, costCents);
    await kv.incrby(modelKey, costCents);
  } catch (error) {
    console.error('Failed to increment workspace cost:', error);
  }
}

/**
 * Get cost stats for workspace
 */
export async function getWorkspaceCostStats(
  workspaceId: string,
  month: string
): Promise<CostStats> {
  const defaultStats: CostStats = {
    currentMonth: month,
    totalCost: 0,
    byProvider: {},
    byModel: {},
  };

  if (!isKVAvailable()) {
    return defaultStats;
  }

  try {
    const totalKey = getWorkspaceKey(workspaceId, `cost:${month}:total`);
    const total = await kv.get<number>(totalKey);

    const byProvider: Record<string, number> = {};
    const providers = ['openai', 'anthropic', 'gemini', 'deepseek'];

    for (const provider of providers) {
      const value = await kv.get<number>(
        getWorkspaceKey(workspaceId, `cost:${month}:provider:${provider}`)
      );
      if (value) {
        byProvider[provider] = value / 100;
      }
    }

    return {
      currentMonth: month,
      totalCost: (total || 0) / 100,
      byProvider,
      byModel: {},
    };
  } catch (error) {
    console.error('Failed to get workspace cost stats:', error);
    return defaultStats;
  }
}

/**
 * List all workspaces
 */
export async function listWorkspaces(): Promise<string[]> {
  if (!isKVAvailable()) {
    return [DEFAULT_WORKSPACE_ID];
  }

  try {
    const workspaces = await kv.smembers('workspaces:list');
    return workspaces as string[];
  } catch (error) {
    console.error('Failed to list workspaces:', error);
    return [];
  }
}

// ===========================
// Validation Config (Threshold Blackboxing)
// ===========================

/**
 * Get validation config for a workspace
 */
export async function getValidationConfig(
  workspaceId: string,
  configType: 'threshold' | 'scoring_weights' | 'risk_levels'
): Promise<ValidationConfig | null> {
  if (!isKVAvailable()) {
    return null;
  }

  try {
    const key = getValidationConfigKey(workspaceId, configType);
    return await kv.get<ValidationConfig>(key);
  } catch (error) {
    console.error('Failed to get validation config:', error);
    return null;
  }
}

/**
 * Save validation config for a workspace
 */
export async function saveValidationConfig(config: ValidationConfig): Promise<void> {
  if (!isKVAvailable()) {
    console.warn('KV not configured, validation config not persisted');
    return;
  }

  try {
    const key = getValidationConfigKey(config.workspaceId, config.configType);
    await kv.set(key, config);
  } catch (error) {
    console.error('Failed to save validation config:', error);
    throw new Error('Validation config save failed');
  }
}

/**
 * Get all validation configs for a workspace
 */
export async function getAllValidationConfigs(
  workspaceId: string
): Promise<ValidationConfig[]> {
  const configTypes: Array<'threshold' | 'scoring_weights' | 'risk_levels'> = [
    'threshold',
    'scoring_weights',
    'risk_levels'
  ];

  const configs = await Promise.all(
    configTypes.map(type => getValidationConfig(workspaceId, type))
  );

  return configs.filter((c): c is ValidationConfig => c !== null);
}

/**
 * Delete validation config for a workspace
 */
export async function deleteValidationConfig(
  workspaceId: string,
  configType: 'threshold' | 'scoring_weights' | 'risk_levels'
): Promise<void> {
  if (!isKVAvailable()) {
    return;
  }

  try {
    const key = getValidationConfigKey(workspaceId, configType);
    await kv.del(key);
  } catch (error) {
    console.error('Failed to delete validation config:', error);
    throw new Error('Validation config delete failed');
  }
}

// ===========================
// Trace Feedback
// ===========================

/**
 * Save feedback for a trace
 */
export async function saveFeedback(feedback: TraceFeedback): Promise<void> {
  if (!isKVAvailable()) {
    console.warn('KV not configured, feedback not persisted');
    return;
  }

  try {
    const feedbackKey = getFeedbackKey(feedback.id);
    await kv.set(feedbackKey, feedback, { ex: 60 * 60 * 24 * 90 }); // 90 days

    // Index by trace
    const traceKey = getFeedbackByTraceKey(feedback.traceId);
    await kv.sadd(traceKey, feedback.id);

    // Index by workspace (for stats)
    const workspaceKey = getWorkspaceFeedbackIndexKey(feedback.workspaceId);
    await kv.zadd(workspaceKey, {
      score: Date.now(),
      member: feedback.id,
    });
  } catch (error) {
    console.error('Failed to save feedback:', error);
    throw new Error('Feedback save failed');
  }
}

/**
 * Get feedback by ID
 */
export async function getFeedback(feedbackId: string): Promise<TraceFeedback | null> {
  if (!isKVAvailable()) {
    return null;
  }

  try {
    return await kv.get<TraceFeedback>(getFeedbackKey(feedbackId));
  } catch (error) {
    console.error('Failed to get feedback:', error);
    return null;
  }
}

/**
 * Get all feedback for a trace
 */
export async function getFeedbackByTrace(traceId: string): Promise<TraceFeedback[]> {
  if (!isKVAvailable()) {
    return [];
  }

  try {
    const traceKey = getFeedbackByTraceKey(traceId);
    const feedbackIds = await kv.smembers(traceKey);

    if (!feedbackIds.length) return [];

    const feedbacks = await Promise.all(
      feedbackIds.map(id => kv.get<TraceFeedback>(getFeedbackKey(id as string)))
    );

    return feedbacks.filter((f): f is TraceFeedback => f !== null);
  } catch (error) {
    console.error('Failed to get feedback by trace:', error);
    return [];
  }
}

/**
 * Get all feedback for a workspace
 */
export async function getWorkspaceFeedback(
  workspaceId: string,
  limit = 100,
  offset = 0
): Promise<TraceFeedback[]> {
  if (!isKVAvailable()) {
    return [];
  }

  try {
    const workspaceKey = getWorkspaceFeedbackIndexKey(workspaceId);
    const feedbackIds = await kv.zrange(workspaceKey, offset, offset + limit - 1, { rev: true });

    if (!feedbackIds.length) return [];

    const feedbacks = await Promise.all(
      feedbackIds.map(id => kv.get<TraceFeedback>(getFeedbackKey(id as string)))
    );

    return feedbacks.filter((f): f is TraceFeedback => f !== null);
  } catch (error) {
    console.error('Failed to get workspace feedback:', error);
    return [];
  }
}

/**
 * Get feedback statistics for a workspace
 */
export async function getFeedbackStats(
  workspaceId: string
): Promise<{
  total: number;
  byType: {
    false_positive: number;
    false_negative: number;
    correct: number;
  };
}> {
  const defaultStats = {
    total: 0,
    byType: {
      false_positive: 0,
      false_negative: 0,
      correct: 0,
    },
  };

  if (!isKVAvailable()) {
    return defaultStats;
  }

  try {
    const feedbacks = await getWorkspaceFeedback(workspaceId, 1000);

    const stats = {
      total: feedbacks.length,
      byType: {
        false_positive: feedbacks.filter(f => f.feedbackType === 'false_positive').length,
        false_negative: feedbacks.filter(f => f.feedbackType === 'false_negative').length,
        correct: feedbacks.filter(f => f.feedbackType === 'correct').length,
      },
    };

    return stats;
  } catch (error) {
    console.error('Failed to get feedback stats:', error);
    return defaultStats;
  }
}

// ===========================
// Trace Evaluation Update
// ===========================

import type { EvaluationResult } from '../evaluation/types.js';

/**
 * Update trace with evaluation results
 * Used by the LLM-as-Judge evaluation system
 */
export async function updateTraceEvaluation(
  workspaceId: string,
  traceId: string,
  evaluation: EvaluationResult
): Promise<void> {
  if (!isKVAvailable()) {
    console.warn('KV not configured, evaluation not persisted');
    return;
  }

  try {
    // Find the trace key from the index
    const indexKey = getWorkspaceKey(workspaceId, 'traces:index');
    const traceKeys = await kv.zrange(indexKey, 0, -1, { rev: true });

    // Find the matching trace key by checking each one
    for (const key of traceKeys) {
      const trace = await kv.get<Record<string, unknown>>(key as string);
      if (trace && (trace.requestId === traceId || (key as string).includes(traceId))) {
        // Update the trace with evaluation
        const updatedTrace = { ...trace, evaluation };
        await kv.set(key as string, updatedTrace, { ex: 60 * 60 * 24 * 30 }); // 30 days
        console.log(`[KV] Updated trace ${traceId} with evaluation`);
        return;
      }
    }

    console.warn(`[KV] Trace ${traceId} not found for evaluation update`);
  } catch (error) {
    console.error('Failed to update trace evaluation:', error);
  }
}
