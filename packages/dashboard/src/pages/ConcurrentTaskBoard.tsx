/**
 * ConcurrentTaskBoard — 並列実行ビュー (AI Employee v2, 2026-04-20)
 *
 * Route: /dashboard/running
 *
 * 実行中タスク (queue status) + 直近完了 + キュー溢れ警告。
 * 5 秒 polling (setInterval)。SSE は backend 実装時に差し替え可能。
 *
 * Data source:
 *   - GET /api/queue/status  → { running, queued, completed, capacity }
 *   - GET /api/queue/tasks   → { tasks: RunningTask[] }
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react';
import { fetchJson, isRecord } from '../lib/fetchJson';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type RunStatus = 'running' | 'queued' | 'completed' | 'failed';

interface RunningTask {
  id: string;
  title: string;
  status: RunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  progressPercent: number;
}

interface QueueStatus {
  running: number;
  queued: number;
  completedRecent: number;
  capacity: number;
}

interface TasksPayload {
  tasks: RunningTask[];
}

/* ------------------------------------------------------------------ */
/*  Mock                                                               */
/* ------------------------------------------------------------------ */

const MOCK_STATUS: QueueStatus = {
  running: 2,
  queued: 1,
  completedRecent: 5,
  capacity: 5,
};

const MOCK_TASKS: RunningTask[] = [
  {
    id: 'mock-r1',
    title: '請求書チェック (4月分)',
    status: 'running',
    startedAt: new Date(Date.now() - 60 * 1000).toISOString(),
    finishedAt: null,
    progressPercent: 60,
  },
  {
    id: 'mock-r2',
    title: '見積書作成 (サンプル商事)',
    status: 'running',
    startedAt: new Date(Date.now() - 20 * 1000).toISOString(),
    finishedAt: null,
    progressPercent: 20,
  },
  {
    id: 'mock-r3',
    title: '納品書作成 (予約中)',
    status: 'queued',
    startedAt: null,
    finishedAt: null,
    progressPercent: 0,
  },
  {
    id: 'mock-r4',
    title: '発注書作成 完了',
    status: 'completed',
    startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    finishedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    progressPercent: 100,
  },
];

/* ------------------------------------------------------------------ */
/*  Guards                                                             */
/* ------------------------------------------------------------------ */

function isQueueStatus(v: unknown): v is QueueStatus {
  if (!isRecord(v)) return false;
  return (
    typeof v.running === 'number' &&
    typeof v.queued === 'number' &&
    typeof v.completedRecent === 'number' &&
    typeof v.capacity === 'number'
  );
}

function isRunningTask(v: unknown): v is RunningTask {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    (v.status === 'running' || v.status === 'queued' || v.status === 'completed' || v.status === 'failed') &&
    (v.startedAt === null || typeof v.startedAt === 'string') &&
    (v.finishedAt === null || typeof v.finishedAt === 'string') &&
    typeof v.progressPercent === 'number'
  );
}

function isTasksPayload(v: unknown): v is TasksPayload {
  if (!isRecord(v)) return false;
  return Array.isArray(v.tasks) && v.tasks.every(isRunningTask);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ConcurrentTaskBoard() {
  const [status, setStatus] = useState<QueueStatus>(MOCK_STATUS);
  const [tasks, setTasks] = useState<RunningTask[]>(MOCK_TASKS);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    let mockMode = false;
    try {
      const [s, t] = await Promise.all([
        fetchJson('/api/queue/status'),
        fetchJson('/api/queue/tasks'),
      ]);
      if (!isQueueStatus(s) || !isTasksPayload(t)) throw new Error('invalid');
      setStatus(s);
      setTasks(t.tasks);
    } catch {
      setStatus(MOCK_STATUS);
      setTasks(MOCK_TASKS);
      mockMode = true;
    } finally {
      setLoading(false);
      setUsingMock(mockMode);
    }
  }, []);

  useEffect(() => {
    load();
    pollRef.current = window.setInterval(load, 5000);
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    };
  }, [load]);

  const overflow = status.queued > 0 && status.running >= status.capacity;
  const running = tasks.filter((t) => t.status === 'running');
  const queued = tasks.filter((t) => t.status === 'queued');
  const recentlyDone = tasks
    .filter((t) => t.status === 'completed' || t.status === 'failed')
    .slice(0, 5);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-text-primary">並列実行ビュー</h1>
        <p className="text-sm text-text-secondary">
          AI 社員が同時に走らせているタスクをリアルタイムで確認します（5 秒毎に自動更新）。
        </p>
      </header>

      {usingMock && !loading && (
        <div className="surface-card p-3 text-xs text-text-muted" role="status">
          サンプルデータを表示中（backend API 未接続）
        </div>
      )}

      {/* Metrics */}
      <section aria-label="キュー状態" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="実行中" value={status.running} icon={<Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />} tone="accent" />
        <MetricCard label="待機中" value={status.queued} icon={<Activity className="w-4 h-4" strokeWidth={1.5} />} tone="neutral" />
        <MetricCard label="直近完了" value={status.completedRecent} icon={<CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />} tone="pass" />
        <MetricCard label="同時実行上限" value={status.capacity} icon={<Activity className="w-4 h-4" strokeWidth={1.5} />} tone="neutral" />
      </section>

      {overflow && (
        <div className="surface-card p-4 flex items-start gap-3 border-l-[3px] border-l-status-warn" role="alert">
          <AlertTriangle className="w-5 h-5 text-status-warn flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-text-primary">同時実行上限に到達しています</p>
            <p className="text-xs text-text-secondary mt-0.5">
              新規タスクは待機キューに入ります。並列数を増やすにはプランのアップグレードをご検討ください。
            </p>
          </div>
        </div>
      )}

      {/* Running */}
      <section aria-labelledby="running-heading" className="surface-card p-5">
        <h2 id="running-heading" className="text-sm font-semibold text-text-primary mb-3">
          実行中 ({running.length})
        </h2>
        {running.length === 0 ? (
          <p className="text-xs text-text-muted py-4 text-center">実行中のタスクはありません。</p>
        ) : (
          <ul className="space-y-2">
            {running.map((t) => <RunningRow key={t.id} task={t} />)}
          </ul>
        )}
      </section>

      {/* Queued */}
      <section aria-labelledby="queued-heading" className="surface-card p-5">
        <h2 id="queued-heading" className="text-sm font-semibold text-text-primary mb-3">
          待機中 ({queued.length})
        </h2>
        {queued.length === 0 ? (
          <p className="text-xs text-text-muted py-4 text-center">待機中のタスクはありません。</p>
        ) : (
          <ul className="space-y-2">
            {queued.map((t) => (
              <li key={t.id} className="p-3 rounded-card bg-base-elevated text-sm text-text-secondary">
                {t.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recently finished */}
      <section aria-labelledby="done-heading" className="surface-card p-5">
        <h2 id="done-heading" className="text-sm font-semibold text-text-primary mb-3">
          直近完了 ({recentlyDone.length})
        </h2>
        {recentlyDone.length === 0 ? (
          <p className="text-xs text-text-muted py-4 text-center">最近完了したタスクはありません。</p>
        ) : (
          <ul className="space-y-2">
            {recentlyDone.map((t) => (
              <li
                key={t.id}
                className={`p-3 rounded-card flex items-center gap-3 ${
                  t.status === 'failed'
                    ? 'bg-status-fail/10 border border-status-fail/20'
                    : 'bg-base-elevated'
                }`}
              >
                {t.status === 'failed' ? (
                  <AlertTriangle className="w-4 h-4 text-status-fail flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-status-pass flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
                )}
                <span className="text-sm text-text-primary flex-1 truncate">{t.title}</span>
                <span className="text-xs text-text-muted font-mono tabular-nums">
                  {t.finishedAt ? new Date(t.finishedAt).toLocaleTimeString('ja-JP') : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface MetricCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: 'accent' | 'pass' | 'neutral';
}

function MetricCard({ label, value, icon, tone }: MetricCardProps) {
  const toneClass =
    tone === 'accent' ? 'text-accent' : tone === 'pass' ? 'text-status-pass' : 'text-text-secondary';
  return (
    <div className="surface-card p-4">
      <div className="flex items-center gap-2">
        <span className={toneClass}>{icon}</span>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-semibold text-text-primary font-mono tabular-nums">
        {value}
      </div>
    </div>
  );
}

function RunningRow({ task }: { task: RunningTask }) {
  const pct = Math.max(0, Math.min(100, task.progressPercent));
  return (
    <li className="p-3 rounded-card bg-base-elevated">
      <div className="flex items-center gap-2 mb-2">
        <Loader2 className="w-3.5 h-3.5 text-accent animate-spin flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span className="text-sm text-text-primary flex-1 truncate">{task.title}</span>
        <span className="text-xs text-text-muted font-mono tabular-nums">{pct}%</span>
      </div>
      <div
        className="h-1.5 rounded-full bg-base overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}
