import { EvaluationResult } from '../evaluation/types.js';

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

export type Provider = 'openai' | 'anthropic' | 'gemini' | 'deepseek';

export interface LLMRequest {
  provider?: Provider;
  model?: string;
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
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
}

export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'deepseek';

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
