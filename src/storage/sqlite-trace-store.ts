import knex, { Knex } from 'knex';
import config from '../config/knexfile.js';
import { Trace, TraceStoreInterface } from './trace-store-interface.js';

export class SQLiteTraceStore implements TraceStoreInterface {
  private db: Knex;

  constructor() {
    this.db = knex(config.sqlite);
  }

  async initialize(): Promise<void> {
    await this.db.migrate.latest();
  }

  async saveTrace(trace: Trace): Promise<void> {
    await this.db('traces').insert({
      id: trace.id,
      timestamp: trace.timestamp.toISOString(),
      model: trace.model,
      request: JSON.stringify(trace.request),
      response: trace.response ? JSON.stringify(trace.response) : null,
      status: trace.status,
      latency_ms: trace.latency_ms,
      input_tokens: trace.input_tokens,
      output_tokens: trace.output_tokens,
      rule_result: trace.rule_result,
      rule_violations: trace.rule_violations ? JSON.stringify(trace.rule_violations) : null,
      metadata: trace.metadata ? JSON.stringify(trace.metadata) : null
    });
  }

  async getTrace(id: string): Promise<Trace | null> {
    const row = await this.db('traces').where({ id }).first();
    if (!row) return null;

    return this.deserializeTrace(row);
  }

  async queryTraces(filters: {
    startTime?: Date;
    endTime?: Date;
    model?: string;
    ruleResult?: string;
    limit?: number;
    offset?: number;
  }): Promise<Trace[]> {
    let query = this.db('traces');

    if (filters.startTime) {
      query = query.where('timestamp', '>=', filters.startTime.toISOString());
    }
    if (filters.endTime) {
      query = query.where('timestamp', '<=', filters.endTime.toISOString());
    }
    if (filters.model) {
      query = query.where('model', filters.model);
    }
    if (filters.ruleResult) {
      query = query.where('rule_result', filters.ruleResult);
    }

    query = query.orderBy('timestamp', 'desc');

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }

    const rows = await query;
    return rows.map((row: Record<string, unknown>) => this.deserializeTrace(row));
  }

  async close(): Promise<void> {
    await this.db.destroy();
  }

  private deserializeTrace(row: Record<string, unknown>): Trace {
    return {
      id: row.id as string,
      timestamp: new Date(row.timestamp as string),
      model: row.model as string,
      request: JSON.parse(row.request as string),
      response: row.response ? JSON.parse(row.response as string) : undefined,
      status: row.status as 'success' | 'error',
      latency_ms: row.latency_ms as number | undefined,
      input_tokens: row.input_tokens as number | undefined,
      output_tokens: row.output_tokens as number | undefined,
      rule_result: row.rule_result as 'PASS' | 'WARN' | 'BLOCK' | 'FAIL' | undefined,
      rule_violations: row.rule_violations ? JSON.parse(row.rule_violations as string) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
    };
  }
}
