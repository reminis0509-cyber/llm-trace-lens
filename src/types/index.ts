import { EvaluationResult } from '../evaluation/types.js';

// ─── 評価指標型定義 ──────────────────────────────────────────────────────────

/** パターンマッチベースの評価結果（スコア付き） */
export interface EvaluationScoreResult {
  /** 0.0〜1.0 のリスクスコア */
  score: number;
  /** 閾値を超えてフラグが立ったか */
  flagged: boolean;
  /** マッチしたパターン等の詳細（UIのツールチップで表示） */
  details?: string;
  /** マッチしたパターン一覧 */
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
  /** 検出された出力言語（ISO 639-3: 'jpn', 'eng' など） */
  detectedOutputLang?: string;
  /** 入力から期待される言語 */
  expectedLang?: string;
  details?: string;
}

/** トレースに付与される評価結果の全体型 */
export interface TraceEvaluations {
  /** 出力の有害性（暴力・ヘイト・差別など） */
  toxicity?: EvaluationScoreResult;
  /** プロンプトインジェクション（入力がシステムプロンプトを上書きしようとしているか） */
  promptInjection?: EvaluationScoreResult;
  /** 回答拒否検出 */
  failureToAnswer?: EvaluationFlagResult;
  /** 入力・出力の言語不一致 */
  languageMismatch?: LanguageMismatchResult;
  /** 評価実行時のメタ情報 */
  meta?: {
    evaluatedAt: string;
    durationMs: number;
    enabledChecks: string[];
    errors?: Record<string, string>;
  };
  // フェーズ2: LLM-as-Judge 評価
  // topicRelevancy?: EvaluationScoreResult;
  // sentiment?: EvaluationScoreResult;
  // rag?: { faithfulness?: number; relevance?: number; };
}

/** 評価オプション（ワークスペース設定から渡される） */
export interface EvaluationOptions {
  enableToxicity: boolean;
  enablePromptInjection: boolean;
  enableFailureToAnswer: boolean;
  enableLanguageMismatch: boolean;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

// Legacy StructuredResponse (for existing code compatibility)
export interface LegacyStructuredResponse {
  thinking: string;
  confidence: number;
  evidence: string[];
  risks: string[];
  answer: string;
}

// New StructuredResponse (for MVP tests and new handlers)
export interface StructuredResponse {
  answer: string;
  confidence: number;
  evidence: string[];
  alternatives: string[];
}

export type Provider = 'openai' | 'anthropic' | 'gemini';

// ─── Agent Trace Types ──────────────────────────────────────────────────────

/** トレースタイプ識別子 */
export type TraceType = 'standard' | 'agent';

/** ツール呼び出しの詳細 */
export interface ToolCall {
  /** ツール呼び出しID */
  id: string;
  /** ツール名（例: "web_search", "calculator"） */
  name: string;
  /** ツール引数 */
  arguments: Record<string, unknown>;
  /** ツール実行結果 */
  result?: unknown;
  /** エラーがあった場合 */
  error?: string;
  /** 開始時刻（ISO 8601） */
  startedAt: string;
  /** 完了時刻 */
  completedAt?: string;
  /** 実行時間（ミリ秒） */
  durationMs?: number;
}

/** エージェントの1ステップ（ReAct形式） */
export interface AgentStep {
  /** ステップ番号（0から開始） */
  stepIndex: number;
  /** 思考プロセス（Thought） */
  thought: string;
  /** 決定されたアクション */
  action: string;
  /** このステップでのツール呼び出し */
  toolCalls: ToolCall[];
  /** ツール実行後の観察結果（Observation） */
  observation: string;
  /** ステップ開始時刻 */
  timestamp: string;
  /** ステップ全体の実行時間（ミリ秒） */
  durationMs: number;
}

/** エージェントトレース全体 */
export interface AgentTrace {
  /** エージェントID（オプション） */
  agentId?: string;
  /** エージェント名（オプション） */
  agentName?: string;
  /** 最終目標/タスク */
  goal: string;
  /** 実行ステップの配列 */
  steps: AgentStep[];
  /** 最終回答 */
  finalAnswer?: string;
  /** 全体の実行時間（ミリ秒） */
  totalDurationMs: number;
  /** 総ステップ数 */
  stepCount: number;
  /** 総ツール呼び出し数 */
  toolCallCount: number;
  /** 実行ステータス */
  status: 'completed' | 'failed' | 'in_progress';
  /** エラーがあった場合 */
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface LLMRequest {
  provider?: Provider;
  model?: string;
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  api_key?: string; // Direct API key for provider (e.g., OpenAI key)
  /** トレースタイプ（'standard' | 'agent'） */
  traceType?: TraceType;
  /** エージェントトレース（traceType='agent'時に使用） */
  agentTrace?: AgentTrace;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Enforcer result wrapping a StructuredResponse with optional token usage data.
 * Returned by all enforcer enforce() methods so that callers can access usage info.
 */
export interface EnforcerResult {
  response: StructuredResponse;
  usage?: Usage;
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

/**
 * 内部トレース（L3/L4用の口）
 * 現在はnull、将来ベンダーAPIから取得
 */
export interface InternalTrace {
  activations?: number[];
  attentionWeights?: Record<string, number>;
  internalConfidence?: number;
  reasoningSteps?: string[];
}

/**
 * トレースレコード（DB保存用 - Legacy）
 */
export interface Trace {
  id: string;
  timestamp: Date;
  provider: LLMProvider;
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  rawResponse: string;
  structured: LegacyStructuredResponse;
  validation: ValidationResult;
  internalTrace?: InternalTrace | null;
  latencyMs: number;
  tokensUsed: number;
  cost?: number;
  evaluation?: EvaluationResult;
  /** パターンマッチベースの評価結果（フェーズ1 MVP） */
  evaluations?: TraceEvaluations;
  /** RAG評価用：検索で使用されたコンテキストチャンク（フェーズ2で活用） */
  contexts?: string[];
  /** トレースタイプ（'standard' | 'agent'） */
  traceType?: TraceType;
  /** エージェントトレース（traceType='agent'時に使用） */
  agentTrace?: AgentTrace;
}

export type LLMProvider = 'openai' | 'anthropic' | 'gemini';

/**
 * 検証ルールの共通インターフェース（Legacy）
 */
export interface ValidationRule {
  name: string;
  validate(
    structured: LegacyStructuredResponse,
    internalTrace: InternalTrace | null
  ): Promise<RuleResult>;
}
