/**
 * FujiTrace Contract-Based Agent — shared types.
 *
 * Corresponds to the SSE event contract documented in the plan.
 */

/** A single step in the LLM-generated Plan. */
export interface AgentPlanStep {
  /** Whitelisted tool ID; must pass `isAllowedAgentTool`. */
  tool: string;
  /** Why the planner chose this tool (one Japanese sentence). */
  reason: string;
  /** Optional hint for the tool-input builder LLM. */
  inputHint?: string;
}

/** The full Plan returned by the planner LLM. */
export interface AgentPlan {
  /** User-facing summary of what the agent intends to do. */
  summary: string;
  /** Ordered list of steps; max 5. */
  steps: AgentPlanStep[];
}

/** Runtime status of a single Execute step. */
export type StepStatus = 'pending' | 'running' | 'ok' | 'failed' | 'skipped';

/** Mutable per-step state kept by the executor. */
export interface AgentStepState {
  index: number;
  tool: string;
  status: StepStatus;
  result?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

/** Caller input to `executeContractAgent`. */
export interface AgentRunInput {
  /** User free-text message. */
  message: string;
  /** Optional existing conversation id (future multi-turn). */
  conversationId?: string;
  /** Owning workspace — required for quota + tool dispatch. */
  workspaceId: string;
  /** Cached company basics (address, bank, invoice_number, …). */
  companyInfo?: Record<string, unknown>;
}

/** An attachment surfaced in the `final` event (PDF link, etc.). */
export interface AgentAttachment {
  kind: string;
  url?: string;
  filename?: string;
}

/** The SSE event contract yielded by `executeContractAgent`. */
export type AgentSseEvent =
  | { type: 'run_started'; runId: string }
  | { type: 'plan'; plan: AgentPlan }
  | { type: 'step_start'; stepIndex: number; tool: string }
  | {
      type: 'step_result';
      stepIndex: number;
      status: 'ok' | 'failed';
      result?: unknown;
      error?: string;
    }
  | { type: 'question'; stepIndex: number; question: string }
  | {
      type: 'review';
      status: 'ok' | 'warning' | 'failed';
      arithmeticOk?: boolean;
      notes?: string;
    }
  | { type: 'final'; reply: string; attachments?: AgentAttachment[] }
  | {
      type: 'error';
      code:
        | 'CONTRACT_VIOLATION'
        | 'PLAN_PARSE_FAILED'
        | 'TIMEOUT'
        | 'INTERNAL'
        | 'TOOL_FAILED';
      message: string;
      stepIndex?: number;
    };
