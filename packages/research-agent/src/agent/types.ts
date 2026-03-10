/** 調査エージェントへの入力パラメータ */
export interface ResearchInput {
  /** 調査テーマ e.g. "LLMオブザーバビリティ市場" */
  topic: string;
  /** 調査の目的 e.g. "競合分析のため" */
  purpose: string;
  /** 特に知りたいこと (optional) */
  focusAreas?: string;
  /** 依頼者情報 (optional, for PII detection demo) */
  requesterInfo?: string;
}

/** エージェントの各ステップの状態 */
export interface AgentStep {
  stepNumber: number;
  type: 'think' | 'search' | 'analyze' | 'report';
  description: string;
  input?: string;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startedAt?: string;
  completedAt?: string;
  tokenUsage?: { prompt: number; completion: number; total: number };
  cost?: number;
}

/** 最終的な調査レポート */
export interface ResearchReport {
  title: string;
  markdown: string;
  steps: AgentStep[];
  totalCost: number;
  totalTokens: number;
  totalDuration: number;
}

/** ステップ更新コールバック */
export type OnStepUpdate = (step: AgentStep) => void;

/**
 * OpenAI Chat Completions API のレスポンス型
 * FujiTrace proxy 経由で返却される形式
 */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** LLM呼び出し時のエージェントトレースメタデータ */
export interface AgentTraceMetadata {
  agentId: string;
  agentName: string;
  goal: string;
  steps: Array<{
    stepIndex: number;
    thought: string;
    action: string;
    toolCalls?: Array<{
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }>;
    observation?: string;
    timestamp: string;
    durationMs?: number;
  }>;
  status: 'in_progress' | 'completed' | 'failed';
  stepCount: number;
  toolCallCount: number;
}
