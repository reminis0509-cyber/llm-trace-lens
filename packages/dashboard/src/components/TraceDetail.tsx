import { X } from 'lucide-react';
import type { Trace, ValidationLevel } from '../types';
import { FeedbackButton } from './FeedbackButton';
import { EvaluationScores } from './EvaluationScores';
import { EvaluationBadges } from './EvaluationBadges';
import { AgentStepFlow } from './AgentStepFlow';

// Helper to safely render any value as string (prevents React error #31)
function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

interface Props {
  trace: Trace;
  onClose: () => void;
  apiKey?: string;
}

const STATUS_BAR_STYLES: Record<ValidationLevel, string> = {
  PASS: 'border-l-status-pass',
  WARN: 'border-l-status-warn',
  FAIL: 'border-l-status-fail',
  BLOCK: 'border-l-status-block',
};

export function TraceDetail({ trace, onClose, apiKey }: Props) {
  return (
    <div className="surface-card lg:sticky lg:top-6">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-medium text-text-primary">トレース詳細</h2>
          <p className="text-xs text-text-muted font-mono truncate mt-1">{trace.id}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-2 text-text-muted hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Feedback Section */}
      <div className="px-6 py-4 border-b border-border bg-base">
        <h3 className="text-xs text-text-muted mb-3 label-spacing uppercase">
          バリデーションフィードバック
        </h3>
        <FeedbackButton traceId={trace.id} apiKey={apiKey} />
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-6 max-h-[calc(100vh-180px)] lg:max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Validation Summary */}
        <div className={`p-4 rounded-card bg-base border-l-[3px] ${STATUS_BAR_STYLES[trace.validation?.overall ?? 'PASS']}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-text-primary">
              {trace.validation?.overall ?? 'N/A'}
            </span>
            <span className="text-2xl font-mono tabular-nums text-text-primary">{Math.round((trace.validation?.score ?? 0) * 100)}</span>
          </div>
          <div className="space-y-2">
            {(trace.validation?.rules ?? []).map((rule, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    rule.level === 'PASS'
                      ? 'bg-status-pass'
                      : rule.level === 'WARN'
                        ? 'bg-status-warn'
                        : 'bg-status-fail'
                  }`}
                />
                <span className="text-text-secondary">{rule.ruleName}</span>
                <span className="text-text-muted">- {rule.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Execution Flow */}
        {trace.traceType === 'agent' && trace.agentTrace && (
          <Section title="エージェント実行フロー">
            <AgentStepFlow agentTrace={trace.agentTrace} />
          </Section>
        )}

        {/* Structured Response */}
        <Section title="回答">
          <p className="text-sm text-text-primary whitespace-pre-wrap">{safeString(trace.structured?.answer)}</p>
        </Section>

        <Section title={`信頼度: ${((trace.structured?.confidence ?? 0) * 100).toFixed(0)}%`}>
          <div className="w-full bg-base-elevated rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                (trace.structured?.confidence ?? 0) >= 0.8
                  ? 'bg-status-pass'
                  : (trace.structured?.confidence ?? 0) >= 0.5
                    ? 'bg-status-warn'
                    : 'bg-status-fail'
              }`}
              style={{ width: `${(trace.structured?.confidence ?? 0) * 100}%` }}
            />
          </div>
        </Section>

        <Section title="思考プロセス">
          <p className="text-sm text-text-secondary whitespace-pre-wrap">
            {safeString(trace.structured?.thinking)}
          </p>
        </Section>

        <Section title={`根拠 (${trace.structured?.evidence?.length || 0})`}>
          <ul className="space-y-2">
            {(trace.structured?.evidence || []).map((item, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-status-pass">+</span>
                <span className="text-text-secondary">{safeString(item)}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={`リスク (${trace.structured?.risks?.length || 0})`}>
          <ul className="space-y-2">
            {(trace.structured?.risks || []).map((item, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-status-warn">!</span>
                <span className="text-text-secondary">{safeString(item)}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Metadata */}
        <Section title="メタデータ">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <MetaItem label="プロバイダー" value={trace.provider} />
            <MetaItem label="モデル" value={trace.model} />
            <MetaItem label="レイテンシ" value={`${trace.latencyMs}ms`} />
            <MetaItem label="トークン" value={String(trace.tokensUsed)} />
            <MetaItem
              label="タイムスタンプ"
              value={new Date(trace.timestamp).toLocaleString()}
            />
          </div>
        </Section>

        {/* Raw Response */}
        <Section title="生レスポンス">
          <pre className="terminal-block p-4 text-xs text-accent overflow-x-auto">
            {trace.rawResponse}
          </pre>
        </Section>

        {/* Prompt */}
        <Section title="プロンプト">
          <pre className="terminal-block p-4 text-xs text-text-secondary overflow-x-auto whitespace-pre-wrap break-words">
            {trace.prompt}
          </pre>
        </Section>

        {/* Pattern-based Evaluation (Phase 1 MVP) */}
        {trace.evaluations && (
          <Section title="自動評価">
            <EvaluationBadges evaluations={trace.evaluations} />
          </Section>
        )}

        {/* LLM-as-Judge Evaluation */}
        {trace.evaluation && (
          <section className="mt-6">
            <EvaluationScores evaluation={trace.evaluation} />
          </section>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs text-text-muted mb-3 label-spacing uppercase">
        {title}
      </h3>
      {children}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-primary font-mono tabular-nums">{value}</span>
    </div>
  );
}
