/* ------------------------------------------------------------------ */
/*  ToolCallTrace — multi-step trace animation for tool calls          */
/*  Renders inside the chat bubble when a tool_start SSE event fires.  */
/*  Shows timed steps with spinner/check/error indicators, elapsed     */
/*  time counter, and plays Web Audio API sounds at key moments.       */
/* ------------------------------------------------------------------ */

import { useState, useEffect, useRef } from 'react';
import { Loader2, Check, CheckCircle2, XCircle } from 'lucide-react';
import {
  playStepCompleteSound,
  playCompletionSound,
  playErrorSound,
} from '../utils/stepSound';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type TraceStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface TraceStep {
  label: string;
  status: TraceStepStatus;
  startedAt?: number;
  completedAt?: number;
}

export interface ToolCallTraceState {
  tool: string;
  index: number;
  status: 'running' | 'ok' | 'error';
  startedAt: number;
  steps: TraceStep[];
  currentStepIndex: number;
  result?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DOC_TYPE_LABELS: Record<string, string> = {
  'estimate.create': '見積書',
  'estimate.check': '見積書',
  'accounting.invoice_create': '請求書',
  'accounting.invoice_check': '請求書',
  'accounting.delivery_note_create': '納品書',
  'accounting.purchase_order_create': '発注書',
  'general_affairs.cover_letter_create': '送付状',
};

const CREATE_TOOLS = new Set([
  'estimate.create',
  'accounting.invoice_create',
  'accounting.delivery_note_create',
  'accounting.purchase_order_create',
  'general_affairs.cover_letter_create',
]);

const CHECK_TOOLS = new Set([
  'estimate.check',
  'accounting.invoice_check',
]);

/** Step definitions with delay before auto-advancing (in ms). */
function buildSteps(tool: string): { label: string; delay: number }[] {
  const docType = DOC_TYPE_LABELS[tool] || '書類';

  if (CREATE_TOOLS.has(tool)) {
    return [
      { label: '入力データを受信中...', delay: 800 },
      { label: `AIが${docType}を生成中...`, delay: 2000 },
      { label: '出力を検証中...', delay: 1000 },
    ];
  }

  if (CHECK_TOOLS.has(tool)) {
    return [
      { label: '入力を解析中...', delay: 800 },
      { label: '会社名・金額を抽出中...', delay: 1500 },
      { label: `${docType}を検証中...`, delay: 2000 },
      { label: '出力を検証中...', delay: 1000 },
    ];
  }

  // Fallback for unknown tools
  return [
    { label: '処理を実行中...', delay: 2000 },
  ];
}

/* ------------------------------------------------------------------ */
/*  Factory: create initial ToolCallTraceState                         */
/* ------------------------------------------------------------------ */

export function createToolCallTraceState(
  tool: string,
  index: number,
): ToolCallTraceState {
  const stepDefs = buildSteps(tool);
  const now = Date.now();

  const steps: TraceStep[] = stepDefs.map((def, i) => ({
    label: def.label,
    status: i === 0 ? 'running' : 'pending',
    startedAt: i === 0 ? now : undefined,
  }));

  // Add final "完了" step as pending
  steps.push({
    label: '完了',
    status: 'pending',
  });

  return {
    tool,
    index,
    status: 'running',
    startedAt: now,
    steps,
    currentStepIndex: 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Hook: useToolCallTraceAnimation                                    */
/*  Drives auto-advancing steps via timeouts, handles tool_result.     */
/* ------------------------------------------------------------------ */

export function useToolCallTraceAnimation(
  traceState: ToolCallTraceState | null,
  onUpdate: (updated: ToolCallTraceState) => void,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(traceState);
  stateRef.current = traceState;

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Schedule auto-advance when currentStepIndex or status changes
  useEffect(() => {
    if (!traceState) return;
    if (traceState.status !== 'running') return;

    const stepDefs = buildSteps(traceState.tool);
    const currentIdx = traceState.currentStepIndex;

    // Don't auto-advance the final "完了" step or beyond defined steps
    if (currentIdx >= stepDefs.length) return;

    const delay = stepDefs[currentIdx].delay;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const current = stateRef.current;
      if (!current || current.status !== 'running') return;
      if (current.currentStepIndex !== currentIdx) return;

      // Complete the current step
      const newSteps = [...current.steps];
      newSteps[currentIdx] = {
        ...newSteps[currentIdx],
        status: 'done',
        completedAt: Date.now(),
      };

      const nextIdx = currentIdx + 1;
      const isLastProcessingStep = nextIdx >= stepDefs.length;

      if (isLastProcessingStep) {
        // We've finished all processing steps; wait for tool_result to mark "完了"
        playStepCompleteSound();
        onUpdateRef.current({
          ...current,
          steps: newSteps,
          currentStepIndex: nextIdx,
        });
      } else {
        // Start the next step
        newSteps[nextIdx] = {
          ...newSteps[nextIdx],
          status: 'running',
          startedAt: Date.now(),
        };
        playStepCompleteSound();
        onUpdateRef.current({
          ...current,
          steps: newSteps,
          currentStepIndex: nextIdx,
        });
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [traceState?.currentStepIndex, traceState?.status, traceState?.tool]);
}

/* ------------------------------------------------------------------ */
/*  completeAllSteps — called when tool_result arrives                  */
/* ------------------------------------------------------------------ */

export function completeAllSteps(
  state: ToolCallTraceState,
  resultStatus: 'ok' | 'error',
  result?: Record<string, unknown>,
): ToolCallTraceState {
  const now = Date.now();
  const newSteps = state.steps.map((step, i) => {
    if (step.status === 'done') return step;

    // Last step is "完了"
    const isLastStep = i === state.steps.length - 1;

    if (resultStatus === 'error' && step.status === 'running') {
      return { ...step, status: 'error' as const, completedAt: now };
    }

    if (resultStatus === 'ok') {
      return {
        ...step,
        status: 'done' as const,
        completedAt: now,
        startedAt: step.startedAt || now,
      };
    }

    // Error: mark remaining pending steps as done (skip them) except show error on active
    if (isLastStep && resultStatus === 'error') {
      return { ...step, status: 'error' as const, completedAt: now };
    }

    return { ...step, status: 'done' as const, completedAt: now };
  });

  if (resultStatus === 'ok') {
    playCompletionSound();
  } else {
    playErrorSound();
  }

  return {
    ...state,
    status: resultStatus,
    steps: newSteps,
    currentStepIndex: state.steps.length - 1,
    result,
  };
}

/* ------------------------------------------------------------------ */
/*  Elapsed seconds hook (per-step)                                    */
/* ------------------------------------------------------------------ */

function useStepElapsed(active: boolean, startTime?: number): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(startTime || Date.now());

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    startRef.current = startTime || Date.now();
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active, startTime]);

  return elapsed;
}

/* ------------------------------------------------------------------ */
/*  StepRow                                                            */
/* ------------------------------------------------------------------ */

function StepRow({ step, isLast }: { step: TraceStep; isLast: boolean }) {
  const isRunning = step.status === 'running';
  const isDone = step.status === 'done';
  const isError = step.status === 'error';
  const isPending = step.status === 'pending';
  const elapsed = useStepElapsed(isRunning, step.startedAt);

  // Timeline node
  const nodeClasses = isPending
    ? 'border-slate-300 bg-white'
    : isRunning
      ? 'border-blue-500 bg-blue-50'
      : isError
        ? 'border-red-500 bg-red-50'
        : 'border-green-500 bg-green-50';

  return (
    <div className="flex items-start gap-3 relative">
      {/* Vertical connector line */}
      {!isLast && (
        <div
          className={`absolute left-[9px] top-5 bottom-0 w-px ${
            isDone || isError ? 'bg-slate-200' : 'bg-slate-200'
          }`}
          aria-hidden="true"
        />
      )}

      {/* Circle node */}
      <div className="flex-shrink-0 relative z-10 mt-0.5">
        <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${nodeClasses}`}>
          {isRunning && (
            <Loader2 className="w-2.5 h-2.5 text-blue-500 animate-spin" strokeWidth={2.5} />
          )}
          {isDone && (
            <Check className="w-2.5 h-2.5 text-green-600" strokeWidth={3} />
          )}
          {isError && (
            <span className="w-2.5 h-2.5 text-red-500 flex items-center justify-center text-[10px] font-bold leading-none">!</span>
          )}
        </div>
      </div>

      {/* Step label */}
      <div className={`flex items-center gap-2 min-h-[28px] ${
        isPending ? 'text-slate-400' :
        isRunning ? 'text-slate-600' :
        isError ? 'text-red-600' :
        isLast ? 'text-green-600 font-medium' : 'text-slate-600'
      }`}>
        <span className="text-sm leading-tight">{step.label}</span>
        {isRunning && elapsed > 0 && (
          <span className="text-xs text-blue-500 font-mono tabular-nums">{elapsed}s</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ToolCallTrace — main component                                     */
/* ------------------------------------------------------------------ */

interface ToolCallTraceProps {
  traceState: ToolCallTraceState;
  onTraceUpdate: (updated: ToolCallTraceState) => void;
}

export default function ToolCallTrace({ traceState, onTraceUpdate }: ToolCallTraceProps) {
  // Drive the animation
  useToolCallTraceAnimation(
    traceState.status === 'running' ? traceState : null,
    onTraceUpdate,
  );

  const docType = DOC_TYPE_LABELS[traceState.tool] || '処理';
  const isDone = traceState.status === 'ok';
  const isError = traceState.status === 'error';

  return (
    <div className={`rounded-lg border p-4 mb-2 ${
      isDone ? 'bg-green-50/50 border-green-200' :
      isError ? 'bg-red-50/50 border-red-200' :
      'bg-slate-50 border-slate-200'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        {isDone && (
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" strokeWidth={1.5} />
        )}
        {isError && (
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" strokeWidth={1.5} />
        )}
        {traceState.status === 'running' && (
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" strokeWidth={1.5} />
        )}
        <span className={`text-xs font-medium ${
          isDone ? 'text-green-700' :
          isError ? 'text-red-700' :
          'text-slate-700'
        }`}>
          {docType}
          {isDone ? ' - 完了' : isError ? ' - エラー' : ''}
        </span>
      </div>

      {/* Steps timeline */}
      <div className="space-y-2 pl-0.5">
        {traceState.steps.map((step, i) => (
          <StepRow
            key={i}
            step={step}
            isLast={i === traceState.steps.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
