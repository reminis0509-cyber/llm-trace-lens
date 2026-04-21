/**
 * WebAppBuilder — Slide Builder (β) pivot (AI Employee v2.1, 2026-04-21)
 *
 * NOTE: File name retained as WebAppBuilder.tsx by CEO directive.
 *   実際の機能はスライド生成 (Marp Markdown → preview → PPTX) にpivotした。
 *
 * Route: /dashboard/tools/slide-builder (旧 /tools/web-app-builder は引き継ぎ)
 *
 * 入力:
 *   topic       : 資料の主題 (text)
 *   audience    : 聴衆 (text)
 *   slideCount  : 枚数 (number 3-30)
 *   style       : business / casual / pitch
 *
 * 出力 (API):
 *   POST /api/agent/slide-builder
 *     → { markdown: string (Marp), html?: string, pptxBase64?: string }
 *
 * タブ: Markdown raw / プレビュー / PPTX DL
 */

import { useCallback, useMemo, useState } from 'react';
import { Wand2, Play, Info, Download, FileText, Monitor, Code2 } from 'lucide-react';
import { fetchJson, isRecord } from '../lib/fetchJson';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SlideStyle = 'business' | 'casual' | 'pitch';

interface SlideBuilderResult {
  markdown: string;
  html?: string;
  pptxBase64?: string;
}

type TabKey = 'markdown' | 'preview' | 'pptx';

function isSlideBuilderResult(v: unknown): v is SlideBuilderResult {
  if (!isRecord(v)) return false;
  if (typeof v.markdown !== 'string') return false;
  if ('html' in v && v.html !== undefined && typeof v.html !== 'string') return false;
  if ('pptxBase64' in v && v.pptxBase64 !== undefined && typeof v.pptxBase64 !== 'string') return false;
  return true;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const STYLE_LABELS: Record<SlideStyle, string> = {
  business: 'ビジネス',
  casual: 'カジュアル',
  pitch: 'ピッチ',
};

function buildMockMarkdown(
  topic: string,
  audience: string,
  slideCount: number,
  style: SlideStyle,
): string {
  const count = Math.max(3, Math.min(30, slideCount));
  const heading = topic || '(主題未入力)';
  const aud = audience || '(聴衆未指定)';
  const styleLabel = STYLE_LABELS[style];

  const slides: string[] = [];
  slides.push(`---
marp: true
theme: default
paginate: true
---

# ${heading}

対象: ${aud}
スタイル: ${styleLabel}
`);
  slides.push(`## アジェンダ

1. 背景と課題
2. 提案の概要
3. 想定効果
4. 導入ステップ
5. まとめ
`);

  for (let i = 3; i <= count; i++) {
    slides.push(`## スライド ${i}

- ポイント 1
- ポイント 2
- ポイント 3

> (サンプル出力 — backend API 未接続時のダミーデータ)
`);
  }

  return slides.join('\n---\n\n');
}

/**
 * Fallback HTML preview: Marp Markdown を極簡易に HTML 化。
 * 実 backend 接続時は返却 html をそのまま使う。
 */
function markdownToFallbackHtml(md: string): string {
  // Split slides by "---" lines (excluding frontmatter block)
  const body = md.replace(/^---\s*\nmarp:[\s\S]*?---\s*\n/, '');
  const slides = body.split(/\n---\s*\n/);

  const renderLine = (line: string): string => {
    const trimmed = line.trimEnd();
    if (trimmed === '') return '';
    const h2 = trimmed.match(/^##\s+(.+)/);
    if (h2) return `<h2>${escapeHtml(h2[1])}</h2>`;
    const h1 = trimmed.match(/^#\s+(.+)/);
    if (h1) return `<h1>${escapeHtml(h1[1])}</h1>`;
    const bullet = trimmed.match(/^\s*[-*]\s+(.+)/);
    if (bullet) return `<li>${escapeHtml(bullet[1])}</li>`;
    const numbered = trimmed.match(/^\s*(\d+)[.)]\s+(.+)/);
    if (numbered) return `<li>${escapeHtml(numbered[2])}</li>`;
    const quote = trimmed.match(/^>\s+(.+)/);
    if (quote) return `<blockquote>${escapeHtml(quote[1])}</blockquote>`;
    return `<p>${escapeHtml(trimmed)}</p>`;
  };

  const slideHtml = slides
    .map((slide) => {
      const lines = slide.split('\n').map(renderLine).filter(Boolean);
      // wrap consecutive <li> into <ul>
      const wrapped: string[] = [];
      let inList = false;
      for (const ln of lines) {
        const isLi = ln.startsWith('<li>');
        if (isLi && !inList) {
          wrapped.push('<ul>');
          inList = true;
        } else if (!isLi && inList) {
          wrapped.push('</ul>');
          inList = false;
        }
        wrapped.push(ln);
      }
      if (inList) wrapped.push('</ul>');
      return `<section class="slide">${wrapped.join('\n')}</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; background: #f3f4f6; font-family: "Noto Sans JP", -apple-system, BlinkMacSystemFont, sans-serif; color: #111827; }
  .slide {
    background: #ffffff;
    margin: 16px auto;
    padding: 32px 40px;
    width: 85%;
    max-width: 820px;
    min-height: 420px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h1 { font-size: 26px; margin: 0 0 12px; color: #111827; }
  h2 { font-size: 20px; margin: 0 0 10px; color: #1f2937; }
  p { font-size: 14px; line-height: 1.6; margin: 0; }
  ul { font-size: 14px; line-height: 1.6; margin: 4px 0; padding-left: 24px; }
  blockquote { border-left: 3px solid #93c5fd; margin: 6px 0; padding: 4px 10px; color: #4b5563; font-size: 13px; background: #f9fafb; }
</style>
</head>
<body>
${slideHtml}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function WebAppBuilder() {
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [slideCount, setSlideCount] = useState(8);
  const [style, setStyle] = useState<SlideStyle>('business');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SlideBuilderResult | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('preview');

  const canSubmit = topic.trim().length > 0 && !running;

  const build = useCallback(async () => {
    if (!canSubmit) return;
    setRunning(true);
    setResult(null);
    setError(null);
    setUsingMock(false);
    try {
      const res = await fetchJson('/api/agent/slide-builder', {
        method: 'POST',
        body: {
          topic: topic.trim(),
          audience: audience.trim(),
          slideCount,
          style,
        },
      });
      if (!isSlideBuilderResult(res)) throw new Error('invalid');
      setResult(res);
      setActiveTab('preview');
    } catch {
      const markdown = buildMockMarkdown(topic.trim(), audience.trim(), slideCount, style);
      setResult({ markdown });
      setUsingMock(true);
      setActiveTab('preview');
    } finally {
      setRunning(false);
    }
  }, [canSubmit, topic, audience, slideCount, style]);

  const previewHtml = useMemo(() => {
    if (!result) return '';
    if (result.html && result.html.length > 0) return result.html;
    return markdownToFallbackHtml(result.markdown);
  }, [result]);

  const hasPptx = !!(result && result.pptxBase64 && result.pptxBase64.length > 0);

  const handlePptxDownload = useCallback(() => {
    if (!result || !result.pptxBase64) return;
    try {
      const blob = base64ToBlob(
        result.pptxBase64,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      );
      const safeTopic = topic.trim().replace(/[\\/:*?"<>|]/g, '_') || 'slides';
      triggerDownload(blob, `${safeTopic}.pptx`);
    } catch (e) {
      setError((e as Error).message || 'PPTX のダウンロードに失敗しました');
    }
  }, [result, topic]);

  const handleMarkdownDownload = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' });
    const safeTopic = topic.trim().replace(/[\\/:*?"<>|]/g, '_') || 'slides';
    triggerDownload(blob, `${safeTopic}.md`);
  }, [result, topic]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-text-primary flex items-center gap-2">
            スライドビルダー
            <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-card bg-status-warn/10 text-status-warn border border-status-warn/20">
              β
            </span>
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            主題と聴衆を伝えると、AI 社員が Marp 形式のスライドを生成します。プレビューと PPTX ダウンロードに対応。
          </p>
        </div>
      </header>

      <div className="surface-card p-3 flex items-start gap-2 text-xs text-text-secondary" role="note">
        <Info className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span>
          β 機能: 出力はあくまで叩き台です。内容・数値・主張の裏取りはご自身で確認してください。
        </span>
      </div>

      <section className="surface-card p-5 space-y-3" aria-labelledby="sb-form-heading">
        <h2 id="sb-form-heading" className="text-sm font-semibold text-text-primary">
          スライド仕様
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-text-muted mb-1">主題 (必須)</span>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例: 新規 SaaS プロダクトの社内提案"
              className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={running}
            />
          </label>

          <label className="block">
            <span className="block text-xs text-text-muted mb-1">聴衆</span>
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="例: 経営会議 / 営業チーム 10名"
              className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={running}
            />
          </label>

          <label className="block">
            <span className="block text-xs text-text-muted mb-1">スライド枚数 (3-30)</span>
            <input
              type="number"
              min={3}
              max={30}
              value={slideCount}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(n)) setSlideCount(Math.max(3, Math.min(30, n)));
              }}
              className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={running}
            />
          </label>

          <label className="block">
            <span className="block text-xs text-text-muted mb-1">スタイル</span>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as SlideStyle)}
              className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={running}
            >
              <option value="business">ビジネス</option>
              <option value="casual">カジュアル</option>
              <option value="pitch">ピッチ</option>
            </select>
          </label>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={build}
            disabled={!canSubmit}
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
                スライド生成
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
          サンプル出力を表示中 (backend API 未接続)
        </div>
      )}

      {result && (
        <section className="surface-card p-5 space-y-3" aria-labelledby="sb-result-heading">
          <h2 id="sb-result-heading" className="text-sm font-semibold text-text-primary">
            生成結果
          </h2>

          <div className="flex items-center gap-1 border-b border-border" role="tablist">
            {([
              { id: 'preview', label: 'プレビュー', icon: <Monitor className="w-3.5 h-3.5" strokeWidth={1.5} /> },
              { id: 'markdown', label: 'Markdown', icon: <Code2 className="w-3.5 h-3.5" strokeWidth={1.5} /> },
              { id: 'pptx', label: 'ダウンロード', icon: <Download className="w-3.5 h-3.5" strokeWidth={1.5} /> },
            ] as { id: TabKey; label: string; icon: React.ReactNode }[]).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors duration-120 ${
                  activeTab === tab.id
                    ? 'border-accent text-text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {activeTab === 'preview' && (
            <div className="bg-base border border-border rounded-card overflow-hidden" style={{ minHeight: 400 }}>
              <iframe
                title="slide-preview"
                srcDoc={previewHtml}
                sandbox=""
                className="w-full"
                style={{ height: 560, border: 0 }}
              />
            </div>
          )}

          {activeTab === 'markdown' && (
            <pre className="bg-base-elevated border border-border rounded-card p-4 text-xs text-text-primary overflow-auto max-h-[560px] whitespace-pre-wrap font-mono">
              {result.markdown}
            </pre>
          )}

          {activeTab === 'pptx' && (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                PPTX 形式でダウンロードします。backend 未接続時は Markdown のみダウンロード可能です。
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handlePptxDownload}
                  disabled={!hasPptx}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-card text-xs font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
                  PPTX ダウンロード
                </button>
                <button
                  type="button"
                  onClick={handleMarkdownDownload}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-card text-xs font-medium bg-base-elevated text-text-primary border border-border hover:border-accent/40 transition-colors duration-120"
                >
                  <FileText className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
                  Markdown ダウンロード
                </button>
              </div>
              {!hasPptx && (
                <p className="text-xs text-text-muted">
                  PPTX は backend API が応答した場合のみ提供されます。現在は Markdown のみ取得可能です。
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
