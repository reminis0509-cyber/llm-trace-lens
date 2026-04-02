import { useState } from 'react';
import type { AgentTrace, AgentStep, ToolCall } from '../types';

interface Props {
  agentTrace: AgentTrace;
}

const STATUS_LABELS: Record<string, string> = {
  completed: '完了',
  failed: '失敗',
  in_progress: '処理中',
};

export function AgentStepFlow({ agentTrace }: Props) {
  return (
    <div className="space-y-4">
      {/* Goal */}
      <div className="p-3 bg-accent/10 rounded-card border border-accent/20">
        <span className="text-sm font-semibold text-accent">目標:</span>
        <span className="text-text-primary ml-1">{agentTrace.goal}</span>
      </div>

      {/* Agent Info */}
      {(agentTrace.agentId || agentTrace.agentName) && (
        <div className="flex gap-4 text-sm text-text-secondary">
          {agentTrace.agentName && (
            <span>
              <span className="font-medium">エージェント:</span> {agentTrace.agentName}
            </span>
          )}
          {agentTrace.agentId && (
            <span className="font-mono text-xs text-text-muted">
              {agentTrace.agentId}
            </span>
          )}
        </div>
      )}

      {/* Steps Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

        {(agentTrace.steps ?? []).map((step, index) => (
          <StepCard
            key={step.stepIndex}
            step={step}
            index={index}
            isLast={index === (agentTrace.steps?.length ?? 0) - 1}
          />
        ))}
      </div>

      {/* Final Answer */}
      {agentTrace.finalAnswer && (
        <div className="p-3 bg-status-pass/10 rounded-card border border-status-pass/20">
          <div className="text-sm font-semibold text-status-pass mb-1">
            最終回答
          </div>
          <p className="text-text-primary text-sm whitespace-pre-wrap">
            {agentTrace.finalAnswer}
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="flex flex-wrap gap-4 text-sm text-text-secondary pt-4 border-t border-border">
        <span>
          <span className="font-medium">実行時間:</span>{' '}
          {(agentTrace.totalDurationMs ?? 0).toLocaleString('ja-JP')}ms
        </span>
        <span>
          <span className="font-medium">ステップ数:</span> {agentTrace.stepCount}
        </span>
        <span>
          <span className="font-medium">ツール呼び出し:</span>{' '}
          {agentTrace.toolCallCount}
        </span>
        <span
          className={`font-medium ${
            agentTrace.status === 'completed'
              ? 'text-status-pass'
              : agentTrace.status === 'failed'
                ? 'text-status-fail'
                : 'text-status-warn'
          }`}
        >
          {STATUS_LABELS[agentTrace.status] ?? agentTrace.status}
        </span>
      </div>

      {/* Error */}
      {agentTrace.error && (
        <div className="p-3 bg-status-fail/10 rounded-card border border-status-fail/20">
          <span className="text-sm font-semibold text-status-fail">エラー: </span>
          <span className="text-text-primary">{agentTrace.error}</span>
        </div>
      )}
    </div>
  );
}

function StepCard({ step, index, isLast }: { step: AgentStep; index: number; isLast: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`relative pl-10 animate-trace-enter trace-row-stagger ${isLast ? '' : 'pb-6'}`}
      style={{ '--stagger': index } as React.CSSProperties}
    >
      {/* Step marker */}
      <div className="absolute left-2 w-4 h-4 rounded-full bg-accent border-2 border-base shadow" />

      <div className="surface-card overflow-hidden">
        {/* Header - always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-base-elevated transition-colors"
          aria-expanded={isExpanded}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-text-primary">
              ステップ {step.stepIndex + 1}
            </span>
            <span className="text-xs text-text-muted bg-base-elevated px-2 py-0.5 rounded">
              {step.action}
            </span>
            {(step.toolCalls?.length ?? 0) > 0 && (
              <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded">
                {step.toolCalls.length} ツール
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted font-mono tabular-nums">{step.durationMs}ms</span>
            <svg
              className={`w-4 h-4 text-text-muted transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="p-4 pt-0 space-y-3 border-t border-border animate-span-expand will-change-transform">
            {/* Thought */}
            <div>
              <div className="text-xs font-semibold text-status-block uppercase tracking-wide mb-1">
                思考
              </div>
              <p className="text-sm text-text-secondary bg-status-block/5 p-2 rounded whitespace-pre-wrap">
                {step.thought}
              </p>
            </div>

            {/* Action */}
            <div>
              <div className="text-xs font-semibold text-status-warn uppercase tracking-wide mb-1">
                アクション
              </div>
              <p className="text-sm text-text-secondary bg-status-warn/5 p-2 rounded">
                {step.action}
              </p>
            </div>

            {/* Tool Calls */}
            {(step.toolCalls?.length ?? 0) > 0 && (
              <div>
                <div className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">
                  ツール呼び出し ({step.toolCalls.length})
                </div>
                <div className="space-y-2">
                  {step.toolCalls.map((tool) => (
                    <ToolCallCard key={tool.id} toolCall={tool} />
                  ))}
                </div>
              </div>
            )}

            {/* Observation */}
            <div>
              <div className="text-xs font-semibold text-status-pass uppercase tracking-wide mb-1">
                観測結果
              </div>
              <p className="text-sm text-text-secondary bg-status-pass/5 p-2 rounded whitespace-pre-wrap">
                {step.observation}
              </p>
            </div>

            {/* Timestamp */}
            <div className="text-xs text-text-muted pt-2 font-mono tabular-nums">
              {new Date(step.timestamp).toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [showResult, setShowResult] = useState(false);

  return (
    <div className="bg-accent/5 rounded-card p-2 text-xs border border-accent/10">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono font-semibold text-accent">
          {toolCall.name}
        </span>
        <div className="flex items-center gap-2">
          {toolCall.durationMs && (
            <span className="text-text-muted font-mono tabular-nums">{toolCall.durationMs}ms</span>
          )}
          {toolCall.error && (
            <span className="text-status-fail text-xs">エラー</span>
          )}
        </div>
      </div>

      {/* Arguments */}
      <div className="mb-2">
        <div className="text-text-muted mb-0.5">引数:</div>
        <pre className="text-text-secondary bg-base p-1 rounded overflow-x-auto text-xs font-mono">
          {JSON.stringify(toolCall.arguments, null, 2)}
        </pre>
      </div>

      {/* Result toggle */}
      {(toolCall.result !== undefined || toolCall.error) && (
        <div>
          <button
            onClick={() => setShowResult(!showResult)}
            className="text-accent hover:text-accent/80 text-xs flex items-center gap-1"
          >
            {showResult ? '非表示' : '結果を表示'}
            <svg
              className={`w-3 h-3 transition-transform ${showResult ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showResult && (
            <div className="mt-1">
              {toolCall.error ? (
                <div className="text-status-fail bg-status-fail/5 p-1 rounded">
                  {toolCall.error}
                </div>
              ) : (
                <pre className="text-text-secondary bg-base p-1 rounded overflow-x-auto text-xs font-mono max-h-40 overflow-y-auto">
                  {typeof toolCall.result === 'string'
                    ? toolCall.result
                    : JSON.stringify(toolCall.result, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
