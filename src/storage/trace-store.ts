import { getDatabase } from './db.js';
import { saveTrace as saveTraceKV, getTraces as getTracesKV, getTraceById as getTraceByIdKV } from '../kv/client.js';

export interface TraceRecord {
  requestId: string;
  timestamp: string;
  provider: string;
  model: string;
  prompt: string;
  structuredResponse: {
    answer: string;
    confidence: number;
    evidence: string[];
    alternatives: string[];
  };
  validationResults: {
    confidence: { status: string; issues: string[] };
    risk: { status: string; issues: string[] };
    overall: string;
  };
  latencyMs: number;
  internalTrace: unknown | null;
}

// Check if KV is available
function isKVAvailable(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/**
 * TraceStore for MVP
 * Supports both SQLite (local) and Vercel KV (production)
 */
export class TraceStore {
  save(trace: TraceRecord): void {
    // Save to KV if available (async, fire-and-forget)
    if (isKVAvailable()) {
      saveTraceKV(trace as unknown as Record<string, unknown>).catch(err => {
        console.error('Failed to save trace to KV:', err);
      });
    }

    // Also save to SQLite if available (for local development)
    try {
      const db = getDatabase();

      const stmt = db.prepare(`
        INSERT INTO traces_v2 (
          id, timestamp, provider, model,
          prompt, answer, confidence,
          evidence, alternatives,
          validation_confidence_status, validation_confidence_issues,
          validation_risk_status, validation_risk_issues,
          validation_overall,
          latency_ms, internal_trace
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?,
          ?, ?
        )
      `);

      stmt.run(
        trace.requestId,
        trace.timestamp,
        trace.provider,
        trace.model,
        trace.prompt,
        trace.structuredResponse.answer,
        trace.structuredResponse.confidence,
        JSON.stringify(trace.structuredResponse.evidence),
        JSON.stringify(trace.structuredResponse.alternatives),
        trace.validationResults.confidence.status,
        JSON.stringify(trace.validationResults.confidence.issues),
        trace.validationResults.risk.status,
        JSON.stringify(trace.validationResults.risk.issues),
        trace.validationResults.overall,
        trace.latencyMs,
        trace.internalTrace ? JSON.stringify(trace.internalTrace) : null
      );
    } catch (error) {
      // Log error but don't throw - tracing should not block responses
      console.error('Failed to save trace to SQLite:', error);
    }
  }

  findById(id: string): TraceRecord | null {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT * FROM traces_v2 WHERE id = ?').get(id) as TraceRow | undefined;

      if (!row) return null;

      return {
        requestId: row.id,
        timestamp: row.timestamp,
        provider: row.provider,
        model: row.model,
        prompt: row.prompt,
        structuredResponse: {
          answer: row.answer,
          confidence: row.confidence,
          evidence: JSON.parse(row.evidence),
          alternatives: JSON.parse(row.alternatives),
        },
        validationResults: {
          confidence: {
            status: row.validation_confidence_status,
            issues: JSON.parse(row.validation_confidence_issues),
          },
          risk: {
            status: row.validation_risk_status,
            issues: JSON.parse(row.validation_risk_issues),
          },
          overall: row.validation_overall,
        },
        latencyMs: row.latency_ms,
        internalTrace: row.internal_trace ? JSON.parse(row.internal_trace) : null,
      };
    } catch (error) {
      console.error('Failed to find trace:', error);
      return null;
    }
  }

  async findByIdAsync(id: string): Promise<TraceRecord | null> {
    // Try KV first if available
    if (isKVAvailable()) {
      const kvTrace = await getTraceByIdKV(id);
      if (kvTrace) {
        return kvTrace as unknown as TraceRecord;
      }
    }

    // Fallback to SQLite
    return this.findById(id);
  }

  async listAsync(limit = 50, offset = 0): Promise<TraceRecord[]> {
    // Try KV first if available
    if (isKVAvailable()) {
      const kvTraces = await getTracesKV(limit, offset);
      if (kvTraces.length > 0) {
        return kvTraces as unknown as TraceRecord[];
      }
    }

    // Fallback to SQLite
    try {
      const db = getDatabase();
      const rows = db.prepare(
        'SELECT * FROM traces_v2 ORDER BY timestamp DESC LIMIT ? OFFSET ?'
      ).all(limit, offset) as TraceRow[];

      return rows.map(row => ({
        requestId: row.id,
        timestamp: row.timestamp,
        provider: row.provider,
        model: row.model,
        prompt: row.prompt,
        structuredResponse: {
          answer: row.answer,
          confidence: row.confidence,
          evidence: JSON.parse(row.evidence),
          alternatives: JSON.parse(row.alternatives),
        },
        validationResults: {
          confidence: {
            status: row.validation_confidence_status,
            issues: JSON.parse(row.validation_confidence_issues),
          },
          risk: {
            status: row.validation_risk_status,
            issues: JSON.parse(row.validation_risk_issues),
          },
          overall: row.validation_overall,
        },
        latencyMs: row.latency_ms,
        internalTrace: row.internal_trace ? JSON.parse(row.internal_trace) : null,
      }));
    } catch (error) {
      console.error('Failed to list traces:', error);
      return [];
    }
  }
}

interface TraceRow {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  prompt: string;
  answer: string;
  confidence: number;
  evidence: string;
  alternatives: string;
  validation_confidence_status: string;
  validation_confidence_issues: string;
  validation_risk_status: string;
  validation_risk_issues: string;
  validation_overall: string;
  latency_ms: number;
  internal_trace: string | null;
}
