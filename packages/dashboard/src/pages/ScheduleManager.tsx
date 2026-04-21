/**
 * ScheduleManager — 定期タスク管理 (AI Employee v2, 2026-04-20)
 *
 * Route: /dashboard/schedule
 *
 * 登録済み scheduled task の一覧表示・有効/無効切替・削除・新規作成。
 * 新規作成 UI は「毎週月曜9時」等のプリセット選択または raw cron入力。
 *
 * Data source: GET/POST /api/scheduled-tasks, PATCH/DELETE /api/scheduled-tasks/:id
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Clock, Plus, Trash2, X, Play, Pause,
} from 'lucide-react';
import { fetchJson, isRecord } from '../lib/fetchJson';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ScheduledTask {
  id: string;
  name: string;
  taskKind: string;
  cronExpression: string;
  nextRunAt: string | null;
  enabled: boolean;
  createdAt: string;
}

interface SchedulePayload {
  items: ScheduledTask[];
}

type PresetKey =
  | 'weekday-9am'
  | 'monday-9am'
  | 'monthly-1st-9am'
  | 'daily-6pm'
  | 'custom';

interface PresetOption {
  key: PresetKey;
  label: string;
  cron: string;
}

const PRESETS: PresetOption[] = [
  { key: 'weekday-9am', label: '平日 毎朝 9:00', cron: '0 9 * * 1-5' },
  { key: 'monday-9am', label: '毎週月曜 9:00', cron: '0 9 * * 1' },
  { key: 'monthly-1st-9am', label: '毎月 1 日 9:00', cron: '0 9 1 * *' },
  { key: 'daily-6pm', label: '毎日 18:00', cron: '0 18 * * *' },
  { key: 'custom', label: 'カスタム (raw cron)', cron: '' },
];

const TASK_KINDS: { value: string; label: string }[] = [
  { value: 'morning-briefing', label: '朝のブリーフィング生成' },
  { value: 'invoice-monthly', label: '月次請求書作成' },
  { value: 'gmail-digest', label: 'Gmail ダイジェスト' },
  { value: 'watch-summary', label: 'トレース異常要約' },
  { value: 'custom', label: 'カスタム指示' },
];

/* ------------------------------------------------------------------ */
/*  Mock                                                               */
/* ------------------------------------------------------------------ */

const MOCK_SCHEDULE: ScheduledTask[] = [
  {
    id: 'mock-sch-1',
    name: '朝のブリーフィング',
    taskKind: 'morning-briefing',
    cronExpression: '0 9 * * 1-5',
    nextRunAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
    enabled: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mock-sch-2',
    name: '月次請求書 発行',
    taskKind: 'invoice-monthly',
    cronExpression: '0 9 1 * *',
    nextRunAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
    enabled: false,
    createdAt: new Date().toISOString(),
  },
];

/* ------------------------------------------------------------------ */
/*  Guards                                                             */
/* ------------------------------------------------------------------ */

function isScheduledTask(v: unknown): v is ScheduledTask {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.taskKind === 'string' &&
    typeof v.cronExpression === 'string' &&
    (v.nextRunAt === null || typeof v.nextRunAt === 'string') &&
    typeof v.enabled === 'boolean' &&
    typeof v.createdAt === 'string'
  );
}

function isSchedulePayload(v: unknown): v is SchedulePayload {
  if (!isRecord(v)) return false;
  return Array.isArray(v.items) && v.items.every(isScheduledTask);
}

function taskKindLabel(kind: string): string {
  return TASK_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ja-JP', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function describeCron(expr: string): string {
  const preset = PRESETS.find((p) => p.cron === expr);
  if (preset && preset.key !== 'custom') return preset.label;
  return expr;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ScheduleManager() {
  const [items, setItems] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchJson('/api/scheduled-tasks');
      if (!isSchedulePayload(payload)) throw new Error('invalid payload');
      setItems(payload.items);
      setUsingMock(false);
    } catch {
      setItems(MOCK_SCHEDULE);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async (task: ScheduledTask) => {
    try {
      await fetchJson(`/api/scheduled-tasks/${encodeURIComponent(task.id)}`, {
        method: 'PATCH',
        body: { enabled: !task.enabled },
      });
    } catch {
      // ignore — optimistic update below
    }
    setItems((prev) => prev.map((t) => t.id === task.id ? { ...t, enabled: !t.enabled } : t));
  }, []);

  const remove = useCallback(async (task: ScheduledTask) => {
    if (!window.confirm(`「${task.name}」を削除してよろしいですか？`)) return;
    try {
      await fetchJson(`/api/scheduled-tasks/${encodeURIComponent(task.id)}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
    setItems((prev) => prev.filter((t) => t.id !== task.id));
  }, []);

  const handleCreate = useCallback((draft: Omit<ScheduledTask, 'id' | 'createdAt' | 'nextRunAt'>) => {
    (async () => {
      try {
        const created = await fetchJson('/api/scheduled-tasks', {
          method: 'POST',
          body: draft,
        });
        if (isScheduledTask(created)) {
          setItems((prev) => [created, ...prev]);
          setShowModal(false);
          return;
        }
      } catch {
        // fallthrough to mock
      }
      const mock: ScheduledTask = {
        ...draft,
        id: `local-${Date.now()}`,
        nextRunAt: null,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => [mock, ...prev]);
      setShowModal(false);
    })();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary">定期タスク</h1>
          <p className="text-sm text-text-secondary mt-1">
            cron スケジュールで AI 社員に自動実行させる仕事を管理します。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors duration-120"
          aria-label="新しい定期タスクを追加"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
          新規
        </button>
      </header>

      {usingMock && !loading && (
        <div className="surface-card p-3 text-xs text-text-muted" role="status">
          サンプルデータを表示中（backend API 未接続）
        </div>
      )}

      {error && (
        <div className="surface-card p-3 text-sm text-status-fail" role="alert">{error}</div>
      )}

      {loading ? (
        <ul className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-16 rounded-card bg-base-elevated animate-pulse" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <Clock className="w-10 h-10 text-text-muted mx-auto mb-3" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-sm text-text-secondary mb-4">定期タスクはまだ登録されていません。</p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors duration-120"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            最初のタスクを登録する
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((t) => (
            <li key={t.id} className="surface-card p-4 flex items-center gap-4 flex-wrap">
              <Clock
                className={`w-4 h-4 flex-shrink-0 ${t.enabled ? 'text-accent' : 'text-text-muted'}`}
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-text-primary">{t.name}</span>
                  {!t.enabled && (
                    <span className="text-xs px-1.5 py-0.5 rounded-card bg-base-elevated text-text-muted border border-border">
                      無効
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-muted mt-0.5 flex gap-2 flex-wrap">
                  <span>{taskKindLabel(t.taskKind)}</span>
                  <span>・</span>
                  <span className="font-mono">{describeCron(t.cronExpression)}</span>
                  <span>・</span>
                  <span>次回: {formatDateTime(t.nextRunAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggle(t)}
                  title={t.enabled ? '一時停止' : '再開'}
                  aria-label={t.enabled ? '一時停止する' : '再開する'}
                  className="p-2 text-text-muted hover:text-accent hover:bg-accent/10 rounded-card transition-colors duration-120"
                >
                  {t.enabled ? (
                    <Pause className="w-4 h-4" strokeWidth={1.5} />
                  ) : (
                    <Play className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => remove(t)}
                  title="削除"
                  aria-label="削除"
                  className="p-2 text-text-muted hover:text-status-fail hover:bg-status-fail/10 rounded-card transition-colors duration-120"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <ScheduleModal
          onCancel={() => setShowModal(false)}
          onConfirm={handleCreate}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal                                                              */
/* ------------------------------------------------------------------ */

interface ScheduleModalProps {
  onCancel: () => void;
  onConfirm: (draft: Omit<ScheduledTask, 'id' | 'createdAt' | 'nextRunAt'>) => void;
}

function ScheduleModal({ onCancel, onConfirm }: ScheduleModalProps) {
  const [name, setName] = useState('');
  const [taskKind, setTaskKind] = useState<string>(TASK_KINDS[0]?.value ?? 'custom');
  const [preset, setPreset] = useState<PresetKey>('weekday-9am');
  const [customCron, setCustomCron] = useState('0 9 * * 1-5');

  const cron = preset === 'custom'
    ? customCron
    : PRESETS.find((p) => p.key === preset)?.cron ?? '';

  const canSubmit = name.trim().length > 0 && cron.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onConfirm({
      name: name.trim(),
      taskKind,
      cronExpression: cron.trim(),
      enabled: true,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-card bg-base-surface border border-border shadow-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="schedule-modal-title" className="text-base font-semibold text-text-primary">
            定期タスクを追加
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="閉じる"
            className="p-1 text-text-muted hover:text-text-primary rounded-card transition-colors duration-120"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="sch-name" className="block text-xs text-text-muted mb-1">名前</label>
            <input
              id="sch-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 朝のブリーフィング"
              className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="sch-kind" className="block text-xs text-text-muted mb-1">タスク種別</label>
            <select
              id="sch-kind"
              value={taskKind}
              onChange={(e) => setTaskKind(e.target.value)}
              className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {TASK_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sch-preset" className="block text-xs text-text-muted mb-1">スケジュール</label>
            <select
              id="sch-preset"
              value={preset}
              onChange={(e) => setPreset(e.target.value as PresetKey)}
              className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>

          {preset === 'custom' && (
            <div>
              <label htmlFor="sch-cron" className="block text-xs text-text-muted mb-1">
                cron 式 (分 時 日 月 曜日)
              </label>
              <input
                id="sch-cron"
                type="text"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                placeholder="0 9 * * 1-5"
                className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent font-mono"
              />
              <p className="text-xs text-text-muted mt-1">
                例: 「平日9時」は <code className="font-mono">0 9 * * 1-5</code>
              </p>
            </div>
          )}

          <div className="text-xs text-text-muted bg-base-elevated rounded-card p-3">
            <div>プレビュー</div>
            <div className="font-mono mt-1 text-text-secondary">{cron || '(未設定)'}</div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
          >
            登録
          </button>
        </div>
      </div>
    </div>
  );
}
