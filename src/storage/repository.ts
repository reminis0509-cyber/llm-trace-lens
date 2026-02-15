import { getDatabase } from './db.js';
import type {
  Trace,
  LegacyStructuredResponse,
  ValidationResult,
  LLMProvider,
  Usage,
} from '../types/index.js';

export interface TraceInput {
  id: string;
  provider: LLMProvider;
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  rawResponse: string;
  structured: LegacyStructuredResponse;
  validation: ValidationResult;
  usage: Usage;
  latencyMs: number;
  attempts: number;
}

export interface TraceQuery {
  limit?: number;
  offset?: number;
  provider?: LLMProvider;
  model?: string;
  validationLevel?: string;
  fromDate?: string;
  toDate?: string;
}

export interface TraceListResult {
  traces: Trace[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * トレースリポジトリ
 * SQLiteへのトレース保存・検索
 */
export class TraceRepository {
  /**
   * トレースを保存
   */
  save(input: TraceInput): Trace {
    const db = getDatabase();
    const timestamp = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO traces (
        id, timestamp, provider, model,
        prompt, system_prompt, temperature,
        raw_response,
        structured_thinking, structured_confidence,
        structured_evidence, structured_risks, structured_answer,
        validation_overall, validation_score, validation_rules,
        latency_ms, tokens_prompt, tokens_completion, tokens_total,
        attempts
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?
      )
    `);

    stmt.run(
      input.id,
      timestamp,
      input.provider,
      input.model,
      input.prompt,
      input.systemPrompt || null,
      input.temperature || null,
      input.rawResponse,
      input.structured.thinking,
      input.structured.confidence,
      JSON.stringify(input.structured.evidence),
      JSON.stringify(input.structured.risks),
      input.structured.answer,
      input.validation.overall,
      input.validation.score,
      JSON.stringify(input.validation.rules),
      input.latencyMs,
      input.usage.promptTokens,
      input.usage.completionTokens,
      input.usage.totalTokens,
      input.attempts
    );

    return this.findById(input.id)!;
  }

  /**
   * IDでトレースを取得
   */
  findById(id: string): Trace | null {
    const db = getDatabase();

    const row = db
      .prepare('SELECT * FROM traces WHERE id = ?')
      .get(id) as TraceRow | undefined;

    if (!row) return null;

    return this.rowToTrace(row);
  }

  /**
   * トレース一覧を取得
   */
  findAll(query: TraceQuery = {}): TraceListResult {
    const db = getDatabase();
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.provider) {
      conditions.push('provider = ?');
      params.push(query.provider);
    }
    if (query.model) {
      conditions.push('model = ?');
      params.push(query.model);
    }
    if (query.validationLevel) {
      conditions.push('validation_overall = ?');
      params.push(query.validationLevel);
    }
    if (query.fromDate) {
      conditions.push('timestamp >= ?');
      params.push(query.fromDate);
    }
    if (query.toDate) {
      conditions.push('timestamp <= ?');
      params.push(query.toDate);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM traces ${whereClause}`;
    const { count: total } = db.prepare(countSql).get(...params) as { count: number };

    // Get traces
    const selectSql = `
      SELECT * FROM traces
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db
      .prepare(selectSql)
      .all(...params, limit, offset) as TraceRow[];

    return {
      traces: rows.map((row) => this.rowToTrace(row)),
      total,
      limit,
      offset,
    };
  }

  /**
   * プロバイダ別の統計を取得
   */
  getStats(): ProviderStats[] {
    const db = getDatabase();

    const rows = db
      .prepare(
        `
      SELECT
        provider,
        model,
        COUNT(*) as count,
        AVG(validation_score) as avg_score,
        AVG(latency_ms) as avg_latency,
        SUM(tokens_total) as total_tokens
      FROM traces
      GROUP BY provider, model
      ORDER BY count DESC
    `
      )
      .all() as ProviderStatsRow[];

    return rows.map((row) => ({
      provider: row.provider as LLMProvider,
      model: row.model,
      count: row.count,
      avgScore: Math.round(row.avg_score * 10) / 10,
      avgLatency: Math.round(row.avg_latency),
      totalTokens: row.total_tokens,
    }));
  }

  /**
   * DBの行をTraceオブジェクトに変換
   */
  private rowToTrace(row: TraceRow): Trace {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      provider: row.provider as LLMProvider,
      model: row.model,
      prompt: row.prompt,
      systemPrompt: row.system_prompt || undefined,
      temperature: row.temperature || undefined,
      rawResponse: row.raw_response,
      structured: {
        thinking: row.structured_thinking,
        confidence: row.structured_confidence,
        evidence: JSON.parse(row.structured_evidence),
        risks: JSON.parse(row.structured_risks),
        answer: row.structured_answer,
      },
      validation: {
        overall: row.validation_overall as ValidationResult['overall'],
        score: row.validation_score,
        rules: JSON.parse(row.validation_rules),
      },
      latencyMs: row.latency_ms,
      tokensUsed: row.tokens_total || 0,
      internalTrace: row.internal_trace
        ? JSON.parse(row.internal_trace)
        : null,
    };
  }
}

interface TraceRow {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  prompt: string;
  system_prompt: string | null;
  temperature: number | null;
  raw_response: string;
  structured_thinking: string;
  structured_confidence: number;
  structured_evidence: string;
  structured_risks: string;
  structured_answer: string;
  validation_overall: string;
  validation_score: number;
  validation_rules: string;
  latency_ms: number;
  tokens_prompt: number | null;
  tokens_completion: number | null;
  tokens_total: number | null;
  attempts: number;
  internal_trace: string | null;
  created_at: string;
}

interface ProviderStatsRow {
  provider: string;
  model: string;
  count: number;
  avg_score: number;
  avg_latency: number;
  total_tokens: number;
}

export interface ProviderStats {
  provider: LLMProvider;
  model: string;
  count: number;
  avgScore: number;
  avgLatency: number;
  totalTokens: number;
}
