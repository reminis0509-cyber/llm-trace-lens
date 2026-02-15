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

export interface EvaluationResult {
  faithfulness: number | null;
  answerRelevance: number | null;
  evaluatedAt: string;
  evaluationModel: string;
  error?: string;
}

/** パターンマッチベースの評価結果（スコア付き） */
export interface EvaluationScoreResult {
  score: number;
  flagged: boolean;
  details?: string;
  matchedPatterns?: string[];
}

/** フラグのみの評価結果（スコアなし） */
export interface EvaluationFlagResult {
  flagged: boolean;
  details?: string;
}

/** 言語不一致の評価結果 */
export interface LanguageMismatchResult {
  flagged: boolean;
  detectedOutputLang?: string;
  expectedLang?: string;
  details?: string;
}

/** パターンマッチベース評価結果（フェーズ1 MVP） */
export interface TraceEvaluations {
  toxicity?: EvaluationScoreResult;
  promptInjection?: EvaluationScoreResult;
  failureToAnswer?: EvaluationFlagResult;
  languageMismatch?: LanguageMismatchResult;
  meta?: {
    evaluatedAt: string;
    durationMs: number;
    enabledChecks: string[];
    errors?: Record<string, string>;
  };
}

// ─── Agent Trace Types ──────────────────────────────────────────────────────

/** トレースタイプ識別子 */
export type TraceType = 'standard' | 'agent';

/** ツール呼び出しの詳細 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

/** エージェントの1ステップ（ReAct形式） */
export interface AgentStep {
  stepIndex: number;
  thought: string;
  action: string;
  toolCalls: ToolCall[];
  observation: string;
  timestamp: string;
  durationMs: number;
}

/** エージェントトレース全体 */
export interface AgentTrace {
  agentId?: string;
  agentName?: string;
  goal: string;
  steps: AgentStep[];
  finalAnswer?: string;
  totalDurationMs: number;
  stepCount: number;
  toolCallCount: number;
  status: 'completed' | 'failed' | 'in_progress';
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

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
  evaluation?: EvaluationResult;
  /** パターンマッチベース評価結果（フェーズ1 MVP） */
  evaluations?: TraceEvaluations;
  /** トレースタイプ（'standard' | 'agent'） */
  traceType?: TraceType;
  /** エージェントトレース（traceType='agent'時に使用） */
  agentTrace?: AgentTrace;
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
