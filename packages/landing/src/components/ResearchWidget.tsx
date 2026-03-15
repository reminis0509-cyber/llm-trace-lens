import { useState, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';

/* ── Type definitions (mirrored from src/agent/types.ts to avoid cross-package import) ── */

interface AgentStep {
  stepNumber: number;
  type: 'think' | 'search' | 'analyze' | 'report';
  description: string;
  input?: string;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startedAt?: string;
  completedAt?: string;
  tokenUsage?: { prompt: number; completion: number; total: number };
  cost?: number;
}

interface ResearchReport {
  title: string;
  markdown: string;
  steps: AgentStep[];
  totalCost: number;
  totalTokens: number;
  totalDuration: number;
}

/* ── SVG Icon Components ── */

function SearchIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function TokenIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
      />
    </svg>
  );
}

function CostIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg
      className="w-4 h-4 text-emerald-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ErrorCircleIcon() {
  return (
    <svg
      className="w-4 h-4 text-red-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

/* ── Loading Dots (reused pattern from ChatWidget) ── */

function LoadingDots() {
  return (
    <div className="flex items-center gap-1" aria-label="実行中">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#60a5fa] animate-[dotPulse_1.4s_ease-in-out_0s_infinite]" />
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#60a5fa] animate-[dotPulse_1.4s_ease-in-out_0.2s_infinite]" />
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#60a5fa] animate-[dotPulse_1.4s_ease-in-out_0.4s_infinite]" />
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

/* ── Step label map ── */

const STEP_LABELS: Record<AgentStep['type'], string> = {
  think: '計画',
  search: '検索',
  analyze: '分析',
  report: 'レポート生成',
};

/* ── Step Status Dot ── */

interface StepStatusDotProps {
  status: AgentStep['status'];
}

function StepStatusDot({ status }: StepStatusDotProps) {
  if (status === 'completed') {
    return <CheckCircleIcon />;
  }
  if (status === 'error') {
    return <ErrorCircleIcon />;
  }
  if (status === 'running') {
    return (
      <span className="relative flex h-4 w-4" aria-hidden="true">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#60a5fa] opacity-75" />
        <span className="relative inline-flex rounded-full h-4 w-4 bg-[#60a5fa]" />
      </span>
    );
  }
  /* pending */
  return (
    <span
      className="inline-flex h-4 w-4 rounded-full bg-[#52525b]"
      aria-hidden="true"
    />
  );
}

/* ── Step Duration ── */

function formatDuration(startedAt?: string, completedAt?: string): string | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ── Step Timeline ── */

interface StepTimelineProps {
  steps: AgentStep[];
}

function StepTimeline({ steps }: StepTimelineProps) {
  if (steps.length === 0) return null;

  return (
    <div className="mt-6">
      <h4 className="text-xs text-[#a1a1aa] uppercase tracking-wider mb-3 font-medium">
        実行ステップ
      </h4>
      <div className="space-y-2">
        {steps.map((step) => {
          const duration = formatDuration(step.startedAt, step.completedAt);
          return (
            <div
              key={step.stepNumber}
              className="flex items-center gap-3 bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5"
            >
              <StepStatusDot status={step.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#f4f4f5] font-medium">
                    {STEP_LABELS[step.type] || step.type}
                  </span>
                  {step.status === 'running' && <LoadingDots />}
                </div>
                {step.description && (
                  <p className="text-xs text-[#a1a1aa] mt-0.5 truncate">
                    {step.description}
                  </p>
                )}
              </div>
              {duration && (
                <span className="text-xs text-[#a1a1aa] font-mono tabular-nums shrink-0">
                  {duration}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Report Display ── */

interface ReportDisplayProps {
  report: ResearchReport;
  onReset: () => void;
}

function ReportDisplay({ report, onReset }: ReportDisplayProps) {
  const durationDisplay = useMemo(() => {
    const seconds = report.totalDuration / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds.toFixed(0)}秒`;
  }, [report.totalDuration]);

  const costDisplay = useMemo(() => {
    return `\u00A5${report.totalCost.toFixed(2)}`;
  }, [report.totalCost]);

  const tokenDisplay = useMemo(() => {
    return report.totalTokens.toLocaleString();
  }, [report.totalTokens]);

  return (
    <div className="mt-6">
      {/* Metadata badges */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 bg-[#18181b] border border-[#27272a] rounded-md px-3 py-1.5">
          <span className="text-[#34d399]" aria-hidden="true">
            <ClockIcon />
          </span>
          <span className="text-[11px] text-[#a1a1aa]">所要時間</span>
          <span className="text-sm font-medium text-[#f4f4f5] tabular-nums">
            {durationDisplay}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-[#18181b] border border-[#27272a] rounded-md px-3 py-1.5">
          <span className="text-[#34d399]" aria-hidden="true">
            <TokenIcon />
          </span>
          <span className="text-[11px] text-[#a1a1aa]">トークン数</span>
          <span className="text-sm font-medium text-[#f4f4f5] tabular-nums">
            {tokenDisplay}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-[#18181b] border border-[#27272a] rounded-md px-3 py-1.5">
          <span className="text-[#34d399]" aria-hidden="true">
            <CostIcon />
          </span>
          <span className="text-[11px] text-[#a1a1aa]">コスト</span>
          <span className="text-sm font-medium text-[#f4f4f5] tabular-nums">
            {costDisplay}
          </span>
        </div>
      </div>

      {/* Markdown report */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-6">
        <div className="prose prose-invert prose-sm max-w-none prose-headings:text-[#f4f4f5] prose-p:text-[#a1a1aa] prose-strong:text-[#f4f4f5] prose-li:text-[#a1a1aa] prose-a:text-[#34d399] prose-code:text-[#34d399]">
          <ReactMarkdown>{report.markdown}</ReactMarkdown>
        </div>
      </div>

      {/* Reset button */}
      <div className="mt-4 text-center">
        <button
          onClick={onReset}
          className="px-6 py-2 text-sm text-[#f4f4f5] border border-[#27272a] rounded-lg hover:border-[#34d399]/50 hover:text-[#34d399] transition-colors cursor-pointer"
          aria-label="新しい調査を開始"
        >
          新しい調査
        </button>
      </div>
    </div>
  );
}

/* ── Main ResearchWidget Component ── */

export default function ResearchWidget() {
  const [topic, setTopic] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const consumeSSE = useCallback(async (researchTopic: string) => {
    setIsRunning(true);
    setSteps([]);
    setReport(null);
    setError(null);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: researchTopic }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || '調査に失敗しました');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'step') {
                setSteps((prev) => {
                  const existing = prev.findIndex(
                    (s) => s.stepNumber === data.step.stepNumber
                  );
                  if (existing >= 0) {
                    const updated = [...prev];
                    updated[existing] = data.step;
                    return updated;
                  }
                  return [...prev, data.step];
                });
              } else if (data.type === 'report') {
                setReport(data.report);
              } else if (data.type === 'error') {
                setError(data.message);
              }
            } catch {
              /* skip malformed SSE data */
            }
          }
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'エラーが発生しました'
      );
    } finally {
      setIsRunning(false);
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = topic.trim();
      if (!trimmed || isRunning) return;
      consumeSSE(trimmed);
    },
    [topic, isRunning, consumeSSE]
  );

  const handleReset = useCallback(() => {
    setTopic('');
    setSteps([]);
    setReport(null);
    setError(null);
    inputRef.current?.focus();
  }, []);

  const handleFloatClick = useCallback(() => {
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    /* Small delay so focus happens after scroll */
    setTimeout(() => {
      inputRef.current?.focus();
    }, 500);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
        e.preventDefault();
        const trimmed = topic.trim();
        if (!trimmed || isRunning) return;
        consumeSSE(trimmed);
      }
    },
    [topic, isRunning, consumeSSE]
  );

  return (
    <>
      {/* ── Inline Section ── */}
      <section
        ref={sectionRef}
        id="research-demo"
        className="py-16 sm:py-24 px-4 sm:px-6"
      >
        <div className="section-container">
          {/* Section header */}
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
              LIVE DEMO
            </span>
            <h2 className="text-display-sm font-semibold text-text-primary mb-4">
              AIリサーチエージェント - ライブデモ
            </h2>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              テーマを入力するだけで、AIが自律的にWeb検索・分析・レポート生成。全ステップはFujiTraceでトレースされます。
            </p>
          </div>

          {/* Input form */}
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="例: 生成AI市場の最新動向"
                disabled={isRunning}
                className="flex-1 bg-[#0d0d0f] border border-[#27272a] rounded-lg px-4 py-3 text-sm text-[#f4f4f5] placeholder-[#52525b] focus:outline-none focus:border-[#34d399]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="調査テーマを入力"
              />
              <button
                type="submit"
                disabled={!topic.trim() || isRunning}
                className="px-6 py-3 text-sm font-medium text-[#0d0d0f] bg-[#34d399] rounded-lg hover:bg-[#2cc48a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                aria-label="調査開始"
              >
                {isRunning ? '調査中...' : '調査開始'}
              </button>
            </form>
            <p className="text-xs text-[#52525b] mt-2 text-center">
              1時間あたり3回まで実行できます
            </p>

            {/* Error display */}
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Step timeline */}
            {steps.length > 0 && <StepTimeline steps={steps} />}

            {/* Report */}
            {report && (
              <ReportDisplay report={report} onReset={handleReset} />
            )}
          </div>
        </div>
      </section>

      {/* ── Floating Button ── */}
      <button
        onClick={handleFloatClick}
        className="fixed bottom-6 right-20 z-50 w-12 h-12 rounded-full bg-[#34d399] hover:bg-[#2cc48a] transition-colors flex items-center justify-center cursor-pointer shadow-lg text-[#0d0d0f]"
        aria-label="AIリサーチデモへスクロール"
      >
        <SearchIcon />
      </button>
    </>
  );
}
