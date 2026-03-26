import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
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

/* ── Trace entry for dashboard display ── */

interface TraceEntry {
  id: string;
  stepNumber: number;
  type: AgentStep['type'];
  status: AgentStep['status'];
  label: string;
  labelJa: string;
  provider: string;
  description: string;
  tokenUsage?: { prompt: number; completion: number; total: number };
  cost?: number;
  duration: string | null;
  resultCount?: number;
  visible: boolean;
}

/* ── Dashboard summary stats ── */

interface DashboardStats {
  completedTraces: number;
  totalTraces: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
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

function ChevronIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        transform: direction === 'up' ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 200ms ease',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/* ── Loading Dots ── */

function LoadingDots() {
  return (
    <div className="flex items-center gap-1" aria-label="実行中">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-[dotPulse_1.4s_ease-in-out_0s_infinite]" />
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-[dotPulse_1.4s_ease-in-out_0.2s_infinite]" />
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-[dotPulse_1.4s_ease-in-out_0.4s_infinite]" />
    </div>
  );
}

/* ── Step label map ── */

const STEP_LABELS: Record<AgentStep['type'], { en: string; ja: string }> = {
  think: { en: 'Plan', ja: '計画' },
  search: { en: 'Search', ja: '検索' },
  analyze: { en: 'Analyze', ja: '分析' },
  report: { en: 'Report', ja: 'レポート生成' },
};

const STEP_PROVIDERS: Record<AgentStep['type'], string> = {
  think: 'gpt-4o-mini',
  search: 'DuckDuckGo',
  analyze: 'gpt-4o-mini',
  report: 'gpt-4o-mini',
};

/* ── Duration formatting ── */

function formatDuration(startedAt?: string, completedAt?: string): string | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getDurationMs(startedAt?: string, completedAt?: string): number {
  if (!startedAt || !completedAt) return 0;
  return new Date(completedAt).getTime() - new Date(startedAt).getTime();
}

/* ── Transform AgentStep[] to TraceEntry[] ── */

function stepsToTraces(steps: AgentStep[]): TraceEntry[] {
  return steps.map((step) => {
    const labels = STEP_LABELS[step.type] || { en: step.type, ja: step.type };
    return {
      id: `trace-${step.stepNumber}`,
      stepNumber: step.stepNumber,
      type: step.type,
      status: step.status,
      label: labels.en,
      labelJa: labels.ja,
      provider: STEP_PROVIDERS[step.type] || 'unknown',
      description: step.description || '',
      tokenUsage: step.tokenUsage,
      cost: step.cost,
      duration: formatDuration(step.startedAt, step.completedAt),
      resultCount: step.type === 'search' && step.output
        ? parseInt(step.output.match(/^(\d+)件/)?.[1] || '0', 10) || undefined
        : undefined,
      visible: true,
    };
  });
}

/* ── Compute dashboard stats ── */

function computeStats(steps: AgentStep[]): DashboardStats {
  const completed = steps.filter((s) => s.status === 'completed').length;
  const totalTokens = steps.reduce(
    (sum, s) => sum + (s.tokenUsage?.total || 0),
    0
  );
  const totalCost = steps.reduce((sum, s) => sum + (s.cost || 0), 0);

  const durations = steps
    .filter((s) => s.startedAt && s.completedAt)
    .map((s) => getDurationMs(s.startedAt, s.completedAt));

  const avgLatency =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length / 1000
      : 0;

  return {
    completedTraces: completed,
    totalTraces: steps.length,
    totalTokens,
    totalCost,
    avgLatency,
  };
}

/* ── Status border color ── */

function statusBorderColor(status: AgentStep['status']): string {
  switch (status) {
    case 'completed':
      return '#16a34a';
    case 'running':
      return '#2563eb';
    case 'error':
      return '#dc2626';
    case 'pending':
    default:
      return '#94a3b8';
  }
}

/* ── Status badge ── */

interface StatusBadgeProps {
  status: AgentStep['status'];
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<
    AgentStep['status'],
    { label: string; color: string; bg: string }
  > = {
    completed: { label: 'PASS', color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
    running: { label: 'RUN', color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
    pending: { label: 'WAIT', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
    error: { label: 'FAIL', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
  };
  const c = config[status];
  return (
    <span
      className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded"
      style={{ color: c.color, backgroundColor: c.bg }}
    >
      {c.label}
    </span>
  );
}

/* ── Summary Stat Card ── */

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="flex items-center gap-2.5 bg-base-surface border border-border rounded px-3 py-2.5 min-w-0">
      <span className="text-status-pass shrink-0" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] text-text-muted uppercase tracking-wider leading-none mb-0.5">
          {label}
        </div>
        <div className="text-sm font-mono tabular-nums text-text-primary font-medium truncate">
          {value}
        </div>
      </div>
    </div>
  );
}

/* ── Stat icons (small, 14px) ── */

function TraceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function TokenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function CostIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LatencyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/* ── Trace Entry Row ── */

interface TraceRowProps {
  trace: TraceEntry;
  index: number;
}

function TraceRow({ trace, index }: TraceRowProps) {
  const isSearch = trace.type === 'search';
  const isRunning = trace.status === 'running';

  return (
    <div
      className="border rounded bg-base-surface overflow-hidden"
      style={{
        borderColor: '#e2e8f0',
        borderLeftWidth: '3px',
        borderLeftColor: statusBorderColor(trace.status),
        animation: `traceSlideIn 0.3s ease-out ${index * 0.08}s both`,
      }}
    >
      {/* Top row: label + provider */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          {isRunning && (
            <span
              className="inline-block w-2 h-2 rounded-full bg-accent shrink-0"
              style={{ animation: 'tracePulse 2s ease-in-out infinite' }}
              aria-hidden="true"
            />
          )}
          {trace.status === 'completed' && (
            <span className="inline-block w-2 h-2 rounded-full bg-status-pass shrink-0" aria-hidden="true" />
          )}
          {trace.status === 'error' && (
            <span className="inline-block w-2 h-2 rounded-full bg-status-fail shrink-0" aria-hidden="true" />
          )}
          {trace.status === 'pending' && (
            <span className="inline-block w-2 h-2 rounded-full bg-text-muted shrink-0" aria-hidden="true" />
          )}
          <span className="text-sm text-text-primary font-medium">
            {trace.label}
            <span className="text-text-muted ml-1">({trace.labelJa})</span>
          </span>
          {isRunning && <LoadingDots />}
        </div>
        <span className="text-[11px] font-mono text-text-muted shrink-0 ml-2">
          {trace.provider}
        </span>
      </div>

      {/* Description row */}
      {trace.description && (
        <div
          className="px-3 pb-1"
          style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
        >
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
            {trace.description}
          </p>
        </div>
      )}

      {/* Bottom row: metrics */}
      {(trace.status === 'completed' || trace.status === 'error') && (
        <div className="flex items-center gap-3 px-3 pb-2.5 pt-1 flex-wrap">
          {isSearch ? (
            <span className="text-[11px] font-mono tabular-nums text-text-secondary">
              {trace.resultCount ?? 0} results
            </span>
          ) : (
            trace.tokenUsage && (
              <span className="text-[11px] font-mono tabular-nums text-text-secondary">
                {trace.tokenUsage.prompt.toLocaleString()}
                <span className="text-text-muted mx-0.5">{'->'}</span>
                {trace.tokenUsage.completion.toLocaleString()} tokens
              </span>
            )
          )}
          {trace.cost != null && trace.cost > 0 && (
            <span className="text-[11px] font-mono tabular-nums text-text-secondary">
              {'\u00A5'}{trace.cost.toFixed(2)}
            </span>
          )}
          {trace.duration && (
            <span className="text-[11px] font-mono tabular-nums text-text-secondary">
              {trace.duration}
            </span>
          )}
          <span className="ml-auto">
            <StatusBadge status={trace.status} />
          </span>
        </div>
      )}
    </div>
  );
}

/* ── FujiTrace Dashboard Panel ── */

interface DashboardPanelProps {
  steps: AgentStep[];
  isRunning: boolean;
}

function DashboardPanel({ steps, isRunning }: DashboardPanelProps) {
  const traces = useMemo(() => stepsToTraces(steps), [steps]);
  const stats = useMemo(() => computeStats(steps), [steps]);
  const traceListRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll trace list to bottom when new traces arrive */
  useEffect(() => {
    if (traceListRef.current) {
      traceListRef.current.scrollTop = traceListRef.current.scrollHeight;
    }
  }, [traces.length]);

  return (
    <div className="bg-white border border-border rounded-lg overflow-hidden">
      {/* Dashboard header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-base-surface">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-text-primary tracking-tight">
            FujiTrace
          </span>
          <span
            className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider"
            style={{ color: isRunning ? '#16a34a' : '#94a3b8' }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: isRunning ? '#16a34a' : '#94a3b8',
                animation: isRunning ? 'tracePulse 2s ease-in-out infinite' : 'none',
              }}
              aria-hidden="true"
            />
            {isRunning ? 'Live' : 'Idle'}
          </span>
        </div>
        <span className="text-[10px] text-text-muted font-mono">
          Trace Dashboard
        </span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-3">
        <StatCard
          label="Traces"
          value={`${stats.completedTraces}/${stats.totalTraces}`}
          icon={<TraceIcon />}
        />
        <StatCard
          label="Tokens"
          value={stats.totalTokens > 0 ? stats.totalTokens.toLocaleString() : '--'}
          icon={<TokenIcon />}
        />
        <StatCard
          label="Cost"
          value={stats.totalCost > 0 ? `\u00A5${stats.totalCost.toFixed(2)}` : '--'}
          icon={<CostIcon />}
        />
        <StatCard
          label="Avg Latency"
          value={stats.avgLatency > 0 ? `${stats.avgLatency.toFixed(1)}s` : '--'}
          icon={<LatencyIcon />}
        />
      </div>

      {/* Trace list */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
            Trace Log
          </span>
          {traces.length > 0 && (
            <span className="text-[10px] text-text-muted font-mono tabular-nums">
              {traces.length} entries
            </span>
          )}
        </div>
        <div
          ref={traceListRef}
          className="space-y-2 overflow-y-auto"
          style={{ maxHeight: '400px' }}
        >
          {traces.length === 0 && (
            <div className="text-center py-8">
              <p className="text-xs text-text-muted">
                調査を開始するとトレースがここに表示されます
              </p>
            </div>
          )}
          {traces.map((trace, i) => (
            <TraceRow key={trace.id} trace={trace} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Markdown Report Panel ── */

interface ReportPanelProps {
  report: ResearchReport | null;
  isRunning: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function ReportPanel({ report, isRunning, isExpanded, onToggle }: ReportPanelProps) {
  return (
    <div className="bg-white border border-border rounded-lg overflow-hidden">
      {/* Report header */}
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-4 py-3 border-b border-border bg-base-surface cursor-pointer text-left"
        aria-expanded={isExpanded}
        aria-controls="report-content"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-text-primary tracking-tight">
            Research Report
          </span>
          {isRunning && !report && (
            <span className="text-[10px] text-text-secondary">生成中...</span>
          )}
          {report && (
            <span className="text-[10px] text-status-pass">完了</span>
          )}
        </div>
        <span className="text-text-muted">
          <ChevronIcon direction={isExpanded ? 'up' : 'down'} />
        </span>
      </button>

      {/* Report body */}
      <div
        id="report-content"
        style={{
          maxHeight: isExpanded ? '600px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.3s ease',
        }}
      >
        {report ? (
          <div
            className="research-markdown p-4 overflow-y-auto"
            style={{
              maxHeight: '580px',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
            }}
          >
            <ReactMarkdown>{report.markdown}</ReactMarkdown>
          </div>
        ) : (
          <div className="p-4 text-center">
            <p className="text-xs text-text-muted">
              {isRunning
                ? 'レポートを生成しています...'
                : 'レポートはまだありません'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Mobile Tab Switcher ── */

type TabId = 'dashboard' | 'report';

interface TabSwitcherProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasReport: boolean;
}

function TabSwitcher({ activeTab, onTabChange, hasReport }: TabSwitcherProps) {
  return (
    <div className="flex border border-border rounded-lg overflow-hidden lg:hidden mb-4">
      <button
        onClick={() => onTabChange('dashboard')}
        className="flex-1 px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
        style={{
          backgroundColor: activeTab === 'dashboard' ? '#f1f5f9' : 'transparent',
          color: activeTab === 'dashboard' ? '#1e293b' : '#94a3b8',
        }}
        aria-pressed={activeTab === 'dashboard'}
      >
        FujiTrace
      </button>
      <button
        onClick={() => onTabChange('report')}
        className="flex-1 px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
        style={{
          backgroundColor: activeTab === 'report' ? '#f1f5f9' : 'transparent',
          color: activeTab === 'report' ? '#1e293b' : '#94a3b8',
        }}
        aria-pressed={activeTab === 'report'}
      >
        {hasReport ? (
          <span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-status-pass mr-1.5 align-middle" aria-hidden="true" />
            レポート
          </span>
        ) : (
          'レポート'
        )}
      </button>
    </div>
  );
}

/* ── Scoped styles ── */

function ScopedStyles() {
  return (
    <style>{`
      @keyframes dotPulse {
        0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
        40% { opacity: 1; transform: scale(1.2); }
      }

      @keyframes traceSlideIn {
        from { opacity: 0; transform: translateX(-12px); }
        to { opacity: 1; transform: translateX(0); }
      }

      @keyframes tracePulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      /* ── Markdown styles (replaces @tailwindcss/typography) ── */

      .research-markdown {
        overflow-wrap: break-word;
        word-break: break-word;
        overflow-x: hidden;
      }

      .research-markdown h1 {
        font-size: 1.375rem;
        font-weight: 600;
        color: #1e293b;
        margin-top: 1.5rem;
        margin-bottom: 0.75rem;
        line-height: 1.3;
      }

      .research-markdown h2 {
        font-size: 1.125rem;
        font-weight: 600;
        color: #1e293b;
        margin-top: 1.25rem;
        margin-bottom: 0.5rem;
        line-height: 1.35;
      }

      .research-markdown h3 {
        font-size: 1rem;
        font-weight: 600;
        color: #1e293b;
        margin-top: 1rem;
        margin-bottom: 0.5rem;
        line-height: 1.4;
      }

      .research-markdown p {
        color: #64748b;
        font-size: 0.8125rem;
        line-height: 1.7;
        margin-top: 0;
        margin-bottom: 0.75rem;
      }

      .research-markdown ul,
      .research-markdown ol {
        color: #64748b;
        font-size: 0.8125rem;
        line-height: 1.7;
        padding-left: 1.25rem;
        margin-top: 0;
        margin-bottom: 0.75rem;
      }

      .research-markdown ul {
        list-style-type: disc;
      }

      .research-markdown ol {
        list-style-type: decimal;
      }

      .research-markdown li {
        color: #64748b;
        margin-bottom: 0.25rem;
      }

      .research-markdown li > ul,
      .research-markdown li > ol {
        margin-top: 0.25rem;
        margin-bottom: 0;
      }

      .research-markdown a {
        color: #2563eb;
        text-decoration: none;
        transition: text-decoration 120ms;
      }

      .research-markdown a:hover {
        text-decoration: underline;
      }

      .research-markdown strong {
        color: #1e293b;
        font-weight: 600;
      }

      .research-markdown code {
        color: #2563eb;
        background: #f1f5f9;
        padding: 0.125rem 0.375rem;
        border-radius: 3px;
        font-size: 0.75rem;
        font-family: 'Geist Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
      }

      .research-markdown pre {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 0.75rem 1rem;
        overflow-x: auto;
        margin-top: 0;
        margin-bottom: 0.75rem;
      }

      .research-markdown pre code {
        background: transparent;
        padding: 0;
        font-size: 0.75rem;
        line-height: 1.6;
      }

      .research-markdown blockquote {
        border-left: 3px solid #e2e8f0;
        padding-left: 1rem;
        margin-left: 0;
        margin-top: 0;
        margin-bottom: 0.75rem;
        font-style: italic;
        color: #64748b;
      }

      .research-markdown hr {
        border: none;
        border-top: 1px solid #e2e8f0;
        margin: 1rem 0;
      }

      .research-markdown table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8125rem;
        margin-bottom: 0.75rem;
      }

      .research-markdown th {
        background: #f8fafc;
        color: #1e293b;
        font-weight: 600;
        text-align: left;
        padding: 0.5rem;
        border: 1px solid #e2e8f0;
      }

      .research-markdown td {
        color: #64748b;
        padding: 0.5rem;
        border: 1px solid #e2e8f0;
      }

      .research-markdown img {
        max-width: 100%;
        height: auto;
      }

      /* First child margin reset */
      .research-markdown > :first-child {
        margin-top: 0;
      }

      /* Line clamp for trace descriptions */
      .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `}</style>
  );
}

/* ── Main ResearchWidget Component ── */

export default function ResearchWidget() {
  const [topic, setTopic] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportExpanded, setReportExpanded] = useState(false);
  const [mobileTab, setMobileTab] = useState<TabId>('dashboard');
  const sectionRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Once report arrives, auto-expand on desktop and switch tab on mobile */
  const prevReportRef = useRef<ResearchReport | null>(null);
  useEffect(() => {
    if (report && !prevReportRef.current) {
      setReportExpanded(true);
      setMobileTab('report');
    }
    prevReportRef.current = report;
  }, [report]);

  /* When switching to report tab on mobile, auto-expand if report exists */
  useEffect(() => {
    if (mobileTab === 'report' && report) {
      setReportExpanded(true);
    }
  }, [mobileTab, report]);

  const hasStarted = steps.length > 0 || isRunning;

  const consumeSSE = useCallback(async (researchTopic: string) => {
    setIsRunning(true);
    setSteps([]);
    setReport(null);
    setError(null);
    setReportExpanded(false);
    setMobileTab('dashboard');

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
    setReportExpanded(false);
    inputRef.current?.focus();
  }, []);

  const handleFloatClick = useCallback(() => {
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      <ScopedStyles />

      {/* ── Inline Section ── */}
      <section
        ref={sectionRef}
        id="research-demo"
        className="py-16 sm:py-24 px-4 sm:px-6"
      >
        <div className="section-container" style={{ maxWidth: hasStarted ? '72rem' : '40rem' }}>
          {/* Section header */}
          <div className="text-center mb-10">
            <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
              LIVE DEMO
            </span>
            <h2 className="text-display-sm font-semibold text-text-primary mb-4">
              AIリサーチエージェント - ライブデモ
            </h2>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-3">
              テーマを入力するだけで、AIが自律的にWeb検索・分析・レポート生成。全ステップはFujiTraceでリアルタイムにトレースされます。
            </p>
            <p className="text-xs text-text-muted max-w-xl mx-auto">
              このデモはFujiTraceのプロキシを通じて実行され、全てのAI通信が記録・可視化されます
            </p>
          </div>

          {/* Input form */}
          <div className="max-w-2xl mx-auto mb-8">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="例: 生成AI市場の最新動向"
                disabled={isRunning}
                className="flex-1 bg-white border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="調査テーマを入力"
              />
              <button
                type="submit"
                disabled={!topic.trim() || isRunning}
                className="px-6 py-3 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                aria-label="調査開始"
              >
                {isRunning ? '調査中...' : '調査開始'}
              </button>
            </form>
            <p className="text-xs text-text-muted mt-2 text-center">
              1時間あたり3回まで実行できます
            </p>

            {/* Error display */}
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* ── Dashboard + Report Area ── */}
          {hasStarted && (
            <div>
              {/* Mobile tabs */}
              <TabSwitcher
                activeTab={mobileTab}
                onTabChange={setMobileTab}
                hasReport={report !== null}
              />

              {/* Desktop: two columns / Mobile: tab-switched */}
              <div className="lg:grid lg:grid-cols-12 lg:gap-5">
                {/* Left: FujiTrace Dashboard (desktop always visible, mobile conditionally) */}
                <div
                  className="lg:col-span-7"
                  style={{
                    display: mobileTab === 'dashboard' ? 'block' : 'none',
                  }}
                >
                  {/* On lg+ always show */}
                  <div className="block">
                    <DashboardPanel steps={steps} isRunning={isRunning} />
                  </div>
                </div>

                {/* Right: Report (desktop always visible, mobile conditionally) */}
                <div
                  className="lg:col-span-5 mt-4 lg:mt-0"
                  style={{
                    display: mobileTab === 'report' ? 'block' : 'none',
                  }}
                >
                  <div className="block">
                    <ReportPanel
                      report={report}
                      isRunning={isRunning}
                      isExpanded={reportExpanded}
                      onToggle={() => setReportExpanded((prev) => !prev)}
                    />
                  </div>

                  {/* Reset button */}
                  {report && !isRunning && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={handleReset}
                        className="px-6 py-2 text-sm text-text-primary border border-border rounded-lg hover:border-accent/50 hover:text-accent transition-colors cursor-pointer"
                        aria-label="新しい調査を開始"
                      >
                        新しい調査
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* On large screens, override display:none for both columns */}
              <style>{`
                @media (min-width: 1024px) {
                  .lg\\:col-span-7,
                  .lg\\:col-span-5 {
                    display: block !important;
                  }
                }
              `}</style>
            </div>
          )}
        </div>
      </section>

      {/* ── Floating Button ── */}
      <button
        onClick={handleFloatClick}
        className="fixed bottom-6 right-20 z-50 w-12 h-12 rounded-full bg-accent hover:bg-accent-hover transition-colors flex items-center justify-center cursor-pointer shadow-lg text-white"
        aria-label="AIリサーチデモへスクロール"
      >
        <SearchIcon />
      </button>
    </>
  );
}
