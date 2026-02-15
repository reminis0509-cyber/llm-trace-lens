import type { Trace, ValidationLevel } from '../types';
import { FeedbackButton } from './FeedbackButton';

interface Props {
  trace: Trace;
  onClose: () => void;
  apiKey?: string;
}

const LEVEL_COLORS: Record<ValidationLevel, string> = {
  PASS: 'bg-green-100 text-green-800 border-green-200',
  WARN: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  FAIL: 'bg-orange-100 text-orange-800 border-orange-200',
  BLOCK: 'bg-red-100 text-red-800 border-red-200',
};

export function TraceDetail({ trace, onClose, apiKey }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 sticky top-6">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Trace Detail</h2>
          <p className="text-sm text-gray-500 font-mono">{trace.id}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl"
        >
          &times;
        </button>
      </div>

      {/* Feedback Section */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Validation Feedback
        </h3>
        <FeedbackButton traceId={trace.id} apiKey={apiKey} />
      </div>

      {/* Content */}
      <div className="p-4 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Validation Summary */}
        <div
          className={`p-4 rounded-lg border ${LEVEL_COLORS[trace.validation.overall]}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-lg">
              {trace.validation.overall}
            </span>
            <span className="text-2xl font-bold">{trace.validation.score}</span>
          </div>
          <div className="space-y-1">
            {trace.validation.rules.map((rule, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${
                    rule.level === 'PASS'
                      ? 'bg-green-500'
                      : rule.level === 'WARN'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                />
                <span className="font-medium">{rule.ruleName}</span>
                <span className="text-gray-600">- {rule.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Structured Response */}
        <Section title="Answer">
          <p className="text-gray-900">{trace.structured.answer}</p>
        </Section>

        <Section title={`Confidence: ${(trace.structured.confidence * 100).toFixed(0)}%`}>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full ${
                trace.structured.confidence >= 0.8
                  ? 'bg-green-500'
                  : trace.structured.confidence >= 0.5
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${trace.structured.confidence * 100}%` }}
            />
          </div>
        </Section>

        <Section title="Thinking">
          <p className="text-gray-700 text-sm whitespace-pre-wrap">
            {trace.structured.thinking}
          </p>
        </Section>

        <Section title={`Evidence (${trace.structured.evidence.length})`}>
          <ul className="space-y-2">
            {trace.structured.evidence.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-green-600">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={`Risks (${trace.structured.risks.length})`}>
          <ul className="space-y-2">
            {trace.structured.risks.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-yellow-600">⚠</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Metadata */}
        <Section title="Metadata">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <MetaItem label="Provider" value={trace.provider} />
            <MetaItem label="Model" value={trace.model} />
            <MetaItem label="Latency" value={`${trace.latencyMs}ms`} />
            <MetaItem label="Tokens" value={String(trace.tokensUsed)} />
            <MetaItem
              label="Timestamp"
              value={new Date(trace.timestamp).toLocaleString()}
            />
          </div>
        </Section>

        {/* Raw Response */}
        <Section title="Raw Response">
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
            {trace.rawResponse}
          </pre>
        </Section>

        {/* Prompt */}
        <Section title="Prompt">
          <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
            {trace.prompt}
          </pre>
        </Section>
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
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
