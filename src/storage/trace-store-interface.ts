export interface Trace {
  id: string;
  timestamp: Date;
  model: string;
  request: unknown;
  response?: unknown;
  status: 'success' | 'error';
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  rule_result?: 'PASS' | 'WARN' | 'BLOCK' | 'FAIL';
  rule_violations?: unknown;
  metadata?: unknown;
}

export interface TraceStoreInterface {
  initialize(): Promise<void>;
  saveTrace(trace: Trace): Promise<void>;
  getTrace(id: string): Promise<Trace | null>;
  queryTraces(filters: {
    startTime?: Date;
    endTime?: Date;
    model?: string;
    ruleResult?: string;
    limit?: number;
    offset?: number;
  }): Promise<Trace[]>;
  close(): Promise<void>;
}
