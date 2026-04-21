/**
 * FujiTraceApiKeys — 発行済 FujiTrace API key 管理 (AI Employee v2, 2026-04-20)
 *
 * Route: /dashboard/settings/api-keys
 *
 * ※ 既存の ApiKeys.tsx は「ユーザーが LLM プロバイダ (OpenAI/Anthropic/Gemini) の
 *    キーを登録する画面」で、本画面は別物。本画面は FujiTrace 自身が発行する
 *    API key (外部から FujiTrace API を叩くため) を管理する。
 *
 * Data source:
 *   - GET    /api/api-keys          → { keys: FujiTraceApiKeyRecord[] }
 *   - POST   /api/api-keys          → { key: FujiTraceApiKeyRecord & { plaintext: string } }
 *   - DELETE /api/api-keys/:id
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Trash2, Copy, Check, Key, X,
} from 'lucide-react';
import { fetchJson, isRecord } from '../lib/fetchJson';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FujiTraceApiKeyRecord {
  id: string;
  name: string;
  preview: string;
  createdAt: string;
  lastUsedAt: string | null;
  disabled: boolean;
}

interface FujiTraceApiKeyIssued extends FujiTraceApiKeyRecord {
  plaintext: string;
}

interface KeysPayload {
  keys: FujiTraceApiKeyRecord[];
}

/* ------------------------------------------------------------------ */
/*  Mock                                                               */
/* ------------------------------------------------------------------ */

const MOCK_KEYS: FujiTraceApiKeyRecord[] = [
  {
    id: 'mock-k1',
    name: '本番サーバー',
    preview: 'ft_****1a2b',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    lastUsedAt: new Date().toISOString(),
    disabled: false,
  },
];

/* ------------------------------------------------------------------ */
/*  Guards                                                             */
/* ------------------------------------------------------------------ */

function isFujiTraceApiKeyRecord(v: unknown): v is FujiTraceApiKeyRecord {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.preview === 'string' &&
    typeof v.createdAt === 'string' &&
    (v.lastUsedAt === null || typeof v.lastUsedAt === 'string') &&
    typeof v.disabled === 'boolean'
  );
}

function isKeysPayload(v: unknown): v is KeysPayload {
  if (!isRecord(v)) return false;
  return Array.isArray(v.keys) && v.keys.every(isFujiTraceApiKeyRecord);
}

function isIssuedKey(v: unknown): v is FujiTraceApiKeyIssued {
  if (!isFujiTraceApiKeyRecord(v)) return false;
  return typeof (v as unknown as Record<string, unknown>).plaintext === 'string';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function FujiTraceApiKeys() {
  const [keys, setKeys] = useState<FujiTraceApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [issued, setIssued] = useState<FujiTraceApiKeyIssued | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchJson('/api/api-keys');
      if (!isKeysPayload(payload)) throw new Error('invalid');
      setKeys(payload.keys);
      setUsingMock(false);
    } catch {
      setKeys(MOCK_KEYS);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createKey = useCallback(async (name: string) => {
    setError(null);
    try {
      const created = await fetchJson('/api/api-keys', {
        method: 'POST',
        body: { name },
      });
      if (isIssuedKey(created)) {
        setIssued(created);
        setKeys((prev) => [created, ...prev]);
        setShowCreate(false);
        return;
      }
    } catch {
      // fallthrough
    }
    // Mock fallback
    const plaintext = `ft_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    const mock: FujiTraceApiKeyIssued = {
      id: `local-${Date.now()}`,
      name,
      preview: `${plaintext.slice(0, 5)}****${plaintext.slice(-4)}`,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      disabled: false,
      plaintext,
    };
    setIssued(mock);
    setKeys((prev) => [mock, ...prev]);
    setShowCreate(false);
  }, []);

  const remove = useCallback(async (k: FujiTraceApiKeyRecord) => {
    if (!window.confirm(`「${k.name}」を無効化してよろしいですか？`)) return;
    try {
      await fetchJson(`/api/api-keys/${encodeURIComponent(k.id)}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
    setKeys((prev) => prev.filter((x) => x.id !== k.id));
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary">FujiTrace API キー</h1>
          <p className="text-sm text-text-secondary mt-1">
            外部システムから FujiTrace に連携する際の認証キーを発行・管理します。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors duration-120"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
          新規発行
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
      ) : keys.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <Key className="w-10 h-10 text-text-muted mx-auto mb-3" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-sm text-text-secondary mb-4">
            API キーはまだ発行されていません。
          </p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors duration-120"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            最初のキーを発行する
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {keys.map((k) => (
            <li key={k.id} className="surface-card p-4 flex items-center gap-3">
              <Key className="w-4 h-4 text-accent flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-text-primary truncate">{k.name}</p>
                  {k.disabled && (
                    <span className="text-xs px-1.5 py-0.5 rounded-card bg-base-elevated text-text-muted border border-border">
                      無効
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono text-text-secondary mt-0.5">{k.preview}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  発行: {new Date(k.createdAt).toLocaleDateString('ja-JP')}
                  {k.lastUsedAt && ` ・ 最終利用: ${new Date(k.lastUsedAt).toLocaleDateString('ja-JP')}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(k)}
                aria-label={`${k.name} を無効化`}
                className="p-2 text-text-muted hover:text-status-fail hover:bg-status-fail/10 rounded-card transition-colors duration-120"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateKeyModal onCancel={() => setShowCreate(false)} onConfirm={createKey} />
      )}

      {issued && (
        <IssuedKeyModal issued={issued} onClose={() => setIssued(null)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create modal                                                       */
/* ------------------------------------------------------------------ */

interface CreateKeyModalProps {
  onCancel: () => void;
  onConfirm: (name: string) => void;
}

function CreateKeyModal({ onCancel, onConfirm }: CreateKeyModalProps) {
  const [name, setName] = useState('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-key-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-card bg-base-surface border border-border shadow-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="create-key-title" className="text-base font-semibold text-text-primary">
            API キーを発行
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

        <label htmlFor="create-key-name" className="block text-xs text-text-muted mb-1">
          キー名
        </label>
        <input
          id="create-key-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 本番サーバー、ローカル開発"
          className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          autoFocus
        />
        <p className="text-xs text-text-muted mt-2">
          平文キーは発行直後の 1 回のみ表示されます。必ず保管してください。
        </p>

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
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
          >
            発行
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Issued key modal                                                   */
/* ------------------------------------------------------------------ */

interface IssuedKeyModalProps {
  issued: FujiTraceApiKeyIssued;
  onClose: () => void;
}

function IssuedKeyModal({ issued, onClose }: IssuedKeyModalProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.plaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const curlSnippet = `curl -H "Authorization: Bearer ${issued.plaintext}" \\
  ${window.location.origin}/api/projects`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="issued-key-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-card bg-base-surface border border-border shadow-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="issued-key-title" className="text-base font-semibold text-text-primary">
            API キーを発行しました
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="p-1 text-text-muted hover:text-text-primary rounded-card transition-colors duration-120"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-3 bg-status-warn/10 border border-status-warn/20 rounded-card text-xs text-text-secondary mb-4">
          このキーの平文は <strong className="text-status-warn">今回のみ表示</strong> されます。必ず安全な場所に保管してください。
        </div>

        <div className="mb-4">
          <div className="text-xs text-text-muted mb-1">API キー</div>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 min-w-0 px-3 py-2 bg-base border border-border rounded-card text-sm font-mono text-text-primary break-all">
              {issued.plaintext}
            </code>
            <button
              type="button"
              onClick={copy}
              aria-label="API キーをコピー"
              className="px-3 py-2 rounded-card bg-accent text-white hover:bg-accent/90 transition-colors duration-120"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs text-text-muted mb-1">利用例</div>
          <pre className="terminal-block p-3 text-xs overflow-x-auto whitespace-pre">
            {curlSnippet}
          </pre>
        </div>

        <div className="flex items-center justify-end mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors duration-120"
          >
            保管しました
          </button>
        </div>
      </div>
    </div>
  );
}
