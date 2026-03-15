/** Research agent input parameters */
export interface ResearchInput {
  /** Research topic e.g. "LLM observability market" */
  topic: string;
  /** Purpose of the research e.g. "for competitive analysis" */
  purpose?: string;
}

/** State of each agent step */
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

/** Final research report */
export interface ResearchReport {
  title: string;
  markdown: string;
  steps: AgentStep[];
  totalCost: number;
  totalTokens: number;
  totalDuration: number;
}

/** Step update callback */
export type OnStepUpdate = (step: AgentStep) => void;

/**
 * OpenAI Chat Completions API response type
 * Returned via FujiTrace proxy
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

/** Agent trace metadata sent with each LLM call */
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
