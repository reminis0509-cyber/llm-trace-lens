import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ResearchReport } from '../agent/types';

interface ReportViewProps {
  report: ResearchReport | null;
}

export function ReportView({ report }: ReportViewProps) {
  if (!report) {
    return null;
  }

  return (
    <div className="fade-in-up">
      {/* Report header */}
      <ReportHeader report={report} />

      {/* Markdown content */}
      <div className="mt-4 bg-zinc-800/30 border border-zinc-700/40 rounded-lg p-6 md:p-8">
        <div className="markdown-body">
          <ReactMarkdown>{report.markdown}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

interface ReportHeaderProps {
  report: ResearchReport;
}

function ReportHeader({ report }: ReportHeaderProps) {
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
    <div>
      <h2 className="text-xl font-bold text-zinc-100 mb-3">
        {report.title}
      </h2>

      {/* Metadata badges */}
      <div className="flex flex-wrap gap-3">
        <MetadataBadge
          icon={<ClockIcon />}
          label="実行時間"
          value={durationDisplay}
        />
        <MetadataBadge
          icon={<TokenIcon />}
          label="トークン"
          value={tokenDisplay}
        />
        <MetadataBadge
          icon={<CostIcon />}
          label="コスト"
          value={costDisplay}
        />
        <MetadataBadge
          icon={<StepIcon />}
          label="ステップ"
          value={`${report.steps.length}`}
        />
      </div>
    </div>
  );
}

interface MetadataBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function MetadataBadge({ icon, label, value }: MetadataBadgeProps) {
  return (
    <div className="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/40 rounded-md px-3 py-1.5">
      <span className="text-amber-500" aria-hidden="true">{icon}</span>
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span className="text-sm font-medium text-zinc-200 tabular-nums">{value}</span>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TokenIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function CostIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function StepIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}
