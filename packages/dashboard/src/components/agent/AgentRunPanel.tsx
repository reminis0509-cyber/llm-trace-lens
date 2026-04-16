/* ------------------------------------------------------------------ */
/*  AgentRunPanel — visualizes Plan → Execute → Review for autonomous agent */
/*  Renders SSE events emitted by /api/agent/contract-chat              */
/* ------------------------------------------------------------------ */

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {
  AgentSseEvent,
  AgentPlan,
  AgentAttachment,
  AgentReviewStatus,
} from '../../types/agent';

interface AgentRunPanelProps {
  events: AgentSseEvent[];
  isRunning: boolean;
  companyInfo?: { company_name?: string; [k: string]: unknown };
  onOpenAttachment: (att: AgentAttachment) => void;
}

interface StepState {
  index: number;
  tool: string;
  status: 'pending' | 'running' | 'ok' | 'failed';
  result?: Record<string, unknown>;
  error?: string;
}

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

/* ─── Icons ────────────────────────────────────────────────────────── */

function Spinner() {
  return (
    <svg className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function PendingDot() {
  return (
    <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
    </svg>
  );
}

/* Phase icons for section headers */
function PlanIcon() {
  return (
    <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}
function ExecuteIcon() {
  return (
    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}
function ReviewIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

/* ─── Error code to user-friendly label mapping ───────────────────── */

const ERROR_LABELS: Record<string, { label: string; description: string }> = {
  CONTRACT_VIOLATION: {
    label: '契約違反',
    description: '禁止されたツールが呼び出されました。この違反はチームに報告されました。',
  },
  BUDGET_EXCEEDED: {
    label: '予算超過',
    description: '実行コストが上限に達しました。管理者にお問い合わせください。',
  },
  MAX_ITERATIONS: {
    label: '反復上限',
    description: 'エージェントの最大反復回数に達しました。指示を簡潔にして再試行してください。',
  },
  TIMEOUT: {
    label: 'タイムアウト',
    description: '処理時間が上限を超えました。タスクを分割して再試行してください。',
  },
  PRO_REQUIRED: {
    label: 'Pro プラン限定',
    description: 'この機能は Pro プラン以上でご利用いただけます。',
  },
};

/* ─── Event reducers ───────────────────────────────────────────────── */

interface DerivedRunState {
  plan: AgentPlan | null;
  steps: StepState[];
  question: { stepIndex: number; question: string } | null;
  review: { status: AgentReviewStatus; arithmeticOk?: boolean; notes?: string } | null;
  final: { reply: string; attachments?: AgentAttachment[] } | null;
  error: { code: string; message: string; stepIndex?: number } | null;
}

function deriveState(events: AgentSseEvent[]): DerivedRunState {
  const state: DerivedRunState = {
    plan: null,
    steps: [],
    question: null,
    review: null,
    final: null,
    error: null,
  };

  for (const ev of events) {
    switch (ev.type) {
      case 'plan': {
        state.plan = ev.plan;
        state.steps = ev.plan.steps.map((s, i) => ({
          index: i,
          tool: s.tool,
          status: 'pending',
        }));
        break;
      }
      case 'step_start': {
        const s = state.steps[ev.stepIndex];
        if (s) s.status = 'running';
        break;
      }
      case 'step_result': {
        const s = state.steps[ev.stepIndex];
        if (s) {
          s.status = ev.status === 'ok' ? 'ok' : 'failed';
          s.result = ev.result;
          s.error = ev.error;
        }
        break;
      }
      case 'question': {
        state.question = { stepIndex: ev.stepIndex, question: ev.question };
        break;
      }
      case 'review': {
        state.review = {
          status: ev.status,
          arithmeticOk: ev.arithmeticOk,
          notes: ev.notes,
        };
        break;
      }
      case 'final': {
        state.final = { reply: ev.reply, attachments: ev.attachments };
        break;
      }
      case 'error': {
        state.error = { code: ev.code, message: ev.message, stepIndex: ev.stepIndex };
        break;
      }
      default:
        break;
    }
  }
  return state;
}

/* ─── Step row ─────────────────────────────────────────────────────── */

function StepRow({ step, planReason }: { step: StepState; planReason?: string }) {
  const elapsed = useElapsedSeconds(step.status === 'running');
  let icon: React.ReactNode;
  let borderClass = 'border-l-gray-200';
  let bgClass = 'bg-gray-50/50';

  if (step.status === 'pending') {
    icon = <PendingDot />;
  } else if (step.status === 'running') {
    icon = <Spinner />;
    borderClass = 'border-l-blue-500';
    bgClass = 'bg-blue-50/30';
  } else if (step.status === 'ok') {
    icon = <CheckIcon />;
    borderClass = 'border-l-green-500';
    bgClass = 'bg-gray-50';
  } else {
    icon = <CrossIcon />;
    borderClass = 'border-l-red-500';
    bgClass = 'bg-red-50/30';
  }

  return (
    <div className="relative pl-8 pb-3">
      <div
        className={`absolute left-[5px] top-1.5 w-3.5 h-3.5 rounded-full border-2 ${
          step.status === 'pending'
            ? 'border-gray-200 bg-gray-50'
            : step.status === 'running'
              ? 'border-blue-500 bg-blue-50'
              : step.status === 'ok'
                ? 'border-green-500 bg-green-50'
                : 'border-red-500 bg-red-50'
        }`}
      />
      <div className={`rounded-lg border border-l-[3px] ${borderClass} border-t-gray-100 border-r-gray-100 border-b-gray-100 ${bgClass} p-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            <span className="text-sm font-medium text-gray-800 truncate">
              Step {step.index + 1}
            </span>
            <code className="text-xs text-gray-500 font-mono truncate">{step.tool}</code>
            {step.status === 'running' && (
              <span className="text-xs text-blue-500">実行中…</span>
            )}
            {step.status === 'ok' && <span className="text-xs text-green-600">完了</span>}
          </div>
          {step.status === 'running' && (
            <span className="text-xs text-blue-500 font-mono tabular-nums">{elapsed}s</span>
          )}
        </div>
        {planReason && step.status === 'pending' && (
          <p className="mt-1 pl-6 text-xs text-gray-500">理由: {planReason}</p>
        )}
        {step.status === 'failed' && step.error && (
          <details className="mt-2 pl-6">
            <summary className="text-xs text-red-600 cursor-pointer hover:underline">
              エラー詳細
            </summary>
            <pre className="mt-1 text-xs text-red-700 whitespace-pre-wrap break-all bg-red-50 p-2 rounded">
              {step.error}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/* ─── Review badge ─────────────────────────────────────────────────── */

function ReviewBadge({ status, notes }: { status: AgentReviewStatus; notes?: string }) {
  if (status === 'ok') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
        <CheckIcon />
        <div className="text-sm text-green-800">
          <span className="font-medium">算術チェック OK</span>
          {notes && <p className="mt-0.5 text-xs text-green-700">{notes}</p>}
        </div>
      </div>
    );
  }
  if (status === 'warning') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <span className="text-amber-600 font-medium text-sm">警告</span>
        <div className="text-sm text-amber-800">
          {notes && <p className="text-xs">{notes}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <CrossIcon />
      <div className="text-sm text-red-800">
        <span className="font-medium">レビュー失敗</span>
        {notes && <p className="mt-0.5 text-xs text-red-700">{notes}</p>}
      </div>
    </div>
  );
}

/* ─── Phase progress indicator ────────────────────────────────────── */

type Phase = 'plan' | 'execute' | 'review' | 'done';

function PhaseProgress({ current }: { current: Phase }) {
  const phases: { key: Phase; label: string }[] = [
    { key: 'plan', label: '計画' },
    { key: 'execute', label: '実行' },
    { key: 'review', label: '検証' },
  ];
  const order: Phase[] = ['plan', 'execute', 'review', 'done'];
  const currentIdx = order.indexOf(current);

  return (
    <div className="flex items-center gap-1" aria-label="実行フェーズ">
      {phases.map((p, i) => {
        const phaseIdx = order.indexOf(p.key);
        const isActive = phaseIdx === currentIdx;
        const isComplete = phaseIdx < currentIdx;
        return (
          <div key={p.key} className="flex items-center gap-1">
            {i > 0 && (
              <div className={`w-6 h-px ${isComplete ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : isComplete
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {isComplete ? '-- ' : ''}{p.label}{isComplete ? '' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main panel ───────────────────────────────────────────────────── */

export default function AgentRunPanel({
  events,
  isRunning,
  companyInfo,
  onOpenAttachment,
}: AgentRunPanelProps) {
  const state = useMemo(() => deriveState(events), [events]);
  const totalElapsed = useElapsedSeconds(isRunning);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as new events arrive
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [events.length]);

  if (events.length === 0 && !isRunning) {
    return null;
  }

  // Determine current phase
  const currentPhase: Phase = state.final || (!isRunning && events.length > 0)
    ? 'done'
    : state.review
      ? 'review'
      : state.steps.some((s) => s.status === 'running' || s.status === 'ok' || s.status === 'failed')
        ? 'execute'
        : 'plan';

  const errorInfo = state.error ? ERROR_LABELS[state.error.code] : null;

  return (
    <div className="w-full rounded-xl border border-gray-100 bg-white p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">自律実行</span>
          {companyInfo?.company_name && (
            <span className="text-xs text-gray-500">/ {companyInfo.company_name}</span>
          )}
          {isRunning && (
            <span className="text-xs text-blue-500 font-mono tabular-nums">{totalElapsed}s</span>
          )}
        </div>
        <PhaseProgress current={currentPhase} />
      </div>

      {/* Plan section */}
      {state.plan && (
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">
            <PlanIcon />
            計画
          </h4>
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-3">
            <p className="text-sm text-gray-800">{state.plan.summary}</p>
            <ol className="mt-2 space-y-1 text-xs text-gray-600">
              {state.plan.steps.map((s, i) => (
                <li key={i} className="flex items-baseline gap-1.5">
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold">
                    {i + 1}
                  </span>
                  <code className="font-mono text-gray-500">{s.tool}</code>
                  {s.reason && <span className="text-gray-500"> -- {s.reason}</span>}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Execute section */}
      {state.steps.length > 0 && (
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
            <ExecuteIcon />
            実行
            {isRunning && state.steps.some((s) => s.status === 'running') && (
              <Spinner />
            )}
          </h4>
          <div className="relative">
            <div className="absolute left-[13px] top-0 bottom-0 w-px bg-gray-200" />
            {state.steps.map((step, i) => (
              <StepRow
                key={i}
                step={step}
                planReason={state.plan?.steps[i]?.reason}
              />
            ))}
          </div>
        </section>
      )}

      {/* Question section */}
      {state.question && (
        <section>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
              <AlertIcon />
              情報不足
            </h4>
            <p className="text-sm text-amber-900">{state.question.question}</p>
            <p className="mt-2 text-xs text-amber-700">
              現在のバージョンでは対話応答は未対応です。指示に情報を追加して再実行してください。
            </p>
          </div>
        </section>
      )}

      {/* Review section */}
      {state.review && (
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">
            <ReviewIcon />
            検証
          </h4>
          <ReviewBadge status={state.review.status} notes={state.review.notes} />
        </section>
      )}

      {/* Final section */}
      {state.final && (
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            <CheckIcon />
            結果
          </h4>
          <div className="rounded-lg border border-gray-100 bg-white p-4 prose prose-sm max-w-none prose-headings:text-gray-800 prose-strong:text-gray-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.final.reply}</ReactMarkdown>
          </div>
          {state.final.attachments && state.final.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {state.final.attachments.map((att, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onOpenAttachment(att)}
                  className="px-3 py-1.5 text-xs text-accent border border-accent rounded-card hover:bg-accent/5 transition-colors"
                  aria-label={`添付ファイル ${att.filename ?? i + 1} を開く`}
                >
                  {att.filename ?? `添付 ${i + 1}`}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Error section */}
      {state.error && (
        <section>
          <div
            className={`rounded-lg border p-4 ${
              state.error.code === 'CONTRACT_VIOLATION'
                ? 'border-red-300 bg-red-50'
                : state.error.code === 'BUDGET_EXCEEDED'
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-red-200 bg-red-50/70'
            }`}
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertIcon />
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-red-800">
                  {errorInfo?.label ?? state.error.code}
                </h4>
                <p className="mt-1 text-sm text-red-900">{state.error.message}</p>
                {errorInfo?.description && (
                  <p className="mt-1.5 text-xs text-red-700">{errorInfo.description}</p>
                )}
                {state.error.stepIndex !== undefined && (
                  <p className="mt-1 text-xs text-red-600">
                    Step {state.error.stepIndex + 1} で発生
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Beta caution */}
      <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
        ベータ機能です。承認・送信は必ず手動で行ってください。
      </p>
      <div ref={endRef} />
    </div>
  );
}
