import { useState, useEffect, useRef } from 'react';
import { RefreshCw, List } from 'lucide-react';
import { fetchTraces } from '../api/client';
import type { Trace, ValidationLevel } from '../types';

// Helper to safely render any value as string (prevents React error #31)
function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

interface Props {
  onSelect: (trace: Trace) => void;
  selectedId?: string;
  workspaceId?: string;
}

const STATUS_BAR_STYLES: Record<ValidationLevel, string> = {
  PASS: 'border-l-status-pass',
  WARN: 'border-l-status-warn',
  FAIL: 'border-l-status-fail',
  BLOCK: 'border-l-status-block',
};

export function TraceList({ onSelect, selectedId, workspaceId }: Props) {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [nextUpdateTime, setNextUpdateTime] = useState<string>('');
  const loadTracesRef = useRef<() => void>();

  // Keep loadTraces ref up to date
  useEffect(() => {
    loadTracesRef.current = loadTraces;
  });

  // Format time in JST
  const formatJSTTime = (date: Date): string => {
    return date.toLocaleTimeString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' JST';
  };

  // Auto-refresh at the start of each minute
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let intervalId: ReturnType<typeof setInterval>;

    const scheduleNextUpdate = () => {
      const now = new Date();
      const secondsUntilNextMinute = 60 - now.getSeconds();
      const msUntilNextMinute = secondsUntilNextMinute * 1000 - now.getMilliseconds();

      const nextMinute = new Date(now.getTime() + msUntilNextMinute);
      setNextUpdateTime(formatJSTTime(nextMinute));

      timeoutId = setTimeout(() => {
        if (loadTracesRef.current) {
          loadTracesRef.current();
        }

        intervalId = setInterval(() => {
          if (loadTracesRef.current) {
            loadTracesRef.current();
          }
          const next = new Date();
          next.setMinutes(next.getMinutes() + 1);
          next.setSeconds(0);
          setNextUpdateTime(formatJSTTime(next));
        }, 60000);
      }, msUntilNextMinute);
    };

    scheduleNextUpdate();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    loadTraces();
  }, [filter, providerFilter]);

  async function loadTraces() {
    setLoading(true);
    try {
      const result = await fetchTraces({
        limit: 50,
        level: filter === 'all' ? undefined : filter,
        provider: providerFilter === 'all' ? undefined : providerFilter,
      });
      setTraces(result.traces);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load traces:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function extractPromptDisplay(prompt: string): string {
    if (!prompt) return '';

    const trimmed = prompt.trim();
    if (trimmed.startsWith('[')) {
      try {
        const messages = JSON.parse(trimmed);
        if (Array.isArray(messages)) {
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role === 'user' && msg.content) {
              return msg.content;
            }
          }
        }
      } catch {
        // Not valid JSON, return as-is
      }
    }

    return prompt;
  }

  const filterOptions = [
    { value: 'all', label: 'すべて' },
    { value: 'PASS', label: '合格' },
    { value: 'WARN', label: '警告' },
    { value: 'FAIL', label: '失敗' },
    { value: 'BLOCK', label: 'ブロック' },
  ];

  const providerOptions = [
    { value: 'all', label: 'すべて' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'gemini', label: 'Gemini' },
  ];

  return (
    <div className="surface-card">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-medium text-text-primary">
              トレース
            </h2>
            <span className="text-text-muted font-mono text-sm tabular-nums">
              {total}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {nextUpdateTime && (
              <span className="text-xs text-text-muted font-mono">
                次回更新: {nextUpdateTime}
              </span>
            )}
            <button
              onClick={loadTraces}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
              title="更新"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters - Segmented Control */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="segmented-control">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`segmented-control-item ${filter === option.value ? 'active' : ''}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="segmented-control">
            {providerOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setProviderFilter(option.value)}
                className={`segmented-control-item ${providerFilter === option.value ? 'active' : ''}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[calc(100vh-220px)] sm:max-h-[calc(100vh-280px)] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-text-muted">読み込み中...</div>
        ) : traces.length === 0 ? (
          <div className="py-16 text-center">
            <List className="w-6 h-6 mx-auto mb-3 text-text-muted" />
            <p className="text-sm text-text-muted">トレースが見つかりません</p>
          </div>
        ) : (
          traces.map((trace) => (
            <div
              key={trace.id}
              onClick={() => onSelect(trace)}
              className={`group px-6 py-4 cursor-pointer border-b border-border-subtle border-l-[3px] transition-colors duration-120 ${
                STATUS_BAR_STYLES[trace.validation.overall]
              } ${
                selectedId === trace.id
                  ? 'bg-accent-dim'
                  : 'hover:bg-base-elevated'
              }`}
              title={`${trace.provider} / ${trace.model}`}
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <p className="text-sm text-text-primary line-clamp-2 flex-1">
                  {extractPromptDisplay(trace.prompt)}
                </p>
                <span className="text-2xl font-mono tabular-nums text-text-primary flex-shrink-0">
                  {trace.validation.score}
                  <span className="text-sm text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                    /100
                  </span>
                </span>
              </div>

              <p className="text-sm text-text-secondary font-medium line-clamp-1 mb-3">
                {safeString(trace.structured.answer)}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted font-mono tabular-nums">
                <span>信頼度 {(trace.structured.confidence * 100).toFixed(0)}%</span>
                <span>根拠 {trace.structured.evidence.length}</span>
                {trace.agentTrace && (
                  <>
                    <span>{trace.agentTrace.stepCount} ステップ</span>
                    <span>{trace.agentTrace.toolCallCount} ツール</span>
                  </>
                )}
                <span>{trace.latencyMs}ms</span>
                <span className="hidden sm:inline">{formatTime(trace.timestamp)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
