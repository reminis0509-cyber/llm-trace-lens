/* ------------------------------------------------------------------ */
/*  Agent SSE event types — mirrors backend src/agent/contract-agent.types.ts */
/*  Phase 1 of Contract-Based AI Clerk Runtime (β)                      */
/* ------------------------------------------------------------------ */

export interface AgentPlanStep {
  tool: string;
  reason: string;
  inputHint?: string;
}

export interface AgentPlan {
  summary: string;
  steps: AgentPlanStep[];
}

export interface AgentAttachment {
  url?: string;
  filename?: string;
  mime?: string;
}

export type AgentReviewStatus = 'ok' | 'warning' | 'failed';

export type AgentSseEvent =
  | { type: 'run_started'; runId: string; planLength?: number }
  | { type: 'plan'; plan: AgentPlan }
  | { type: 'step_start'; stepIndex: number; tool: string }
  | {
      type: 'step_result';
      stepIndex: number;
      status: 'ok' | 'failed';
      result?: Record<string, unknown>;
      error?: string;
    }
  | { type: 'question'; stepIndex: number; question: string }
  | {
      type: 'review';
      status: AgentReviewStatus;
      arithmeticOk?: boolean;
      notes?: string;
    }
  | {
      type: 'final';
      reply: string;
      attachments?: AgentAttachment[];
    }
  | {
      type: 'error';
      code: string;
      message: string;
      stepIndex?: number;
    };
