/**
 * ConnectorSettings — コネクタ設定画面 (AI Employee v2, 2026-04-20)
 *
 * Route: /dashboard/settings/connectors
 *
 * 7 種のコネクタを有効化 (v2):
 *   OAuth 型: Google Calendar / Gmail / Google Drive / Slack / Notion / GitHub
 *   APIキー型: Chatwork (API Token), LINE Messaging (Channel Access Token)
 *   freee: OAuth 型
 *
 * Data sources:
 *   - GET /api/connectors/status          → 接続状態
 *   - POST /api/auth/connector/chatwork/configure (API key)
 *   - POST /api/auth/connector/line/configure (API key)
 *   - /api/auth/oauth/:provider/start (他)
 *   - DELETE /api/connectors/:id (切断)
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Calendar, Mail, MessageSquare, Slack, Briefcase, HardDrive, FileText, Github, MessageCircle, X,
} from 'lucide-react';
import { fetchJson, isRecord } from '../lib/fetchJson';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ConnectorKind = 'oauth' | 'api-key';

interface ConnectorDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  kind: ConnectorKind;
  oauthStartPath?: string;
  /** Endpoint for POSTing API key / access token (API key kind only). */
  configureEndpoint?: string;
  /** Placeholder shown in the API-key modal. */
  placeholder?: string;
  /** Label for the secret field (e.g. "API Token", "Channel Access Token"). */
  secretLabel?: string;
}

interface ConnectorStatus {
  id: string;
  connected: boolean;
  accountLabel?: string;
}

interface StatusPayload {
  connectors: ConnectorStatus[];
}

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const CONNECTORS: ConnectorDef[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: '今日の予定をブリーフィング画面に表示します。',
    icon: <Calendar className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />,
    kind: 'oauth',
    oauthStartPath: '/api/auth/oauth/google/start?scope=calendar',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: '書類の送付下書きを AI 社員が作成します。',
    icon: <Mail className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />,
    kind: 'oauth',
    oauthStartPath: '/api/auth/oauth/google/start?scope=gmail',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: '生成した書類を自動で保管します。',
    icon: <HardDrive className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />,
    kind: 'oauth',
    oauthStartPath: '/api/auth/oauth/google/start?scope=drive',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: '社内チャンネルへの通知・連携を行います。',
    icon: <Slack className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />,
    kind: 'oauth',
    oauthStartPath: '/api/auth/oauth/slack/start',
  },
  {
    id: 'chatwork',
    name: 'Chatwork',
    description: '取引先とのやりとりから書類を自動生成します。',
    icon: <MessageSquare className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />,
    kind: 'api-key',
    configureEndpoint: '/api/auth/connector/chatwork/configure',
    secretLabel: 'API Token',
    placeholder: '****-****-****',
  },
  {
    id: 'freee',
    name: 'freee',
    description: '会計データと連携して請求書の整合性をチェックします。',
    icon: <Briefcase className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />,
    kind: 'oauth',
    oauthStartPath: '/api/auth/oauth/freee/start',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: '社内ドキュメントを参照して文脈に合う書類を作ります。',
    icon: <FileText className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />,
    kind: 'oauth',
    oauthStartPath: '/api/auth/oauth/notion/start',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: '開発プロジェクトの状況を把握し、レポートに反映します。',
    icon: <Github className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />,
    kind: 'oauth',
    oauthStartPath: '/api/auth/oauth/github/start',
  },
  {
    id: 'line',
    name: 'LINE Messaging',
    description: '個人・チームへ LINE で通知します。',
    icon: <MessageCircle className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />,
    kind: 'api-key',
    configureEndpoint: '/api/auth/connector/line/configure',
    secretLabel: 'Channel Access Token',
    placeholder: '長期 Channel Access Token',
  },
];

/* ------------------------------------------------------------------ */
/*  Guards                                                             */
/* ------------------------------------------------------------------ */

function isStatusPayload(v: unknown): v is StatusPayload {
  if (!isRecord(v)) return false;
  if (!Array.isArray(v.connectors)) return false;
  return v.connectors.every((c) => {
    if (!isRecord(c)) return false;
    return typeof c.id === 'string' && typeof c.connected === 'boolean';
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ConnectorSettings() {
  const [statusMap, setStatusMap] = useState<Map<string, ConnectorStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [apiKeyFor, setApiKeyFor] = useState<ConnectorDef | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchJson('/api/connectors/status');
      if (!isStatusPayload(payload)) throw new Error('invalid');
      const m = new Map<string, ConnectorStatus>();
      payload.connectors.forEach((c) => m.set(c.id, c));
      setStatusMap(m);
      setUsingMock(false);
    } catch {
      setStatusMap(new Map());
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleConnect = useCallback((c: ConnectorDef) => {
    setError(null);
    if (c.kind === 'oauth' && c.oauthStartPath) {
      window.location.href = c.oauthStartPath;
      return;
    }
    if (c.kind === 'api-key') {
      setApiKeyFor(c);
    }
  }, []);

  const handleDisconnect = useCallback(async (c: ConnectorDef) => {
    if (!window.confirm(`${c.name} の接続を解除してよろしいですか？`)) return;
    try {
      await fetchJson(`/api/connectors/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
    setStatusMap((prev) => {
      const next = new Map(prev);
      next.set(c.id, { id: c.id, connected: false });
      return next;
    });
  }, []);

  const submitApiKey = useCallback(async (c: ConnectorDef, secret: string) => {
    if (!c.configureEndpoint) return;
    setError(null);
    try {
      await fetchJson(c.configureEndpoint, {
        method: 'POST',
        body: { secret },
      });
      setStatusMap((prev) => {
        const next = new Map(prev);
        next.set(c.id, { id: c.id, connected: true });
        return next;
      });
      setApiKeyFor(null);
    } catch {
      setError('接続に失敗しました。トークンをご確認ください。');
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-text-primary">コネクタ</h1>
        <p className="text-sm text-text-secondary">
          外部サービスと AI 社員をつなぎ、仕事の線を広げます。
        </p>
      </header>

      {usingMock && !loading && (
        <div className="surface-card p-3 text-xs text-text-muted" role="status">
          接続状態を backend から取得できませんでした。ボタンは押せますが、実際の接続は環境変数の設定が必要です。
        </div>
      )}

      {error && (
        <div className="surface-card p-3 text-sm text-status-fail" role="alert">{error}</div>
      )}

      <ul className="space-y-3">
        {CONNECTORS.map((c) => {
          const status = statusMap.get(c.id);
          const connected = status?.connected === true;
          return (
            <li key={c.id} className="surface-card p-4 flex items-center gap-4">
              <span className={`flex-shrink-0 w-10 h-10 rounded-card flex items-center justify-center ${
                connected ? 'bg-status-pass/10 text-status-pass' : 'bg-accent/10 text-accent'
              }`}>
                {c.icon}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-text-primary">{c.name}</h2>
                  {connected && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-xs rounded-card bg-status-pass/10 text-status-pass border border-status-pass/20">
                      接続中
                    </span>
                  )}
                  {c.kind === 'api-key' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-xs rounded-card bg-base-elevated text-text-secondary border border-border">
                      API キー
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary mt-0.5">{c.description}</p>
                {status?.accountLabel && (
                  <p className="text-xs text-text-muted mt-0.5">{status.accountLabel}</p>
                )}
              </div>

              <div className="flex-shrink-0 flex items-center gap-2">
                {connected ? (
                  <button
                    type="button"
                    onClick={() => handleDisconnect(c)}
                    aria-label={`${c.name} の接続を解除`}
                    className="px-3 py-2 rounded-card text-xs font-medium text-text-secondary hover:text-status-fail hover:bg-status-fail/10 transition-colors duration-120"
                  >
                    解除
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleConnect(c)}
                    aria-label={`${c.name} を接続する`}
                    className="px-4 py-2 rounded-card text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors duration-120"
                  >
                    接続する
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-text-muted">
        接続時に各サービスのログイン画面に移動することがあります。FujiTrace はあなたの許可した範囲のデータにのみアクセスします。
      </p>

      {apiKeyFor && (
        <ApiKeyModal
          connector={apiKeyFor}
          onCancel={() => setApiKeyFor(null)}
          onConfirm={submitApiKey}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  API Key Modal                                                      */
/* ------------------------------------------------------------------ */

interface ApiKeyModalProps {
  connector: ConnectorDef;
  onCancel: () => void;
  onConfirm: (c: ConnectorDef, secret: string) => void;
}

function ApiKeyModal({ connector, onCancel, onConfirm }: ApiKeyModalProps) {
  const [secret, setSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!secret.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(connector, secret.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-card bg-base-surface border border-border shadow-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="api-key-modal-title" className="text-base font-semibold text-text-primary">
            {connector.name} を接続
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

        <p className="text-xs text-text-secondary mb-3">
          {connector.secretLabel ?? 'API キー'} を入力してください。サーバーに保存され、API リクエスト時にのみ参照されます。
        </p>

        <label htmlFor="api-key-secret" className="block text-xs text-text-muted mb-1">
          {connector.secretLabel ?? 'API Key'}
        </label>
        <input
          id="api-key-secret"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={connector.placeholder ?? '••••••••'}
          className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent font-mono"
          autoFocus
        />

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
            disabled={!secret.trim() || submitting}
            className="px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
          >
            {submitting ? '保存中...' : '保存して接続'}
          </button>
        </div>
      </div>
    </div>
  );
}
