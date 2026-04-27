/**
 * Projects — 永続ワークスペース一覧 (AI Employee v2, 2026-04-20)
 *
 * Route: /dashboard/projects
 *
 * Manus TTP: プロジェクトは「線」の器。instructions / 参照ファイル /
 * 接続中 Connector / 最近のタスクを持つ永続ワークスペース。
 *
 * Data source: GET /api/projects (backend 並行実装中、不在時はモック)
 */

import { useCallback, useEffect, useState } from 'react';
import { Folder, Plus, ArrowRight, X } from 'lucide-react';
import { fetchJson, isRecord } from '../lib/fetchJson';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Project {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  taskCount: number;
  fileCount: number;
  connectorCount: number;
}

interface ProjectsPayload {
  projects: Project[];
}

/* ------------------------------------------------------------------ */
/*  Mock fallback                                                      */
/* ------------------------------------------------------------------ */

const MOCK_PROJECTS: Project[] = [
  {
    id: 'mock-proj-1',
    name: '株式会社サンプル商事 取引',
    description: '定期請求 + 月次納品のワークスペース',
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    taskCount: 12,
    fileCount: 8,
    connectorCount: 2,
  },
  {
    id: 'mock-proj-2',
    name: '2026 年度バックオフィス整備',
    description: '社内書類の体系化',
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    taskCount: 5,
    fileCount: 14,
    connectorCount: 1,
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isProject(v: unknown): v is Project {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.description === 'string' &&
    typeof v.updatedAt === 'string' &&
    typeof v.taskCount === 'number' &&
    typeof v.fileCount === 'number' &&
    typeof v.connectorCount === 'number'
  );
}

function isProjectsPayload(v: unknown): v is ProjectsPayload {
  if (!isRecord(v)) return false;
  return Array.isArray(v.projects) && v.projects.every(isProject);
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours < 1) return 'たった今';
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}日前`;
    return d.toLocaleDateString('ja-JP');
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchJson('/api/projects');
      if (!isProjectsPayload(payload)) throw new Error('invalid payload');
      setProjects(payload.projects);
      setUsingMock(false);
    } catch {
      setProjects(MOCK_PROJECTS);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openProject = useCallback((id: string) => {
    window.location.href = `/dashboard/projects/${encodeURIComponent(id)}`;
  }, []);

  const createProject = useCallback(async () => {
    if (!draftName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await fetchJson('/api/projects', {
        method: 'POST',
        body: { name: draftName.trim(), description: draftDesc.trim() },
      });
      if (isProject(created)) {
        openProject(created.id);
        return;
      }
      // Backend not available — optimistically push a mock entry
      const mock: Project = {
        id: `local-${Date.now()}`,
        name: draftName.trim(),
        description: draftDesc.trim(),
        updatedAt: new Date().toISOString(),
        taskCount: 0,
        fileCount: 0,
        connectorCount: 0,
      };
      setProjects((prev) => [mock, ...prev]);
      setShowModal(false);
      setDraftName('');
      setDraftDesc('');
    } catch {
      setError('プロジェクトを作成できませんでした。時間をおいて再度お試しください。');
    } finally {
      setCreating(false);
    }
  }, [draftName, draftDesc, openProject]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary">プロジェクト</h1>
          <p className="text-sm text-text-secondary mt-1">
            おしごと AIが継続的に取り組むワークスペース。指示書・参照ファイル・履歴が永続化されます。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors duration-120"
          aria-label="新しいプロジェクトを作成"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
          新規プロジェクト
        </button>
      </header>

      {usingMock && !loading && (
        <div className="surface-card p-3 text-xs text-text-muted" role="status">
          サンプルデータを表示中（backend API 未接続）
        </div>
      )}

      {error && (
        <div className="surface-card p-3 text-sm text-status-fail" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-28 rounded-card bg-base-elevated animate-pulse" />
          ))}
        </ul>
      ) : projects.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <Folder className="w-10 h-10 text-text-muted mx-auto mb-3" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-sm text-text-secondary mb-4">
            プロジェクトはまだありません。
          </p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors duration-120"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            最初のプロジェクトを作る
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => openProject(p.id)}
                aria-label={`${p.name} を開く`}
                className="w-full text-left surface-card p-4 hover:border-accent/40 transition-colors duration-120 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-9 h-9 rounded-card bg-accent/10 text-accent flex items-center justify-center">
                    <Folder className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-text-primary truncate">{p.name}</h2>
                      <ArrowRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{p.description || '説明なし'}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-text-muted font-mono tabular-nums">
                      <span>タスク {p.taskCount}</span>
                      <span>ファイル {p.fileCount}</span>
                      <span>連携 {p.connectorCount}</span>
                      <span className="ml-auto">{formatRelative(p.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <CreateProjectModal
          name={draftName}
          description={draftDesc}
          onNameChange={setDraftName}
          onDescriptionChange={setDraftDesc}
          onCancel={() => {
            setShowModal(false);
            setDraftName('');
            setDraftDesc('');
            setError(null);
          }}
          onConfirm={createProject}
          submitting={creating}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal                                                              */
/* ------------------------------------------------------------------ */

interface CreateProjectModalProps {
  name: string;
  description: string;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  submitting: boolean;
}

function CreateProjectModal({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onCancel,
  onConfirm,
  submitting,
}: CreateProjectModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-card bg-base-surface border border-border shadow-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="create-project-title" className="text-base font-semibold text-text-primary">
            新しいプロジェクト
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
            <label htmlFor="proj-name" className="block text-xs text-text-muted mb-1">
              プロジェクト名
            </label>
            <input
              id="proj-name"
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="例: 株式会社○○ 取引"
              className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="proj-desc" className="block text-xs text-text-muted mb-1">
              説明（任意）
            </label>
            <textarea
              id="proj-desc"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="このプロジェクトの目的・文脈を書いておくと おしごと AIが理解しやすくなります"
              rows={3}
              className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
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
            onClick={onConfirm}
            disabled={!name.trim() || submitting}
            className="px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
          >
            {submitting ? '作成中...' : '作成'}
          </button>
        </div>
      </div>
    </div>
  );
}
