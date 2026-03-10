import { useState, useCallback, useMemo } from 'react';
import type { AgentStep } from '../agent/types';

interface StepTimelineProps {
  steps: AgentStep[];
}

const STEP_TYPE_CONFIG: Record<
  AgentStep['type'],
  { icon: string; label: string; color: string }
> = {
  think: { icon: '\uD83E\uDDE0', label: '思考', color: 'text-purple-400' },
  search: { icon: '\uD83D\uDD0D', label: '検索', color: 'text-blue-400' },
  analyze: { icon: '\uD83D\uDCCA', label: '分析', color: 'text-cyan-400' },
  report: { icon: '\uD83D\uDCDD', label: 'レポート生成', color: 'text-amber-400' },
};

const STATUS_CONFIG: Record<
  AgentStep['status'],
  { label: string; badgeClass: string; dotClass: string }
> = {
  pending: {
    label: '待機中',
    badgeClass: 'bg-zinc-700/50 text-zinc-400',
    dotClass: 'bg-zinc-600',
  },
  running: {
    label: '実行中',
    badgeClass: 'bg-amber-500/20 text-amber-400',
    dotClass: 'bg-amber-500 step-running',
  },
  completed: {
    label: '完了',
    badgeClass: 'bg-emerald-500/20 text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
  error: {
    label: 'エラー',
    badgeClass: 'bg-red-500/20 text-red-400',
    dotClass: 'bg-red-500',
  },
};

export function StepTimeline({ steps }: StepTimelineProps) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0">
      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
        実行ステップ
      </h3>
      <div className="relative">
        {/* Timeline vertical line */}
        <div
          className="absolute left-[15px] top-2 bottom-2 w-px bg-zinc-700/60"
          aria-hidden="true"
        />

        <div className="space-y-3">
          {steps.map((step) => (
            <StepCard key={step.stepNumber} step={step} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface StepCardProps {
  step: AgentStep;
}

function StepCard({ step }: StepCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const typeConfig = STEP_TYPE_CONFIG[step.type];
  const statusConfig = STATUS_CONFIG[step.status];

  const duration = useMemo(() => {
    if (!step.startedAt || !step.completedAt) return null;
    const start = new Date(step.startedAt).getTime();
    const end = new Date(step.completedAt).getTime();
    const ms = end - start;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }, [step.startedAt, step.completedAt]);

  const costDisplay = useMemo(() => {
    if (step.cost === undefined || step.cost === null) return null;
    return `\u00A5${step.cost.toFixed(2)}`;
  }, [step.cost]);

  const tokenDisplay = useMemo(() => {
    if (!step.tokenUsage) return null;
    return `${step.tokenUsage.total.toLocaleString()} tokens`;
  }, [step.tokenUsage]);

  const hasOutput = step.output && step.output.trim().length > 0;
  const isInteractive = hasOutput && step.status === 'completed';

  return (
    <div className="relative pl-9">
      {/* Timeline dot */}
      <div
        className={`absolute left-[11px] top-3 w-[9px] h-[9px] rounded-full ring-2 ring-zinc-900 ${statusConfig.dotClass}`}
        aria-hidden="true"
      />

      <div
        className={
          'rounded-lg border transition-all duration-200 ' +
          (step.status === 'running'
            ? 'bg-zinc-800/80 border-amber-500/30'
            : step.status === 'error'
              ? 'bg-zinc-800/60 border-red-500/30'
              : 'bg-zinc-800/40 border-zinc-700/40') +
          (isInteractive ? ' cursor-pointer hover:border-zinc-600/60' : '')
        }
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-expanded={isInteractive ? isExpanded : undefined}
        aria-label={`ステップ ${step.stepNumber}: ${step.description}`}
        onClick={isInteractive ? toggleExpand : undefined}
        onKeyDown={
          isInteractive
            ? (e: React.KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleExpand();
                }
              }
            : undefined
        }
      >
        {/* Header */}
        <div className="px-3.5 py-2.5 flex items-start gap-3">
          {/* Step number + icon */}
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            <span className="text-xs font-bold text-zinc-500 tabular-nums w-4 text-right">
              {step.stepNumber}
            </span>
            <span className="text-sm" aria-hidden="true">
              {typeConfig.icon}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-medium ${typeConfig.color}`}>
                {typeConfig.label}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusConfig.badgeClass}`}>
                {statusConfig.label}
              </span>
            </div>
            <p className="text-sm text-zinc-300 mt-1 leading-snug">
              {step.description}
            </p>

            {/* Metadata row for completed steps */}
            {step.status === 'completed' && (duration || tokenDisplay || costDisplay) && (
              <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500">
                {duration && (
                  <span className="flex items-center gap-1">
                    <ClockIcon />
                    {duration}
                  </span>
                )}
                {tokenDisplay && (
                  <span className="flex items-center gap-1">
                    <TokenIcon />
                    {tokenDisplay}
                  </span>
                )}
                {costDisplay && (
                  <span className="flex items-center gap-1">
                    <CostIcon />
                    {costDisplay}
                  </span>
                )}
              </div>
            )}

            {/* Running indicator */}
            {step.status === 'running' && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex space-x-1" aria-label="実行中">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* Expand indicator */}
          {isInteractive && (
            <div className="shrink-0 pt-1">
              <svg
                className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Expanded output */}
        {isExpanded && hasOutput && (
          <div className="px-3.5 pb-3 pt-0">
            <div className="bg-zinc-900/80 rounded-md border border-zinc-700/30 p-3 text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
              {step.output}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TokenIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function CostIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
