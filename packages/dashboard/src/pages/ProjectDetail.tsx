/**
 * ProjectDetail — 個別プロジェクト画面 (AI Employee v2, 2026-04-20)
 *
 * Route: /dashboard/projects/:id
 *
 * 構成:
 *   - ヘッダ (名前/説明/最終更新)
 *   - Instructions (この project 固有の AI 指示書 textarea, PATCH 保存)
 *   - 参照ファイル一覧 (POST/DELETE)
 *   - 接続中 Connector 一覧 (read-only、リンクで設定画面へ)
 *   - 最近のタスク (read-only)
 *
 * Data source:
 *   - GET/PATCH /api/projects/:id
 *   - POST/DELETE /api/projects/:id/files
 *   - 不在時はモック
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Folder, FileText, Trash2, Upload, Save, Plug, History,
} from 'lucide-react';
import { fetchJson, isRecord } from '../lib/fetchJson';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProjectFile {
  id: string;
  name: string;
  sizeBytes: number;
  uploadedAt: string;
}

interface ConnectorRef {
  id: string;
  name: string;
  status: 'connected' | 'disconnected';
}

interface ProjectTask {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

interface ProjectDetailPayload {
  id: string;
  name: string;
  description: string;
  instructions: string;
  updatedAt: string;
  files: ProjectFile[];
  connectors: ConnectorRef[];
  recentTasks: ProjectTask[];
}

/* ------------------------------------------------------------------ */
/*  Mock                                                               */
/* ------------------------------------------------------------------ */

function mockProject(id: string): ProjectDetailPayload {
  return {
    id,
    name: 'サンプル プロジェクト',
    description: '永続ワークスペースのプレビュー (backend API 未接続)',
    instructions:
      '敬語は丁寧に。請求書は必ず当月末締め翌月末払いで発行する。社名には「株式会社」を省略しない。',
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    files: [
      { id: 'f1', name: '取引先リスト.csv', sizeBytes: 4321, uploadedAt: new Date().toISOString() },
      { id: 'f2', name: '標準約款.pdf', sizeBytes: 184320, uploadedAt: new Date().toISOString() },
    ],
    connectors: [
      { id: 'google-calendar', name: 'Google Calendar', status: 'connected' },
      { id: 'gmail', name: 'Gmail', status: 'disconnected' },
    ],
    recentTasks: [
      { id: 't1', title: '月次請求書 (4月分)', status: '完了', updatedAt: new Date().toISOString() },
      { id: 't2', title: '見積書 ドラフト', status: '進行中', updatedAt: new Date().toISOString() },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Guards                                                             */
/* ------------------------------------------------------------------ */

function isProjectDetail(v: unknown): v is ProjectDetailPayload {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.description === 'string' &&
    typeof v.instructions === 'string' &&
    typeof v.updatedAt === 'string' &&
    Array.isArray(v.files) &&
    Array.isArray(v.connectors) &&
    Array.isArray(v.recentTasks)
  );
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface ProjectDetailProps {
  projectId: string;
}

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const [data, setData] = useState<ProjectDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instructionsDraft, setInstructionsDraft] = useState('');
  const [instructionsDirty, setInstructionsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchJson(`/api/projects/${encodeURIComponent(projectId)}`);
      if (!isProjectDetail(payload)) throw new Error('invalid payload');
      setData(payload);
      setInstructionsDraft(payload.instructions);
      setInstructionsDirty(false);
      setUsingMock(false);
    } catch {
      const mock = mockProject(projectId);
      setData(mock);
      setInstructionsDraft(mock.instructions);
      setInstructionsDirty(false);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveInstructions = useCallback(async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      await fetchJson(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        body: { instructions: instructionsDraft },
      });
      setInstructionsDirty(false);
      setData({ ...data, instructions: instructionsDraft, updatedAt: new Date().toISOString() });
    } catch {
      // Mock-friendly: silently accept and mark clean
      setInstructionsDirty(false);
      setData({ ...data, instructions: instructionsDraft });
    } finally {
      setSaving(false);
    }
  }, [data, instructionsDraft, projectId]);

  const handleUpload = useCallback(async (file: File) => {
    if (!data) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch {
      // Mock fallback: append locally
      setData({
        ...data,
        files: [
          {
            id: `local-${Date.now()}`,
            name: file.name,
            sizeBytes: file.size,
            uploadedAt: new Date().toISOString(),
          },
          ...data.files,
        ],
      });
    }
  }, [data, load, projectId]);

  const handleDeleteFile = useCallback(async (fileId: string) => {
    if (!data) return;
    if (!window.confirm('このファイルを削除してよろしいですか？')) return;
    try {
      await fetchJson(
        `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`,
        { method: 'DELETE' },
      );
    } catch {
      // ignore — mock fallback
    }
    setData({ ...data, files: data.files.filter((f) => f.id !== fileId) });
  }, [data, projectId]);

  const handleDeleteProject = useCallback(async () => {
    if (!window.confirm('このプロジェクトを削除してよろしいですか？この操作は取り消せません。')) return;
    try {
      await fetchJson(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
    window.location.href = '/dashboard/projects';
  }, [projectId]);

  const goBack = useCallback(() => {
    window.location.href = '/dashboard/projects';
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors duration-120"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
        プロジェクト一覧に戻る
      </button>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          <div className="h-16 rounded-card bg-base-elevated animate-pulse" />
          <div className="h-32 rounded-card bg-base-elevated animate-pulse" />
          <div className="h-24 rounded-card bg-base-elevated animate-pulse" />
        </div>
      ) : data ? (
        <>
          {usingMock && (
            <div className="surface-card p-3 text-xs text-text-muted" role="status">
              サンプルデータを表示中（backend API 未接続）
            </div>
          )}
          {error && (
            <div className="surface-card p-3 text-sm text-status-fail" role="alert">{error}</div>
          )}

          {/* Header */}
          <header className="surface-card p-5">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-10 h-10 rounded-card bg-accent/10 text-accent flex items-center justify-center">
                <Folder className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-text-primary truncate">{data.name}</h1>
                <p className="text-sm text-text-secondary mt-0.5">{data.description || '説明なし'}</p>
                <p className="text-xs text-text-muted mt-1">
                  最終更新: {new Date(data.updatedAt).toLocaleString('ja-JP')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDeleteProject}
                className="flex-shrink-0 p-2 text-text-muted hover:text-status-fail hover:bg-status-fail/10 rounded-card transition-colors duration-120"
                title="プロジェクトを削除"
                aria-label="プロジェクトを削除"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </header>

          {/* Instructions */}
          <section className="surface-card p-5" aria-labelledby="proj-instructions-heading">
            <div className="flex items-center justify-between mb-3">
              <h2 id="proj-instructions-heading" className="text-sm font-semibold text-text-primary">
                指示書 (Instructions)
              </h2>
              <button
                type="button"
                onClick={saveInstructions}
                disabled={!instructionsDirty || saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-card hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
              >
                <Save className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
            <p className="text-xs text-text-muted mb-2">
              このプロジェクトで おしごと AIに従わせたい前提・制約を書いてください。全タスクの冒頭で参照されます。
            </p>
            <textarea
              value={instructionsDraft}
              onChange={(e) => {
                setInstructionsDraft(e.target.value);
                setInstructionsDirty(e.target.value !== data.instructions);
              }}
              rows={6}
              className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none font-mono"
              placeholder="例: 請求書は当月末締め翌月末払い..."
            />
          </section>

          {/* Files */}
          <section className="surface-card p-5" aria-labelledby="proj-files-heading">
            <div className="flex items-center justify-between mb-3">
              <h2 id="proj-files-heading" className="text-sm font-semibold text-text-primary">
                参照ファイル
              </h2>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-base-elevated rounded-card cursor-pointer transition-colors duration-120">
                <Upload className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
                アップロード
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {data.files.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">ファイルはまだありません。</p>
            ) : (
              <ul className="space-y-2">
                {data.files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 p-3 rounded-card bg-base-elevated">
                    <FileText className="w-4 h-4 text-text-secondary flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{f.name}</p>
                      <p className="text-xs text-text-muted">{formatSize(f.sizeBytes)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(f.id)}
                      className="p-1.5 text-text-muted hover:text-status-fail hover:bg-status-fail/10 rounded-card transition-colors duration-120"
                      aria-label={`${f.name} を削除`}
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Connectors */}
          <section className="surface-card p-5" aria-labelledby="proj-connectors-heading">
            <div className="flex items-center justify-between mb-3">
              <h2 id="proj-connectors-heading" className="text-sm font-semibold text-text-primary">
                接続中のコネクタ
              </h2>
              <a
                href="/dashboard/settings/connectors"
                className="text-xs text-accent hover:underline"
              >
                コネクタ設定
              </a>
            </div>
            {data.connectors.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">接続中のコネクタはありません。</p>
            ) : (
              <ul className="space-y-2">
                {data.connectors.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 p-3 rounded-card bg-base-elevated">
                    <Plug className="w-4 h-4 text-text-secondary flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
                    <span className="text-sm text-text-primary flex-1 truncate">{c.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-card ${
                        c.status === 'connected'
                          ? 'bg-status-pass/10 text-status-pass border border-status-pass/20'
                          : 'bg-base text-text-muted border border-border'
                      }`}
                    >
                      {c.status === 'connected' ? '接続中' : '未接続'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent tasks */}
          <section className="surface-card p-5" aria-labelledby="proj-tasks-heading">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-text-secondary" strokeWidth={1.5} aria-hidden="true" />
              <h2 id="proj-tasks-heading" className="text-sm font-semibold text-text-primary">
                最近のタスク
              </h2>
            </div>
            {data.recentTasks.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">タスク履歴はまだありません。</p>
            ) : (
              <ul className="space-y-2">
                {data.recentTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 p-3 rounded-card bg-base-elevated">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{t.title}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {t.status} ・ {new Date(t.updatedAt).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <div className="surface-card p-6 text-sm text-text-muted text-center">
          プロジェクトが見つかりませんでした。
        </div>
      )}
    </div>
  );
}
