import { useMemo, useEffect, useRef, useState } from 'react';
import { playStepCompleteSound, playCompletionSound } from '../utils/stepSound';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface SkeletonStep {
  index: number;
  name: string;
  status: 'completed' | 'error';
  durationMs: number;
  details?: Record<string, unknown>;
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

/* ─── Streaming props (real-time SSE view) ──────────────────────────────── */

interface StreamingSkeletonTraceProps {
  /** Steps received so far (grows as SSE events arrive) */
  steps: SkeletonStep[];
  /** Known step names for this task type (shows pending steps not yet completed) */
  expectedSteps: string[];
  /** Task name to display as title */
  taskName: string;
  /** Whether execution is still in progress */
  isExecuting: boolean;
  /** Full trace data (available after completion) */
  trace: SkeletonTrace | null;
  /** Whether to play sounds (default true) */
  soundEnabled?: boolean;
  /**
   * When true, render a 2-pane "Manus's Computer" style layout: steps on the
   * left, live work pane on the right. Existing call sites remain unchanged
   * unless they opt-in. See AI Employee v2 (2026-04-20).
   */
  showLiveView?: boolean;
}

/* ─── Static props (post-completion report view) ────────────────────────── */

interface StaticSkeletonTraceProps {
  trace: SkeletonTrace | null;
  isLoading: boolean;
}

/* ─── Step detail renderer ──────────────────────────────────────────────── */

interface DetailLine {
  label: string;
  value: string;
}

function extractDetailLines(details: Record<string, unknown> | undefined): DetailLine[] {
  if (!details) return [];
  const lines: DetailLine[] = [];

  if (typeof details.model === 'string') {
    lines.push({ label: 'モデル', value: details.model });
  }

  if (
    typeof details.inputTokens === 'number' &&
    typeof details.outputTokens === 'number'
  ) {
    lines.push({
      label: 'トークン',
      value: `${details.inputTokens.toLocaleString('ja-JP')} → ${details.outputTokens.toLocaleString('ja-JP')}`,
    });
  }

  if (typeof details.costYen === 'number') {
    lines.push({ label: 'コスト', value: `¥${details.costYen.toLocaleString('ja-JP')}` });
  }

  if (typeof details.ok === 'boolean') {
    if (details.ok) {
      lines.push({ label: '結果', value: '問題なし' });
    } else {
      const issueCount =
        typeof details.issueCount === 'number'
          ? details.issueCount
          : Array.isArray(details.issues)
            ? details.issues.length
            : 0;
      lines.push({ label: '結果', value: `${issueCount}件検出` });
    }
  }

  return lines;
}

function extractIssues(details: Record<string, unknown> | undefined): string[] {
  if (!details || !Array.isArray(details.issues)) return [];
  return details.issues.filter((v): v is string => typeof v === 'string');
}

/* ─── Spinner SVG ──────────────────────────────────────────────────────── */

function Spinner() {
  return (
    <svg
      className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/* ─── Checkmark icon ───────────────────────────────────────────────────── */

function CheckIcon({ className }: { className: string }) {
  return (
    <svg
      className={`w-4 h-4 flex-shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

/* ─── Error icon ───────────────────────────────────────────────────────── */

function ErrorIcon() {
  return (
    <svg
      className="w-4 h-4 text-red-500 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

/* ─── Elapsed time hook ───────────────────────────────────────────────── */

function useElapsedSeconds(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      startRef.current = Date.now();
      return;
    }
    startRef.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  return elapsed;
}

/* ─── Pending circle icon ──────────────────────────────────────────────── */

function PendingIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-300 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
    </svg>
  );
}

/* ─── Completed step row ───────────────────────────────────────────────── */

function CompletedStepRow({ step }: { step: SkeletonStep }) {
  const isError = step.status === 'error';
  const detailLines = useMemo(() => extractDetailLines(step.details), [step.details]);
  const issues = useMemo(() => extractIssues(step.details), [step.details]);

  return (
    <div className="relative pl-8 pb-3">
      {/* Timeline dot */}
      <div
        className={`absolute left-[5px] top-1.5 w-3.5 h-3.5 rounded-full border-2 ${
          isError
            ? 'border-red-500 bg-red-50'
            : 'border-green-500 bg-green-50'
        }`}
      />

      {/* Step card */}
      <div
        className={`rounded-lg border bg-gray-50 p-3 transition-all duration-300 ${
          isError
            ? 'border-l-[3px] border-l-red-500 border-t-gray-100 border-r-gray-100 border-b-gray-100'
            : 'border-l-[3px] border-l-green-500 border-t-gray-100 border-r-gray-100 border-b-gray-100'
        }`}
      >
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isError ? <ErrorIcon /> : <CheckIcon className="text-green-500" />}
            <span className="text-sm font-medium text-gray-800">{step.name}</span>
          </div>
          <span className="text-xs text-gray-500 font-mono tabular-nums">
            {step.durationMs.toLocaleString('ja-JP')}ms
          </span>
        </div>

        {/* Detail lines */}
        {detailLines.length > 0 && (
          <div className="mt-2 space-y-0.5 pl-6">
            {detailLines.map((line) => (
              <div key={line.label} className="text-xs text-gray-500">
                <span className="text-gray-400">{line.label}:</span>{' '}
                <span className="text-gray-600">{line.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Issues sub-list */}
        {issues.length > 0 && (
          <div className="mt-1.5 pl-6 space-y-0.5">
            {issues.map((issue, i) => (
              <div key={i} className="flex gap-1.5 text-xs text-red-600">
                <span className="text-red-400 flex-shrink-0">-</span>
                <span>{issue}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── In-progress step row ─────────────────────────────────────────────── */

function InProgressStepRow({ name }: { name: string }) {
  const elapsed = useElapsedSeconds(true);
  return (
    <div className="relative pl-8 pb-3">
      <div className="absolute left-[5px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-blue-500 bg-blue-50" />
      <div className="rounded-lg border border-l-[3px] border-l-blue-500 border-t-gray-100 border-r-gray-100 border-b-gray-100 bg-blue-50/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Spinner />
            <span className="text-sm font-medium text-gray-800">{name}</span>
          </div>
          <span className="text-xs text-blue-500 font-medium font-mono tabular-nums">
            {elapsed}s
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Pending step row ─────────────────────────────────────────────────── */

function PendingStepRow({ name }: { name: string }) {
  return (
    <div className="relative pl-8 pb-3">
      <div className="absolute left-[5px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-gray-200 bg-gray-50" />
      <div className="rounded-lg border border-l-[3px] border-l-gray-200 border-t-gray-100 border-r-gray-100 border-b-gray-100 bg-gray-50/50 p-3">
        <div className="flex items-center gap-2">
          <PendingIcon />
          <span className="text-sm text-gray-400">{name}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Summary footer ───────────────────────────────────────────────────── */

function TraceSummaryFooter({ trace }: { trace: SkeletonTrace }) {
  return (
    <>
      <div className="mt-2 pt-3 border-t border-gray-100 space-y-0.5">
        <div className="flex flex-wrap gap-x-3 text-xs text-gray-500">
          <span>
            合計 {(trace.totalDurationMs / 1000).toFixed(1)}秒
          </span>
          {trace.totalCostYen != null && (
            <>
              <span className="text-gray-300">|</span>
              <span>コスト ¥{trace.totalCostYen.toLocaleString('ja-JP')}</span>
            </>
          )}
        </div>

        {(trace.model || trace.tokenUsage) && (
          <div className="flex flex-wrap gap-x-3 text-xs text-gray-400 font-mono tabular-nums">
            {trace.model && <span>{trace.model}</span>}
            {trace.tokenUsage && (
              <span>
                入力{trace.tokenUsage.input.toLocaleString('ja-JP')} / 出力{trace.tokenUsage.output.toLocaleString('ja-JP')}トークン
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
        これは直近の実行レポートです。過去の全履歴・傾向分析は{' '}
        <a href="/dashboard/traces" className="text-blue-500 hover:underline">
          FujiTrace ダッシュボード
        </a>{' '}
        で確認できます。
      </div>
    </>
  );
}

/* ─── Streaming SkeletonTrace (real-time SSE view) ──────────────────────── */

export function StreamingSkeletonTrace({
  steps,
  expectedSteps,
  taskName,
  isExecuting,
  trace,
  soundEnabled = true,
  showLiveView = false,
}: StreamingSkeletonTraceProps) {
  const prevStepCountRef = useRef(0);
  const wasExecutingRef = useRef(false);

  // Play step sound for EVERY new step, even if multiple arrive in one batch.
  // When multiple steps arrive at once (e.g. steps.length jumps from 1 to 4),
  // play a sound for each new step with a 200ms delay between them.
  useEffect(() => {
    if (!soundEnabled) {
      prevStepCountRef.current = steps.length;
      return;
    }
    const newCount = steps.length;
    const prevCount = prevStepCountRef.current;
    if (newCount > prevCount) {
      const stepsToPlay = newCount - prevCount;
      for (let i = 0; i < stepsToPlay; i++) {
        setTimeout(() => {
          playStepCompleteSound();
        }, i * 200);
      }
    }
    prevStepCountRef.current = newCount;
  }, [steps.length, soundEnabled]);

  // Play completion sound when execution finishes
  useEffect(() => {
    if (soundEnabled && wasExecutingRef.current && !isExecuting && steps.length > 0) {
      // Delay completion sound so it plays after the last step sound
      const pendingStepSounds = steps.length - (prevStepCountRef.current || 0);
      const delay = Math.max(0, pendingStepSounds) * 200 + 100;
      setTimeout(() => playCompletionSound(), delay);
    }
    wasExecutingRef.current = isExecuting;
  }, [isExecuting, soundEnabled, steps.length]);

  // Build a map of completed step indices for fast lookup
  const completedStepMap = useMemo(() => {
    const map = new Map<number, SkeletonStep>();
    for (const step of steps) {
      map.set(step.index, step);
    }
    return map;
  }, [steps]);

  // If trace is available (post-completion static view), render the full report
  if (trace && !isExecuting) {
    return (
      <div className="w-full rounded-xl border border-gray-100 bg-white p-5">
        <h3 className="text-sm font-medium text-gray-800 mb-4">{trace.taskName}</h3>
        <div className="relative">
          <div className="absolute left-[13px] top-0 bottom-0 w-px bg-gray-200" />
          {trace.steps.map((step) => (
            <CompletedStepRow key={step.index} step={step} />
          ))}
        </div>
        <TraceSummaryFooter trace={trace} />
      </div>
    );
  }

  // Streaming view: show all expected steps in different states
  const completedCount = steps.length;
  const totalElapsed = useElapsedSeconds(isExecuting);

  const stepsColumn = (
    <>
      {/* Steps timeline */}
      <div className="relative">
        <div className="absolute left-[13px] top-0 bottom-0 w-px bg-gray-200" />

        {expectedSteps.map((stepName, idx) => {
          const completedStep = completedStepMap.get(idx);

          if (completedStep) {
            // Completed: green border, checkmark, details
            return <CompletedStepRow key={idx} step={completedStep} />;
          }

          if (idx === completedCount && isExecuting) {
            // In-progress: blue border, spinner
            return <InProgressStepRow key={idx} name={stepName} />;
          }

          // Pending: gray, no details
          return <PendingStepRow key={idx} name={stepName} />;
        })}
      </div>

      {/* Summary after completion (when we have steps but trace is not yet set) */}
      {!isExecuting && steps.length > 0 && (
        <div className="mt-2 pt-3 border-t border-gray-100">
          <div className="flex flex-wrap gap-x-3 text-xs text-gray-500">
            <span>
              合計 {(steps.reduce((s, st) => s + st.durationMs, 0) / 1000).toFixed(1)}秒
            </span>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="w-full rounded-xl border border-gray-100 bg-white p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <img
          src="/dashboard/mascot-run.gif"
          alt="処理中"
          width={32}
          height={32}
          className="flex-shrink-0"
          style={{ imageRendering: 'pixelated' }}
        />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{taskName}</span>
          {isExecuting && (
            <>
              <span className="text-xs text-gray-400">
                {completedCount} / {expectedSteps.length}
              </span>
              <span className="text-xs text-gray-400 font-mono tabular-nums">
                {totalElapsed}s
              </span>
            </>
          )}
        </div>
      </div>

      {showLiveView ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
          <div className="min-w-0">{stepsColumn}</div>
          <div className="min-w-0">
            <LiveWorkPane steps={steps} isExecuting={isExecuting} />
          </div>
        </div>
      ) : (
        stepsColumn
      )}
    </div>
  );
}

/* ─── Live Work pane (Manus's Computer style) ───────────────────────── */

interface LiveWorkPaneProps {
  steps: SkeletonStep[];
  isExecuting: boolean;
}

function extractToolName(details: Record<string, unknown> | undefined): string | null {
  if (!details) return null;
  if (typeof details.tool === 'string') return details.tool;
  if (typeof details.toolName === 'string') return details.toolName;
  if (typeof details.functionName === 'string') return details.functionName;
  return null;
}

function extractPreview(details: Record<string, unknown> | undefined): string | null {
  if (!details) return null;
  if (typeof details.output === 'string') return details.output;
  if (typeof details.preview === 'string') return details.preview;
  if (typeof details.url === 'string') return `[browser] ${details.url}`;
  if (details.args !== undefined) {
    try {
      return JSON.stringify(details.args, null, 2);
    } catch {
      return null;
    }
  }
  return null;
}

function LiveWorkPane({ steps, isExecuting }: LiveWorkPaneProps) {
  const latest = steps[steps.length - 1];
  const toolName = latest ? extractToolName(latest.details) : null;
  const preview = latest ? extractPreview(latest.details) : null;

  return (
    <div className="h-full rounded-lg border border-gray-100 bg-gray-50/60 p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Spinner />
        <span className="text-xs text-gray-600">
          {isExecuting ? '現在の作業' : '最後の作業'}
        </span>
      </div>

      {!latest ? (
        <p className="text-xs text-gray-400">まだ作業は始まっていません。</p>
      ) : (
        <div className="flex-1 min-h-0 space-y-3">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">ステップ</div>
            <div className="text-sm text-gray-800">{latest.name}</div>
          </div>
          {toolName && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">ツール呼び出し</div>
              <code className="text-xs bg-white border border-gray-100 rounded px-2 py-1 font-mono text-gray-700">
                {toolName}
              </code>
            </div>
          )}
          {preview && (
            <div className="flex-1 min-h-0">
              <div className="text-xs text-gray-400 mb-0.5">出力プレビュー</div>
              <pre className="text-xs bg-white border border-gray-100 rounded p-2 font-mono text-gray-700 max-h-72 overflow-auto whitespace-pre-wrap break-words">
                {preview}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Static SkeletonTrace (backwards-compatible) ───────────────────────── */

function SkeletonBar({ width, className = '' }: { width: string; className?: string }) {
  return (
    <div
      className={`h-3 rounded bg-gray-200 animate-pulse ${className}`}
      style={{ width }}
    />
  );
}

function SkeletonStepPlaceholder({ index }: { index: number }) {
  return (
    <div
      className="relative pl-8 pb-5 animate-trace-enter trace-row-stagger"
      style={{ '--stagger': index } as React.CSSProperties}
    >
      <div className="absolute left-[7px] top-1 w-3 h-3 rounded-full bg-gray-200 animate-pulse" />
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <SkeletonBar width="40%" />
          <SkeletonBar width="48px" />
        </div>
        <SkeletonBar width="60%" className="h-2" />
        <SkeletonBar width="35%" className="h-2" />
      </div>
    </div>
  );
}

function StaticLoadingTimer() {
  const elapsed = useElapsedSeconds(true);
  return <span className="text-xs text-gray-400 font-mono tabular-nums">{elapsed}s</span>;
}

export function SkeletonTrace({ trace, isLoading }: StaticSkeletonTraceProps) {
  /* Loading state */
  if (isLoading || !trace) {
    return (
      <div className="w-full rounded-xl border border-gray-100 bg-white p-5">
        <div className="flex items-center gap-2 mb-5">
          <img
            src="/dashboard/mascot-run.gif"
            alt="処理中"
            width={32}
            height={32}
            className="flex-shrink-0"
          />
          <span className="text-sm text-gray-500">FujiTrace が処理しています...</span>
          <StaticLoadingTimer />
        </div>
        <div className="relative">
          <div className="absolute left-[13px] top-0 bottom-0 w-px bg-gray-200" />
          {[0, 1, 2].map((i) => (
            <SkeletonStepPlaceholder key={i} index={i} />
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          <SkeletonBar width="50%" />
          <SkeletonBar width="35%" className="h-2" />
        </div>
      </div>
    );
  }

  /* Completed state */
  return (
    <div className="w-full rounded-xl border border-gray-100 bg-white p-5">
      <h3 className="text-sm font-medium text-gray-800 mb-4">{trace.taskName}</h3>
      <div className="relative">
        <div className="absolute left-[13px] top-0 bottom-0 w-px bg-gray-200" />
        {trace.steps.map((step) => (
          <CompletedStepRow key={step.index} step={step} />
        ))}
      </div>
      <TraceSummaryFooter trace={trace} />
    </div>
  );
}
