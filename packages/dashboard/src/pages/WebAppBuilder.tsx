/**
 * WebAppBuilder — Web App Builder (β stub) (AI Employee v2, 2026-04-20)
 *
 * Route: /dashboard/tools/web-app-builder
 *
 * 仕様入力から簡易 Web アプリのスキャフォールドを Markdown で返す β 機能。
 * 実装は stub: POST /api/agent/web-app-builder が無い場合はモック出力。
 */

import { useCallback, useState } from 'react';
import { Wand2, Play, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchJson, isRecord } from '../lib/fetchJson';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface BuilderResult {
  markdown: string;
}

function isBuilderResult(v: unknown): v is BuilderResult {
  if (!isRecord(v)) return false;
  return typeof v.markdown === 'string';
}

function buildMockResult(spec: string): string {
  return `# スキャフォールド案

> サンプル出力 (backend API 未接続)

## 仕様の要約
${spec || '(仕様未入力)'}

## 推奨スタック
- フロント: React 18 + Vite + TailwindCSS
- バック: Fastify + Knex (PostgreSQL)
- 認証: Supabase

## 必要なページ
1. \`/\` — ランディング
2. \`/login\` — ログイン
3. \`/dashboard\` — ダッシュボード (メイン)
4. \`/settings\` — 設定

## 必要な API
- \`GET /api/items\`
- \`POST /api/items\`
- \`DELETE /api/items/:id\`

## 次にやること
- [ ] \`npm create vite@latest\` で雛形を作る
- [ ] 上記の API を実装
- [ ] Supabase でプロジェクトを作成し環境変数に設定
`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function WebAppBuilder() {
  const [spec, setSpec] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const build = useCallback(async () => {
    if (!spec.trim() || running) return;
    setRunning(true);
    setResult(null);
    setError(null);
    setUsingMock(false);
    try {
      const res = await fetchJson('/api/agent/web-app-builder', {
        method: 'POST',
        body: { spec: spec.trim() },
      });
      if (!isBuilderResult(res)) throw new Error('invalid');
      setResult(res.markdown);
    } catch {
      setResult(buildMockResult(spec.trim()));
      setUsingMock(true);
    } finally {
      setRunning(false);
    }
  }, [spec, running]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary flex items-center gap-2">
            Web App Builder
            <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-card bg-status-warn/10 text-status-warn border border-status-warn/20">
              β
            </span>
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            仕様を伝えると、AI 社員が Web アプリのスキャフォールド案を提示します。
          </p>
        </div>
      </header>

      <div className="surface-card p-3 flex items-start gap-2 text-xs text-text-secondary" role="note">
        <Info className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span>
          β 機能: 出力はあくまで叩き台です。実装方針・セキュリティ・テスト方針はご自身で確認してください。
        </span>
      </div>

      <section className="surface-card p-5 space-y-3" aria-labelledby="wab-spec-heading">
        <h2 id="wab-spec-heading" className="text-sm font-semibold text-text-primary">
          仕様
        </h2>
        <textarea
          value={spec}
          onChange={(e) => setSpec(e.target.value)}
          placeholder="例: 顧客管理ツール。顧客の一覧表示・詳細・メモ追加・担当者割り当てができる。認証は Google でログイン。"
          rows={6}
          className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          disabled={running}
        />

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={build}
            disabled={!spec.trim() || running}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
          >
            {running ? (
              <>
                <Wand2 className="w-3.5 h-3.5 animate-pulse" strokeWidth={1.5} aria-hidden="true" />
                生成中...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
                スキャフォールド生成
              </>
            )}
          </button>
        </div>
      </section>

      {error && (
        <div className="surface-card p-3 text-sm text-status-fail" role="alert">{error}</div>
      )}

      {usingMock && result && (
        <div className="surface-card p-3 text-xs text-text-muted" role="status">
          サンプル出力を表示中（backend API 未接続）
        </div>
      )}

      {result && (
        <section className="surface-card p-5" aria-labelledby="wab-result-heading">
          <h2 id="wab-result-heading" className="text-sm font-semibold text-text-primary mb-3">
            生成結果
          </h2>
          <div className="prose prose-sm max-w-none text-text-primary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
          </div>
        </section>
      )}
    </div>
  );
}
