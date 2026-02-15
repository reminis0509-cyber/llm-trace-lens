export interface StructuredResponse {
  thinking: string;
  confidence: number;
  evidence: string[];
  risks: string[];
  answer: string;
}

export type ValidationLevel = 'PASS' | 'WARN' | 'FAIL' | 'BLOCK';

export interface RuleResult {
  ruleName: string;
  level: ValidationLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  overall: ValidationLevel;
  score: number;
  rules: RuleResult[];
}

export interface Trace {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  prompt: string;
  rawResponse: string;
  structured: StructuredResponse;
  validation: ValidationResult;
  latencyMs: number;
  tokensUsed: number;
}

export interface TraceListResponse {
  traces: Trace[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProviderStats {
  provider: string;
  model: string;
  count: number;
  avgScore: number;
  avgLatency: number;
  totalTokens: number;
}

export interface StatsResponse {
  stats: ProviderStats[];
}
