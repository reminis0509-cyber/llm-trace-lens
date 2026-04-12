/**
 * Skeleton Trace types for step-by-step execution recording.
 *
 * A SkeletonTrace captures the timing, cost, and metadata for each phase
 * of an office-task execution so the dashboard can render a transparent
 * breakdown of what the AI did.
 */

export interface SkeletonStep {
  index: number;
  name: string;        // e.g. '入力データ受信', '算術検証', 'AI品質チェック'
  status: 'completed' | 'error';
  durationMs: number;
  details?: Record<string, unknown>;  // flexible per-step metadata
}

export interface SkeletonTrace {
  taskId: string;
  taskName: string;
  steps: SkeletonStep[];
  totalDurationMs: number;
  totalCostYen?: number;
  model?: string;
  tokenUsage?: { input: number; output: number };
}
