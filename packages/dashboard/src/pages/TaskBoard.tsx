/**
 * TaskBoard — タスクボード 3列 Kanban (AI Employee v1, 2026-04-20)
 *
 * Route: /dashboard/tasks
 *
 * 3列: 昨日完了 / 今日実行 / 保留中。各カードにタイトル・種別・ステータス badge。
 * クリック詳細画面は Phase 2、今は alert(titleOrId) で stub。
 *
 * Data source: GET /api/workspace/tasks (backend 並行実装中、不在時はモック)
 */

import { useEffect, useState, useCallback } from 'react';
import {
  FileText, Receipt, Package, ShoppingCart, Mail, Layers,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DocumentKind = 'estimate' | 'invoice' | 'delivery-note' | 'purchase-order' | 'cover-letter' | 'other';
type TaskStatus = 'completed' | 'in_progress' | 'pending' | 'failed';
type Column = 'completed-yesterday' | 'today' | 'pending';

interface TaskItem {
  id: string;
  title: string;
  kind: DocumentKind;
  status: TaskStatus;
  column: Column;
  updatedAt: string; // ISO
}

interface TasksPayload {
  tasks: TaskItem[];
}

/* ------------------------------------------------------------------ */
/*  Mock fallback                                                      */
/* ------------------------------------------------------------------ */

const MOCK_TASKS: TasksPayload = {
  tasks: [
    {
      id: 'mock-1',
      title: '株式会社サンプル商事 向け 見積書',
      kind: 'estimate',
      status: 'completed',
      column: 'completed-yesterday',
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'mock-2',
      title: '月次請求書 (4月分)',
      kind: 'invoice',
      status: 'completed',
      column: 'completed-yesterday',
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'mock-3',
      title: '発注書 (ベンダー様)',
      kind: 'purchase-order',
      status: 'in_progress',
      column: 'today',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mock-4',
      title: '納品書 (株式会社サンプル商事)',
      kind: 'delivery-note',
      status: 'pending',
      column: 'today',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mock-5',
      title: '送付状 (見積書添付用)',
      kind: 'cover-letter',
      status: 'pending',
      column: 'pending',
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'mock-6',
      title: '請求書チェック (3月分)',
      kind: 'invoice',
      status: 'failed',
      column: 'pending',
      updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isTasksPayload(v: unknown): v is TasksPayload {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.tasks);
}

function unwrapEnvelope(v: unknown): unknown {
  if (typeof v !== 'object' || v === null) return v;
  const o = v as Record<string, unknown>;
  if (o.success === true && 'data' in o) return o.data;
  return v;
}

function kindIcon(kind: DocumentKind): React.ReactNode {
  const common = 'w-3.5 h-3.5';
  switch (kind) {
    case 'estimate': return <FileText className={common} strokeWidth={1.5} />;
    case 'invoice': return <Receipt className={common} strokeWidth={1.5} />;
    case 'delivery-note': return <Package className={common} strokeWidth={1.5} />;
    case 'purchase-order': return <ShoppingCart className={common} strokeWidth={1.5} />;
    case 'cover-letter': return <Mail className={common} strokeWidth={1.5} />;
    default: return <Layers className={common} strokeWidth={1.5} />;
  }
}

function kindLabel(kind: DocumentKind): string {
  switch (kind) {
    case 'estimate': return '見積書';
    case 'invoice': return '請求書';
    case 'delivery-note': return '納品書';
    case 'purchase-order': return '発注書';
    case 'cover-letter': return '送付状';
    default: return 'その他';
  }
}

function statusBadge(status: TaskStatus): { label: string; className: string } {
  switch (status) {
    case 'completed':
      return { label: '完了', className: 'bg-status-pass/10 text-status-pass border border-status-pass/20' };
    case 'in_progress':
      return { label: '進行中', className: 'bg-accent/10 text-accent border border-accent/20' };
    case 'pending':
      return { label: '未着手', className: 'bg-base-elevated text-text-secondary border border-border' };
    case 'failed':
      return { label: '失敗', className: 'bg-status-fail/10 text-status-fail border border-status-fail/20' };
  }
}

const COLUMN_META: Record<Column, { title: string; description: string }> = {
  'completed-yesterday': { title: '昨日完了', description: '昨日までに完了したタスク' },
  'today': { title: '今日実行', description: '今日進行中または予定のタスク' },
  'pending': { title: '保留中', description: '未完了・要対応のタスク' },
};

const COLUMN_ORDER: Column[] = ['completed-yesterday', 'today', 'pending'];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function TaskBoard() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workspace/tasks', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json: unknown = await res.json();
      const payload = unwrapEnvelope(json);
      if (!isTasksPayload(payload)) {
        throw new Error('invalid tasks payload');
      }
      setTasks(payload.tasks);
      setUsingMock(false);
    } catch {
      setTasks(MOCK_TASKS.tasks);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleCardClick = useCallback((task: TaskItem) => {
    // Phase 2 で詳細画面を実装。Phase 0 は stub。
    window.alert(`${task.title}\n(ID: ${task.id})`);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>, task: TaskItem) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick(task);
    }
  }, [handleCardClick]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-text-primary">タスク</h1>
        <p className="text-sm text-text-secondary">
          おしごと AIが進行中・完了・保留中のタスクを一覧で確認できます。
        </p>
      </header>

      {usingMock && !loading && (
        <div className="surface-card p-3 text-xs text-text-muted border-dashed" role="status">
          サンプルデータを表示中（backend API 未接続）
        </div>
      )}

      {error && (
        <div className="surface-card p-3 text-sm text-status-fail" role="alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMN_ORDER.map((col) => {
          const meta = COLUMN_META[col];
          const columnTasks = tasks.filter((t) => t.column === col);
          return (
            <section
              key={col}
              aria-labelledby={`tb-${col}-heading`}
              className="surface-card p-4 min-h-[280px]"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 id={`tb-${col}-heading`} className="text-sm font-semibold text-text-primary">
                    {meta.title}
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">{meta.description}</p>
                </div>
                <span
                  className="text-xs font-mono tabular-nums text-text-secondary bg-base-elevated px-2 py-0.5 rounded-card"
                  aria-label={`${meta.title} のタスク数`}
                >
                  {columnTasks.length}
                </span>
              </div>

              {loading ? (
                <TaskColumnSkeleton />
              ) : columnTasks.length === 0 ? (
                <p className="text-xs text-text-muted py-6 text-center">タスクはありません。</p>
              ) : (
                <ul className="space-y-2">
                  {columnTasks.map((task) => {
                    const badge = statusBadge(task.status);
                    return (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => handleCardClick(task)}
                          onKeyDown={(e) => handleKeyDown(e, task)}
                          aria-label={`${task.title} の詳細を開く`}
                          className="w-full text-left p-3 rounded-card bg-base-elevated hover:bg-base-elevated/80 border border-transparent hover:border-border transition-colors duration-120 focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                          <p className="text-sm text-text-primary mb-2 line-clamp-2">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                              {kindIcon(task.kind)}
                              {kindLabel(task.kind)}
                            </span>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded-card ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function TaskColumnSkeleton() {
  return (
    <ul className="space-y-2" aria-busy="true" aria-label="読み込み中">
      {Array.from({ length: 2 }).map((_, i) => (
        <li
          key={i}
          className="h-20 rounded-card bg-base-elevated animate-pulse"
        />
      ))}
    </ul>
  );
}
