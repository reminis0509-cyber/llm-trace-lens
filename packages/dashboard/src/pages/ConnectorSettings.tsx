/**
 * ConnectorSettings — コネクタ設定画面 (AI Employee v1, 2026-04-20)
 *
 * Route: /dashboard/settings/connectors
 *
 * Google Calendar / Gmail を OAuth で接続。Chatwork / Slack / freee /
 * Google Drive は「近日対応」badge を出してロック状態で表示。
 */

import { useCallback } from 'react';
import { Calendar, Mail, MessageSquare, Slack, Briefcase, HardDrive } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Connector {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'available' | 'coming-soon';
  oauthStartPath?: string;
}

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const CONNECTORS: Connector[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: '今日の予定をブリーフィング画面に表示します。',
    icon: <Calendar className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />,
    status: 'available',
    oauthStartPath: '/api/auth/oauth/google/start?scope=calendar',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: '書類の送付下書きを AI 社員が作成します。',
    icon: <Mail className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />,
    status: 'available',
    oauthStartPath: '/api/auth/oauth/google/start?scope=gmail',
  },
  {
    id: 'chatwork',
    name: 'Chatwork',
    description: '取引先とのやりとりから書類を自動生成します。',
    icon: <MessageSquare className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />,
    status: 'coming-soon',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: '社内チャンネルへの通知・連携を行います。',
    icon: <Slack className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />,
    status: 'coming-soon',
  },
  {
    id: 'freee',
    name: 'freee',
    description: '会計データと連携して請求書の整合性をチェックします。',
    icon: <Briefcase className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />,
    status: 'coming-soon',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: '生成した書類を自動で保管します。',
    icon: <HardDrive className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />,
    status: 'coming-soon',
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ConnectorSettings() {
  const handleConnect = useCallback((path: string) => {
    window.location.href = path;
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-text-primary">コネクタ</h1>
        <p className="text-sm text-text-secondary">
          外部サービスと AI 社員をつなぎ、仕事の線を広げます。
        </p>
      </header>

      <ul className="space-y-3">
        {CONNECTORS.map((c) => {
          const comingSoon = c.status === 'coming-soon';
          return (
            <li
              key={c.id}
              className="surface-card p-4 flex items-center gap-4"
            >
              <span
                className={`flex-shrink-0 w-10 h-10 rounded-card flex items-center justify-center ${
                  comingSoon ? 'bg-base-elevated text-text-muted' : 'bg-accent/10 text-accent'
                }`}
              >
                {c.icon}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-text-primary">{c.name}</h2>
                  {comingSoon && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-xs rounded-card bg-base-elevated text-text-secondary border border-border">
                      近日対応
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary mt-0.5">{c.description}</p>
              </div>

              <div className="flex-shrink-0">
                {comingSoon ? (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    aria-label={`${c.name} は近日対応予定`}
                    className="px-4 py-2 rounded-card text-xs font-medium bg-base-elevated text-text-muted cursor-not-allowed"
                  >
                    準備中
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => c.oauthStartPath && handleConnect(c.oauthStartPath)}
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
        接続時に Google 等のログイン画面に移動します。FujiTrace はあなたの許可した範囲のデータにのみアクセスします。
      </p>
    </div>
  );
}
