/**
 * MorningBriefing — 朝のブリーフィング画面 (AI Employee v1, 2026-04-20)
 *
 * Route: /dashboard/briefing
 *
 * 線化UXの核。「今日の予定」「昨日完了したタスク」「保留中のタスク」を縦に積み、
 * AI社員に仕事を任せるCTAへ自然に導線する。
 *
 * Data source: GET /api/workspace/briefing (backend は並行実装中、不在時は
 * モックデータでUIを動かす)
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Sun, Calendar, CheckCircle2, Clock, AlertCircle, ArrowRight, Bot,
  FileText, Receipt, Package, ShoppingCart, Mail,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DocumentKind = 'estimate' | 'invoice' | 'delivery-note' | 'purchase-order' | 'cover-letter' | 'other';

interface CalendarEvent {
  id: string;
  title: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  location?: string;
}

interface CompletedTask {
  id: string;
  title: string;
  kind: DocumentKind;
  completedAt: string; // ISO
}

interface PendingTask {
  id: string;
  title: string;
  kind: DocumentKind;
  status: 'pending' | 'failed';
  updatedAt: string; // ISO
}

interface BriefingPayload {
  calendarConnected: boolean;
  todayEvents: CalendarEvent[];
  completedYesterday: CompletedTask[];
  pending: PendingTask[];
}

/* ------------------------------------------------------------------ */
/*  Mock fallback                                                      */
/* ------------------------------------------------------------------ */

const MOCK_BRIEFING: BriefingPayload = {
  calendarConnected: false,
  todayEvents: [],
  completedYesterday: [
    {
      id: 'mock-c1',
      title: '株式会社サンプル商事 向け 見積書',
      kind: 'estimate',
      completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'mock-c2',
      title: '月次請求書 (4月分)',
      kind: 'invoice',
      completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000).toISOString(),
    },
  ],
  pending: [
    {
      id: 'mock-p1',
      title: '発注書 下書き (ベンダー様)',
      kind: 'purchase-order',
      status: 'pending',
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 11) return 'おはようございます';
  if (hour >= 11 && hour < 17) return 'こんにちは';
  return 'おつかれさまです';
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

function kindIcon(kind: DocumentKind): React.ReactNode {
  const common = 'w-4 h-4';
  switch (kind) {
    case 'estimate': return <FileText className={common} strokeWidth={1.5} />;
    case 'invoice': return <Receipt className={common} strokeWidth={1.5} />;
    case 'delivery-note': return <Package className={common} strokeWidth={1.5} />;
    case 'purchase-order': return <ShoppingCart className={common} strokeWidth={1.5} />;
    case 'cover-letter': return <Mail className={common} strokeWidth={1.5} />;
    default: return <FileText className={common} strokeWidth={1.5} />;
  }
}

function kindLabel(kind: DocumentKind): string {
  switch (kind) {
    case 'estimate': return '見積書';
    case 'invoice': return '請求書';
    case 'delivery-note': return '納品書';
    case 'purchase-order': return '発注書';
    case 'cover-letter': return '送付状';
    default: return 'タスク';
  }
}

function isBriefingPayload(v: unknown): v is BriefingPayload {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.calendarConnected === 'boolean' &&
    Array.isArray(o.todayEvents) &&
    Array.isArray(o.completedYesterday) &&
    Array.isArray(o.pending)
  );
}

function unwrapEnvelope(v: unknown): unknown {
  if (typeof v !== 'object' || v === null) return v;
  const o = v as Record<string, unknown>;
  if (o.success === true && 'data' in o) return o.data;
  return v;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MorningBriefing() {
  const { user } = useAuth();
  const [data, setData] = useState<BriefingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  const now = new Date();
  const greeting = getGreeting(now.getHours());
  const displayName = user?.email?.split('@')[0] ?? 'ゲスト';

  const loadBriefing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workspace/briefing', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json: unknown = await res.json();
      const payload = unwrapEnvelope(json);
      if (!isBriefingPayload(payload)) {
        throw new Error('invalid briefing payload');
      }
      setData(payload);
      setUsingMock(false);
    } catch {
      // Backend API 未実装 / ネットワーク失敗 時は mock で UI を動かす
      setData(MOCK_BRIEFING);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBriefing();
  }, [loadBriefing]);

  const goToClerk = useCallback(() => {
    window.location.hash = 'ai-clerk';
  }, []);

  const goToConnectors = useCallback(() => {
    window.location.href = '/dashboard/settings/connectors';
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Greeting header */}
      <header className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
          <Sun className="w-6 h-6 text-accent" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary">
            {greeting}、{displayName}さん
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {formatDate(now)}
          </p>
        </div>
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

      {/* 今日の予定 */}
      <section
        aria-labelledby="briefing-events-heading"
        className="surface-card p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-text-secondary" strokeWidth={1.5} aria-hidden="true" />
          <h2 id="briefing-events-heading" className="text-sm font-semibold text-text-primary">
            今日の予定
          </h2>
        </div>

        {loading ? (
          <BriefingSkeleton rows={2} />
        ) : data?.calendarConnected ? (
          data.todayEvents.length === 0 ? (
            <p className="text-sm text-text-muted">今日の予定はありません。</p>
          ) : (
            <ul className="space-y-2">
              {data.todayEvents.map((ev) => (
                <li
                  key={ev.id}
                  className="flex items-start gap-3 p-3 rounded-card bg-base-elevated"
                >
                  <span className="text-xs font-mono tabular-nums text-text-secondary mt-0.5 flex-shrink-0">
                    {formatTime(ev.startTime)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{ev.title}</p>
                    {ev.location && (
                      <p className="text-xs text-text-muted mt-0.5 truncate">{ev.location}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-text-secondary">
              Google Calendar を接続すると、今日の予定をここに表示します。
            </p>
            <button
              type="button"
              onClick={goToConnectors}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors duration-120"
              aria-label="Google Calendar を接続する設定画面に移動"
            >
              Google Calendar を接続する
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        )}
      </section>

      {/* 昨日完了したタスク */}
      <section
        aria-labelledby="briefing-completed-heading"
        className="surface-card p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 text-status-pass" strokeWidth={1.5} aria-hidden="true" />
          <h2 id="briefing-completed-heading" className="text-sm font-semibold text-text-primary">
            昨日完了したタスク
          </h2>
        </div>

        {loading ? (
          <BriefingSkeleton rows={2} />
        ) : data && data.completedYesterday.length > 0 ? (
          <ul className="space-y-2">
            {data.completedYesterday.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 p-3 rounded-card bg-base-elevated"
              >
                <span className="flex-shrink-0 text-text-secondary" aria-hidden="true">
                  {kindIcon(t.kind)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{t.title}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {kindLabel(t.kind)} ・ {formatTime(t.completedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">昨日完了したタスクはありません。</p>
        )}
      </section>

      {/* 保留中のタスク */}
      <section
        aria-labelledby="briefing-pending-heading"
        className="surface-card p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-text-secondary" strokeWidth={1.5} aria-hidden="true" />
          <h2 id="briefing-pending-heading" className="text-sm font-semibold text-text-primary">
            保留中のタスク
          </h2>
        </div>

        {loading ? (
          <BriefingSkeleton rows={1} />
        ) : data && data.pending.length > 0 ? (
          <ul className="space-y-2">
            {data.pending.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 p-3 rounded-card bg-base-elevated"
              >
                <span
                  className={`flex-shrink-0 ${t.status === 'failed' ? 'text-status-fail' : 'text-text-secondary'}`}
                  aria-hidden="true"
                >
                  {t.status === 'failed' ? (
                    <AlertCircle className="w-4 h-4" strokeWidth={1.5} />
                  ) : (
                    kindIcon(t.kind)
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{t.title}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {kindLabel(t.kind)} ・ {t.status === 'failed' ? '失敗' : '未完了'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">保留中のタスクはありません。</p>
        )}
      </section>

      {/* CTA */}
      <section className="surface-card p-6 text-center">
        <p className="text-sm text-text-secondary mb-4">
          今日の仕事をAI社員に任せてみましょう。
        </p>
        <button
          type="button"
          onClick={goToClerk}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-card text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-colors duration-120"
          aria-label="AI社員に仕事を任せる"
        >
          <Bot className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
          AI社員に仕事を任せる
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

interface BriefingSkeletonProps {
  rows: number;
}

function BriefingSkeleton({ rows }: BriefingSkeletonProps) {
  return (
    <ul className="space-y-2" aria-busy="true" aria-label="読み込み中">
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="h-12 rounded-card bg-base-elevated animate-pulse"
        />
      ))}
    </ul>
  );
}
