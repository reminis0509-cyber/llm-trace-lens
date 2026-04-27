/**
 * CustomMcpSettings — カスタム MCP サーバー管理 (AI Employee v2, 2026-04-20)
 *
 * Route: /dashboard/settings/custom-mcp
 *
 * 登録済み MCP 一覧 + 新規登録 (name / URL / auth_header)。
 * 認証ヘッダは password field で受け取り、UI 上では常にマスク表示。
 *
 * API: GET/POST /api/custom-mcp, DELETE /api/custom-mcp/:id
 */

import { useCallback, useEffect, useState } from 'react';
import { Plug, Plus, Trash2, X, Link2 } from 'lucide-react';
import { fetchJson, isRecord } from '../lib/fetchJson';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface McpServer {
  id: string;
  name: string;
  url: string;
  authHeaderPreview: string | null;
  createdAt: string;
}

interface McpPayload {
  servers: McpServer[];
}

/* ------------------------------------------------------------------ */
/*  Mock                                                               */
/* ------------------------------------------------------------------ */

const MOCK_SERVERS: McpServer[] = [
  {
    id: 'mock-mcp-1',
    name: '社内台帳 MCP',
    url: 'https://internal.example.com/mcp',
    authHeaderPreview: 'Bearer ****abcd',
    createdAt: new Date().toISOString(),
  },
];

/* ------------------------------------------------------------------ */
/*  Guards                                                             */
/* ------------------------------------------------------------------ */

function isMcpServer(v: unknown): v is McpServer {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.url === 'string' &&
    (v.authHeaderPreview === null || typeof v.authHeaderPreview === 'string') &&
    typeof v.createdAt === 'string'
  );
}

function isMcpPayload(v: unknown): v is McpPayload {
  if (!isRecord(v)) return false;
  return Array.isArray(v.servers) && v.servers.every(isMcpServer);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CustomMcpSettings() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchJson('/api/custom-mcp');
      if (!isMcpPayload(payload)) throw new Error('invalid');
      setServers(payload.servers);
      setUsingMock(false);
    } catch {
      setServers(MOCK_SERVERS);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = useCallback(async (s: McpServer) => {
    if (!window.confirm(`「${s.name}」を削除してよろしいですか？`)) return;
    try {
      await fetchJson(`/api/custom-mcp/${encodeURIComponent(s.id)}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
    setServers((prev) => prev.filter((x) => x.id !== s.id));
  }, []);

  const create = useCallback(async (draft: { name: string; url: string; authHeader: string }) => {
    setError(null);
    try {
      const created = await fetchJson('/api/custom-mcp', { method: 'POST', body: draft });
      if (isMcpServer(created)) {
        setServers((prev) => [created, ...prev]);
        setShowModal(false);
        return;
      }
    } catch {
      // fallthrough
    }
    const preview = draft.authHeader
      ? `${draft.authHeader.slice(0, 6)}****`
      : null;
    setServers((prev) => [
      {
        id: `local-${Date.now()}`,
        name: draft.name,
        url: draft.url,
        authHeaderPreview: preview,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setShowModal(false);
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary">カスタム MCP</h1>
          <p className="text-sm text-text-secondary mt-1">
            社内 API や特殊ツールを MCP サーバーとして登録し、おしごと AIから呼び出せるようにします。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors duration-120"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
          追加
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
          {[0, 1].map((i) => (
            <li key={i} className="h-16 rounded-card bg-base-elevated animate-pulse" />
          ))}
        </ul>
      ) : servers.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <Plug className="w-10 h-10 text-text-muted mx-auto mb-3" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-sm text-text-secondary mb-4">
            カスタム MCP サーバーはまだありません。
          </p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors duration-120"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            最初のサーバーを追加する
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {servers.map((s) => (
            <li key={s.id} className="surface-card p-4 flex items-center gap-3">
              <Plug className="w-4 h-4 text-accent flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{s.name}</p>
                <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1 truncate">
                  <Link2 className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  <span className="font-mono truncate">{s.url}</span>
                </p>
                {s.authHeaderPreview && (
                  <p className="text-xs text-text-muted mt-0.5 font-mono">{s.authHeaderPreview}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(s)}
                aria-label={`${s.name} を削除`}
                className="p-2 text-text-muted hover:text-status-fail hover:bg-status-fail/10 rounded-card transition-colors duration-120"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <AddMcpModal onCancel={() => setShowModal(false)} onConfirm={create} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal                                                              */
/* ------------------------------------------------------------------ */

interface AddMcpModalProps {
  onCancel: () => void;
  onConfirm: (draft: { name: string; url: string; authHeader: string }) => void;
}

function AddMcpModal({ onCancel, onConfirm }: AddMcpModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authHeader, setAuthHeader] = useState('');

  const canSubmit = name.trim() && url.trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-mcp-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-card bg-base-surface border border-border shadow-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="add-mcp-title" className="text-base font-semibold text-text-primary">
            MCP サーバーを追加
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
            <label htmlFor="mcp-name" className="block text-xs text-text-muted mb-1">名前</label>
            <input
              id="mcp-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 社内台帳 MCP"
              className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="mcp-url" className="block text-xs text-text-muted mb-1">URL</label>
            <input
              id="mcp-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/mcp"
              className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent font-mono"
            />
          </div>
          <div>
            <label htmlFor="mcp-auth" className="block text-xs text-text-muted mb-1">
              認証ヘッダ (任意)
            </label>
            <input
              id="mcp-auth"
              type="password"
              value={authHeader}
              onChange={(e) => setAuthHeader(e.target.value)}
              placeholder="例: Bearer xxxxxxxxxxxx"
              className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent font-mono"
            />
            <p className="text-xs text-text-muted mt-1">
              入力値は暗号化して保存され、UI 上では再表示されません。
            </p>
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
            onClick={() => canSubmit && onConfirm({ name: name.trim(), url: url.trim(), authHeader: authHeader.trim() })}
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
