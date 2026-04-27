/**
 * WideResearch — ワイド リサーチ (AI Employee v2, 2026-04-20)
 *
 * Route: /dashboard/research
 *
 * Manus's Wide Research 相当: クエリ + データソース選択 → SSE 進捗表示 →
 * 構造化 Markdown レポート。backend 不在時はモック fallback でレポート生成。
 *
 * Data source: POST /api/research/wide → text/event-stream
 */

import { useCallback, useRef, useState } from 'react';
import { Search, Play, Globe, FileText, History, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SourceKey = 'web' | 'internal' | 'past-tasks';

interface SourceOption {
  key: SourceKey;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface ProgressEvent {
  kind: 'progress' | 'result' | 'error';
  message?: string;
  markdown?: string;
}

const SOURCES: SourceOption[] = [
  {
    key: 'web',
    label: 'Web',
    description: '公開情報・最新ニュース',
    icon: <Globe className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    key: 'internal',
    label: '社内ドキュメント',
    description: '連携済み Notion / Drive 等',
    icon: <FileText className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />,
  },
  {
    key: 'past-tasks',
    label: '過去タスク',
    description: '既存のワークスペース履歴',
    icon: <History className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />,
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildMockReport(query: string, sources: SourceKey[]): string {
  const srcList = sources.map((s) => SOURCES.find((o) => o.key === s)?.label ?? s).join(' / ');
  return `# リサーチ結果: ${query}

> サンプル出力 (backend API 未接続)

## 概要
${query} に関する調査結果を以下にまとめます。対象データソース: ${srcList || '未選択'}

## 主要な発見
- ポイント 1: ${query} の主要トレンド
- ポイント 2: 関連する市場動向
- ポイント 3: 想定される次のアクション

## 詳細
1. ${query} の背景と定義
2. 競合・類似事例の比較
3. リスクと緩和策

## 次のアクション
- [ ] 担当者に共有
- [ ] 詳細ヒアリングの予定を入れる
- [ ] 関連資料をプロジェクトに保存
`;
}

function parseProgressLine(line: string): ProgressEvent | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('data:')) return null;
  const jsonStr = trimmed.slice(5).trim();
  if (!jsonStr) return null;
  try {
    const parsed: unknown = JSON.parse(jsonStr);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    const kind = obj.kind;
    if (kind !== 'progress' && kind !== 'result' && kind !== 'error') return null;
    return {
      kind,
      message: typeof obj.message === 'string' ? obj.message : undefined,
      markdown: typeof obj.markdown === 'string' ? obj.markdown : undefined,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function WideResearch() {
  const [query, setQuery] = useState('');
  const [selectedSources, setSelectedSources] = useState<Set<SourceKey>>(new Set(['web']));
  const [running, setRunning] = useState(false);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const toggleSource = (k: SourceKey) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const runMock = useCallback(async (q: string, sources: SourceKey[]) => {
    setUsingMock(true);
    const steps = [
      'クエリ正規化中...',
      'データソースを検索中...',
      '候補情報を収集中...',
      '要点を抽出中...',
      'レポートを整形中...',
    ];
    for (const s of steps) {
      await new Promise((r) => setTimeout(r, 450));
      setProgressLog((prev) => [...prev, s]);
    }
    setReport(buildMockReport(q, sources));
    setRunning(false);
  }, []);

  const start = useCallback(async () => {
    if (!query.trim() || running) return;
    setRunning(true);
    setProgressLog([]);
    setReport(null);
    setError(null);
    setUsingMock(false);

    const sources = Array.from(selectedSources);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/research/wide', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ query: query.trim(), sources }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          for (const line of part.split('\n')) {
            const ev = parseProgressLine(line);
            if (!ev) continue;
            if (ev.kind === 'progress' && ev.message) {
              setProgressLog((prev) => [...prev, ev.message as string]);
            } else if (ev.kind === 'result' && ev.markdown) {
              setReport(ev.markdown);
            } else if (ev.kind === 'error' && ev.message) {
              setError(ev.message);
            }
          }
        }
      }
      setRunning(false);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setRunning(false);
        return;
      }
      // Backend 未接続 → モック fallback
      await runMock(query.trim(), sources);
    }
  }, [query, running, selectedSources, runMock]);

  const stop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setRunning(false);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-text-primary">ワイド リサーチ</h1>
        <p className="text-sm text-text-secondary">
          クエリと対象データソースを指定すると、おしごと AIが多方面を横断的に調査してレポートにまとめます。
        </p>
      </header>

      {/* Query input */}
      <section className="surface-card p-5 space-y-3" aria-labelledby="wr-query-heading">
        <h2 id="wr-query-heading" className="text-sm font-semibold text-text-primary">
          リサーチ指示
        </h2>
        <div className="flex items-start gap-2">
          <Search className="w-4 h-4 text-text-muted mt-2.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例: 建設業界の請求書電子化ソリューション比較、ユーザー10〜50名の中小企業向け"
            rows={3}
            className="flex-1 px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            disabled={running}
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs text-text-muted">データソース</div>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => {
              const active = selectedSources.has(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleSource(s.key)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-card text-xs border transition-colors duration-120 ${
                    active
                      ? 'bg-accent text-white border-accent'
                      : 'bg-base text-text-secondary border-border hover:border-accent/40'
                  }`}
                  disabled={running}
                >
                  {s.icon}
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {running ? (
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium bg-base-elevated text-text-primary hover:bg-base transition-colors duration-120"
            >
              <Square className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
              停止
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={!query.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
            >
              <Play className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
              調査開始
            </button>
          )}
        </div>
      </section>

      {usingMock && report && (
        <div className="surface-card p-3 text-xs text-text-muted" role="status">
          サンプルレポートを表示中（backend API 未接続）
        </div>
      )}

      {error && (
        <div className="surface-card p-3 text-sm text-status-fail" role="alert">{error}</div>
      )}

      {/* Progress */}
      {(running || progressLog.length > 0) && (
        <section className="surface-card p-5" aria-labelledby="wr-progress-heading">
          <h2 id="wr-progress-heading" className="text-sm font-semibold text-text-primary mb-2">
            進捗
          </h2>
          <ul className="space-y-1 text-xs text-text-secondary font-mono tabular-nums">
            {progressLog.map((line, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-text-muted flex-shrink-0">{String(i + 1).padStart(2, '0')}.</span>
                <span>{line}</span>
              </li>
            ))}
            {running && (
              <li className="flex items-start gap-2 text-accent">
                <span className="flex-shrink-0">...</span>
                <span>実行中</span>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* Report */}
      {report && (
        <section className="surface-card p-5" aria-labelledby="wr-report-heading">
          <h2 id="wr-report-heading" className="text-sm font-semibold text-text-primary mb-3">
            レポート
          </h2>
          <div className="prose prose-sm max-w-none text-text-primary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
          </div>
        </section>
      )}
    </div>
  );
}
