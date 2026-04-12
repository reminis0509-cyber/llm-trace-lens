import { useMemo } from 'react';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface SkeletonStep {
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

interface SkeletonTraceProps {
  trace: SkeletonTrace | null;
  isLoading: boolean;
}

/* ─── Skeleton placeholder bars (loading state) ─────────────────────────── */

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
      {/* Timeline dot */}
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

/* ─── Completed step card ───────────────────────────────────────────────── */

function StepRow({ step, index }: { step: SkeletonStep; index: number }) {
  const isError = step.status === 'error';
  const detailLines = useMemo(() => extractDetailLines(step.details), [step.details]);
  const issues = useMemo(() => extractIssues(step.details), [step.details]);

  return (
    <div
      className="relative pl-8 pb-5 opacity-0 animate-trace-enter trace-row-stagger"
      style={{ '--stagger': index } as React.CSSProperties}
    >
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
        className={`rounded-lg border bg-gray-50 p-3 ${
          isError
            ? 'border-l-[3px] border-l-red-500 border-t-gray-100 border-r-gray-100 border-b-gray-100'
            : 'border-l-[3px] border-l-green-500 border-t-gray-100 border-r-gray-100 border-b-gray-100'
        }`}
      >
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Icon */}
            {isError ? (
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
            ) : (
              <svg
                className="w-4 h-4 text-green-500 flex-shrink-0"
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
            )}
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

/* ─── Main component ────────────────────────────────────────────────────── */

export function SkeletonTrace({ trace, isLoading }: SkeletonTraceProps) {
  /* ── Loading state ─────────────────────────────────────────────────── */
  if (isLoading || !trace) {
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
          />
          <span className="text-sm text-gray-500">FujiTrace が処理しています...</span>
        </div>

        {/* Timeline line */}
        <div className="relative">
          <div className="absolute left-[13px] top-0 bottom-0 w-px bg-gray-200" />
          {[0, 1, 2].map((i) => (
            <SkeletonStepPlaceholder key={i} index={i} />
          ))}
        </div>

        {/* Footer placeholder */}
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          <SkeletonBar width="50%" />
          <SkeletonBar width="35%" className="h-2" />
        </div>
      </div>
    );
  }

  /* ── Completed state ───────────────────────────────────────────────── */
  return (
    <div className="w-full rounded-xl border border-gray-100 bg-white p-5">
      {/* Title */}
      <h3 className="text-sm font-medium text-gray-800 mb-4">{trace.taskName}</h3>

      {/* Steps timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[13px] top-0 bottom-0 w-px bg-gray-200" />

        {trace.steps.map((step, i) => (
          <StepRow key={step.index} step={step} index={i} />
        ))}
      </div>

      {/* Footer: summary */}
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

      {/* Pro upsell hint */}
      <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
        これは直近の実行レポートです。過去の全履歴・傾向分析は{' '}
        <a href="/dashboard/traces" className="text-blue-500 hover:underline">
          FujiTrace ダッシュボード
        </a>{' '}
        で確認できます。
      </div>
    </div>
  );
}
