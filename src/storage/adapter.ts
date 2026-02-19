/**
 * Storage Adapter - Unified interface for different storage backends
 *
 * Supports:
 * - KV: Vercel KV for serverless deployments
 * - PostgreSQL: Self-hosted or managed PostgreSQL (including Supabase)
 * - SQLite: Local development
 */

import { kv } from '@vercel/kv';
import { Pool, PoolClient } from 'pg';
import { Trace, TraceStoreInterface } from './trace-store-interface.js';
import { config } from '../config.js';

export type StorageType = 'kv' | 'postgres' | 'sqlite';

import type { EvaluationResult } from '../evaluation/types.js';

export interface WorkspaceTraceRecord {
  id: string;
  workspace_id: string;
  timestamp: string;
  provider: string;
  model: string;
  prompt: string;
  response: Record<string, unknown>;
  validation_results: Record<string, unknown>;
  latency_ms: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  estimated_cost?: number;
  evaluation?: EvaluationResult;
}

export interface StorageAdapter {
  type: StorageType;

  // Trace operations
  saveTrace(trace: WorkspaceTraceRecord): Promise<void>;
  getTrace(workspaceId: string, traceId: string): Promise<WorkspaceTraceRecord | null>;
  getTraces(workspaceId: string, options?: {
    limit?: number;
    offset?: number;
    startTime?: Date;
    endTime?: Date;
    model?: string;
  }): Promise<WorkspaceTraceRecord[]>;

  // Evaluation update
  updateTraceEvaluation(workspaceId: string, traceId: string, evaluation: EvaluationResult): Promise<void>;

  // Workspace operations
  saveWorkspaceSetting(workspaceId: string, key: string, value: unknown): Promise<void>;
  getWorkspaceSetting<T>(workspaceId: string, key: string): Promise<T | null>;

  // Cost tracking
  incrementCost(workspaceId: string, month: string, provider: string, model: string, cost: number): Promise<void>;
  getCostStats(workspaceId: string, month: string): Promise<{
    totalCost: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
  }>;

  // Connection management
  initialize(): Promise<void>;
  close(): Promise<void>;
}

/**
 * KV Storage Adapter - Uses Vercel KV
 */
export class KVStorageAdapter implements StorageAdapter {
  type: StorageType = 'kv';

  async initialize(): Promise<void> {
    // KV is already initialized via environment variables
  }

  /**
   * Enforce storage limits by deleting old traces
   */
  private async _enforceStorageLimit(workspaceId: string): Promise<void> {
    try {
      const maxTraces = config.maxTraces;
      const maxAgeDays = config.maxAgeDays;

      // Calculate cutoff date for age-based deletion
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
      const cutoffTimestamp = cutoffDate.getTime();

      // Delete old traces by score (timestamp) using zremrangebyscore
      const removedByAge = await kv.zremrangebyscore(
        `workspace:${workspaceId}:traces:index`,
        0,
        cutoffTimestamp
      );

      if (removedByAge > 0) {
        console.log(`[KVStorageAdapter] Removed ${removedByAge} old traces for workspace ${workspaceId}`);
      }

      // Check count limit
      const currentCount = await kv.zcard(`workspace:${workspaceId}:traces:index`);
      if (currentCount && currentCount > maxTraces) {
        // Get oldest traces that exceed the limit
        const excessCount = currentCount - maxTraces;
        const excessTraceIds = await kv.zrange(
          `workspace:${workspaceId}:traces:index`,
          0,
          excessCount - 1
        ) as string[];

        if (excessTraceIds.length > 0) {
          // Delete excess traces
          const deletePromises = excessTraceIds.map(async (traceId) => {
            const key = `workspace:${workspaceId}:trace:${traceId}`;
            await kv.del(key);
            await kv.zrem(`workspace:${workspaceId}:traces:index`, traceId);
          });

          await Promise.all(deletePromises);
          console.log(`[KVStorageAdapter] Deleted ${excessTraceIds.length} excess traces for workspace ${workspaceId}`);
        }
      }
    } catch (error) {
      console.error('[KVStorageAdapter] Failed to enforce storage limit:', error);
      // Don't throw - let the main operation continue
    }
  }

  /**
   * Get storage usage statistics for a workspace
   */
  async getStats(workspaceId: string): Promise<{
    currentCount: number;
    maxCount: number;
    maxAgeDays: number;
    oldestDate: string | null;
  }> {
    try {
      // Get count of traces
      const count = await kv.zcard(`workspace:${workspaceId}:traces:index`);

      // Get oldest trace timestamp
      const oldestIds = await kv.zrange(
        `workspace:${workspaceId}:traces:index`,
        0,
        0,
        { withScores: true }
      );

      let oldestDate: string | null = null;
      if (oldestIds.length > 0) {
        // The result includes both member and score alternating
        const score = oldestIds[1] as number;
        oldestDate = new Date(score).toISOString();
      }

      return {
        currentCount: count || 0,
        maxCount: config.maxTraces,
        maxAgeDays: config.maxAgeDays,
        oldestDate,
      };
    } catch (error) {
      console.error('[KVStorageAdapter] Failed to get stats:', error);
      return {
        currentCount: 0,
        maxCount: config.maxTraces,
        maxAgeDays: config.maxAgeDays,
        oldestDate: null,
      };
    }
  }

  async saveTrace(trace: WorkspaceTraceRecord): Promise<void> {
    const key = `workspace:${trace.workspace_id}:trace:${trace.id}`;
    const ttlSeconds = config.maxAgeDays * 24 * 60 * 60;
    await kv.set(key, trace, { ex: ttlSeconds });

    // Add to sorted set for ordering
    await kv.zadd(
      `workspace:${trace.workspace_id}:traces:index`,
      { score: new Date(trace.timestamp).getTime(), member: trace.id }
    );

    // Enforce storage limits in background
    this._enforceStorageLimit(trace.workspace_id).catch(err => {
      console.error('[KVStorageAdapter] Background limit enforcement failed:', err);
    });
  }

  async getTrace(workspaceId: string, traceId: string): Promise<WorkspaceTraceRecord | null> {
    const key = `workspace:${workspaceId}:trace:${traceId}`;
    return await kv.get<WorkspaceTraceRecord>(key);
  }

  async getTraces(workspaceId: string, options?: {
    limit?: number;
    offset?: number;
    startTime?: Date;
    endTime?: Date;
    model?: string;
  }): Promise<WorkspaceTraceRecord[]> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const traceIds = await kv.zrange(
      `workspace:${workspaceId}:traces:index`,
      offset,
      offset + limit - 1,
      { rev: true }
    );

    if (!traceIds.length) return [];

    const traces = await Promise.all(
      traceIds.map(id => this.getTrace(workspaceId, id as string))
    );

    return traces.filter((t): t is WorkspaceTraceRecord => t !== null);
  }

  async updateTraceEvaluation(workspaceId: string, traceId: string, evaluation: EvaluationResult): Promise<void> {
    const trace = await this.getTrace(workspaceId, traceId);
    if (trace) {
      const updatedTrace = { ...trace, evaluation };
      const key = `workspace:${workspaceId}:trace:${traceId}`;
      const ttlSeconds = config.maxAgeDays * 24 * 60 * 60;
      await kv.set(key, updatedTrace, { ex: ttlSeconds });
    }
  }

  async saveWorkspaceSetting(workspaceId: string, key: string, value: unknown): Promise<void> {
    await kv.set(`workspace:${workspaceId}:setting:${key}`, value);
  }

  async getWorkspaceSetting<T>(workspaceId: string, key: string): Promise<T | null> {
    return await kv.get<T>(`workspace:${workspaceId}:setting:${key}`);
  }

  async incrementCost(workspaceId: string, month: string, provider: string, model: string, cost: number): Promise<void> {
    const costCents = Math.round(cost * 100);
    await kv.incrby(`workspace:${workspaceId}:cost:${month}:total`, costCents);
    await kv.incrby(`workspace:${workspaceId}:cost:${month}:provider:${provider}`, costCents);
    await kv.incrby(`workspace:${workspaceId}:cost:${month}:model:${model}`, costCents);
  }

  async getCostStats(workspaceId: string, month: string): Promise<{
    totalCost: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
  }> {
    const total = await kv.get<number>(`workspace:${workspaceId}:cost:${month}:total`) || 0;

    const providers = ['openai', 'anthropic', 'gemini', 'deepseek'];
    const byProvider: Record<string, number> = {};
    for (const provider of providers) {
      const cost = await kv.get<number>(`workspace:${workspaceId}:cost:${month}:provider:${provider}`);
      if (cost) byProvider[provider] = cost / 100;
    }

    return {
      totalCost: total / 100,
      byProvider,
      byModel: {} // KV doesn't easily support model enumeration
    };
  }

  async close(): Promise<void> {
    // KV doesn't require explicit close
  }
}

/**
 * PostgreSQL Storage Adapter - Uses pg Pool
 */
export class PostgresStorageAdapter implements StorageAdapter {
  type: StorageType = 'postgres';
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB || 'llm_trace_lens',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async initialize(): Promise<void> {
    // Verify connection
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }

  async saveTrace(trace: WorkspaceTraceRecord): Promise<void> {
    const query = `
      INSERT INTO traces (
        id, workspace_id, timestamp, provider, model, prompt,
        response, validation_results, latency_ms, usage, estimated_cost
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        response = EXCLUDED.response,
        validation_results = EXCLUDED.validation_results,
        latency_ms = EXCLUDED.latency_ms,
        usage = EXCLUDED.usage,
        estimated_cost = EXCLUDED.estimated_cost
    `;

    await this.pool.query(query, [
      trace.id,
      trace.workspace_id,
      trace.timestamp,
      trace.provider,
      trace.model,
      trace.prompt,
      JSON.stringify(trace.response),
      JSON.stringify(trace.validation_results),
      trace.latency_ms,
      trace.usage ? JSON.stringify(trace.usage) : null,
      trace.estimated_cost
    ]);
  }

  async getTrace(workspaceId: string, traceId: string): Promise<WorkspaceTraceRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM traces WHERE id = $1 AND workspace_id = $2',
      [traceId, workspaceId]
    );

    if (result.rows.length === 0) return null;

    return this.deserializeTrace(result.rows[0]);
  }

  async getTraces(workspaceId: string, options?: {
    limit?: number;
    offset?: number;
    startTime?: Date;
    endTime?: Date;
    model?: string;
  }): Promise<WorkspaceTraceRecord[]> {
    const conditions: string[] = ['workspace_id = $1'];
    const params: unknown[] = [workspaceId];
    let paramIndex = 2;

    if (options?.startTime) {
      conditions.push(`timestamp >= $${paramIndex}`);
      params.push(options.startTime.toISOString());
      paramIndex++;
    }

    if (options?.endTime) {
      conditions.push(`timestamp <= $${paramIndex}`);
      params.push(options.endTime.toISOString());
      paramIndex++;
    }

    if (options?.model) {
      conditions.push(`model = $${paramIndex}`);
      params.push(options.model);
      paramIndex++;
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const query = `
      SELECT * FROM traces
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.deserializeTrace(row));
  }

  async updateTraceEvaluation(workspaceId: string, traceId: string, evaluation: EvaluationResult): Promise<void> {
    const query = `
      UPDATE traces
      SET evaluation = $1::jsonb
      WHERE id = $2 AND workspace_id = $3
    `;

    await this.pool.query(query, [JSON.stringify(evaluation), traceId, workspaceId]);
  }

  async saveWorkspaceSetting(workspaceId: string, key: string, value: unknown): Promise<void> {
    const query = `
      INSERT INTO workspace_settings (workspace_id, key, value)
      VALUES ($1, $2, $3)
      ON CONFLICT (workspace_id, key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
    `;

    await this.pool.query(query, [workspaceId, key, JSON.stringify(value)]);
  }

  async getWorkspaceSetting<T>(workspaceId: string, key: string): Promise<T | null> {
    const result = await this.pool.query(
      'SELECT value FROM workspace_settings WHERE workspace_id = $1 AND key = $2',
      [workspaceId, key]
    );

    if (result.rows.length === 0) return null;

    const value = result.rows[0].value;
    return typeof value === 'string' ? JSON.parse(value) : value;
  }

  async incrementCost(workspaceId: string, month: string, provider: string, model: string, cost: number): Promise<void> {
    const query = `
      INSERT INTO workspace_costs (workspace_id, month, provider, model, cost_cents)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (workspace_id, month, provider, model) DO UPDATE SET
        cost_cents = workspace_costs.cost_cents + EXCLUDED.cost_cents
    `;

    await this.pool.query(query, [
      workspaceId,
      month,
      provider,
      model,
      Math.round(cost * 100)
    ]);
  }

  async getCostStats(workspaceId: string, month: string): Promise<{
    totalCost: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
  }> {
    const result = await this.pool.query(
      `SELECT provider, model, SUM(cost_cents) as total
       FROM workspace_costs
       WHERE workspace_id = $1 AND month = $2
       GROUP BY provider, model`,
      [workspaceId, month]
    );

    let totalCost = 0;
    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};

    for (const row of result.rows) {
      const cost = parseInt(row.total) / 100;
      totalCost += cost;

      byProvider[row.provider] = (byProvider[row.provider] || 0) + cost;
      byModel[row.model] = (byModel[row.model] || 0) + cost;
    }

    return { totalCost, byProvider, byModel };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private deserializeTrace(row: Record<string, unknown>): WorkspaceTraceRecord {
    return {
      id: row.id as string,
      workspace_id: row.workspace_id as string,
      timestamp: row.timestamp as string,
      provider: row.provider as string,
      model: row.model as string,
      prompt: row.prompt as string,
      response: typeof row.response === 'string' ? JSON.parse(row.response) : row.response as Record<string, unknown>,
      validation_results: typeof row.validation_results === 'string'
        ? JSON.parse(row.validation_results)
        : row.validation_results as Record<string, unknown>,
      latency_ms: row.latency_ms as number,
      usage: row.usage ? (typeof row.usage === 'string' ? JSON.parse(row.usage) : row.usage) : undefined,
      estimated_cost: row.estimated_cost as number | undefined,
      evaluation: row.evaluation ? (typeof row.evaluation === 'string' ? JSON.parse(row.evaluation) : row.evaluation as EvaluationResult) : undefined
    };
  }
}

/**
 * Get the appropriate storage adapter based on configuration
 * Default: PostgreSQL (recommended for production)
 */
export function getStorageAdapter(): StorageAdapter {
  const type = (process.env.DATABASE_TYPE || 'postgres') as StorageType;

  switch (type) {
    case 'kv':
      return new KVStorageAdapter();
    case 'postgres':
    default:
      return new PostgresStorageAdapter();
  }
}

// Singleton instance
let adapterInstance: StorageAdapter | null = null;

/**
 * Get or create the storage adapter singleton
 */
export async function getAdapter(): Promise<StorageAdapter> {
  if (!adapterInstance) {
    adapterInstance = getStorageAdapter();
    await adapterInstance.initialize();
  }
  return adapterInstance;
}

/**
 * Close the storage adapter
 */
export async function closeAdapter(): Promise<void> {
  if (adapterInstance) {
    await adapterInstance.close();
    adapterInstance = null;
  }
}
