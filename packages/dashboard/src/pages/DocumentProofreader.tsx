/**
 * DocumentProofreader — 文書校正 (AI Employee v2.1, 2026-04-21)
 *
 * Route: /dashboard/tools/document-proofreader
 *
 * 入力:
 *   original (textarea, 100KB cap)
 *   style (business / casual / formal)
 *   checkLevel (light / strict)
 *
 * API:
 *   POST /api/tools/document-proofread
 *     body: { original, style, checkLevel }
 *     → {
 *          corrected: string,
 *          summary: string,
 *          corrections: {
 *            before: string,
 *            after: string,
 *            reason: string,
 *            category?: 'typo' | 'grammar' | 'tone' | 'clarity' | 'other',
 *          }[]
 *        }
 *
 * diff UI: before は削除線、after は下線、reason はツールチップ。
 */

import { useCallback, useMemo, useState } from 'react';
import {
  Play,
  Loader2,
  AlertTriangle,
  Info,
  Copy,
  Check,
  SpellCheck,
} from 'lucide-react';
import { fetchJson, isRecord } from '../lib/fetchJson';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MAX_INPUT_BYTES = 100 * 1024; // 100KB (UTF-8 bytes)

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DocStyle = 'business' | 'casual' | 'formal';
type CheckLevel = 'light' | 'strict';
type CorrectionCategory = 'typo' | 'grammar' | 'tone' | 'clarity' | 'other';

interface Correction {
  before: string;
  after: string;
  reason: string;
  category?: CorrectionCategory;
}

interface ProofreadResult {
  corrected: string;
  summary: string;
  corrections: Correction[];
}

function isCorrectionCategory(v: unknown): v is CorrectionCategory {
  return v === 'typo' || v === 'grammar' || v === 'tone' || v === 'clarity' || v === 'other';
}

function isCorrection(v: unknown): v is Correction {
  if (!isRecord(v)) return false;
  if (typeof v.before !== 'string') return false;
  if (typeof v.after !== 'string') return false;
  if (typeof v.reason !== 'string') return false;
  if ('category' in v && v.category !== undefined && !isCorrectionCategory(v.category)) return false;
  return true;
}

function isProofreadResult(v: unknown): v is ProofreadResult {
  if (!isRecord(v)) return false;
  if (typeof v.corrected !== 'string') return false;
  if (typeof v.summary !== 'string') return false;
  if (!Array.isArray(v.corrections) || !v.corrections.every(isCorrection)) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function utf8Bytes(s: string): number {
  return new TextEncoder().encode(s).length;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function buildMockResult(original: string, style: DocStyle, level: CheckLevel): ProofreadResult {
  const styleLabel = { business: 'ビジネス', casual: 'カジュアル', formal: 'フォーマル' }[style];
  const levelLabel = level === 'light' ? '軽め' : '厳格';

  const corrections: Correction[] = [
    {
      before: 'お世話なっております',
      after: 'お世話になっております',
      reason: '「に」の脱字を補完しました',
      category: 'typo',
    },
    {
      before: '致します',
      after: 'いたします',
      reason: 'ビジネス文書では補助動詞「致す」はひらがな表記が推奨されます',
      category: 'tone',
    },
    {
      before: 'よろしくお願いします',
      after: 'よろしくお願いいたします',
      reason: `${styleLabel} スタイルに合わせて丁寧度を揃えました`,
      category: 'tone',
    },
  ];

  const corrected = original
    .replace(/お世話なっております/g, 'お世話になっております')
    .replace(/致します/g, 'いたします')
    .replace(/よろしくお願いします/g, 'よろしくお願いいたします');

  return {
    corrected: corrected || '(校正対象なし — サンプル出力)',
    summary: `サンプル校正 (backend API 未接続) — スタイル: **${styleLabel}** / レベル: **${levelLabel}**

全体として敬語の揃え方と漢字/ひらがなの使い分けに改善余地があります。`,
    corrections,
  };
}

const CATEGORY_LABELS: Record<CorrectionCategory, string> = {
  typo: '誤字',
  grammar: '文法',
  tone: '敬体',
  clarity: '明瞭さ',
  other: 'その他',
};

const CATEGORY_COLORS: Record<CorrectionCategory, string> = {
  typo: 'bg-status-fail/10 text-status-fail border-status-fail/20',
  grammar: 'bg-status-warn/10 text-status-warn border-status-warn/20',
  tone: 'bg-accent/10 text-accent border-accent/20',
  clarity: 'bg-status-ok/10 text-status-ok border-status-ok/20',
  other: 'bg-base-elevated text-text-secondary border-border',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function DocumentProofreader() {
  const [original, setOriginal] = useState('');
  const [style, setStyle] = useState<DocStyle>('business');
  const [checkLevel, setCheckLevel] = useState<CheckLevel>('strict');
  const [result, setResult] = useState<ProofreadResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [copied, setCopied] = useState(false);

  const inputBytes = useMemo(() => utf8Bytes(original), [original]);
  const overCap = inputBytes > MAX_INPUT_BYTES;
  const canRun = original.trim().length > 0 && !overCap && !running;

  const run = useCallback(async () => {
    if (!canRun) return;
    setRunning(true);
    setResult(null);
    setError(null);
    setUsingMock(false);
    try {
      const res = await fetchJson('/api/tools/document-proofread', {
        method: 'POST',
        body: {
          original,
          style,
          checkLevel,
        },
      });
      if (!isProofreadResult(res)) throw new Error('invalid');
      setResult(res);
    } catch {
      setResult(buildMockResult(original, style, checkLevel));
      setUsingMock(true);
    } finally {
      setRunning(false);
    }
  }, [canRun, original, style, checkLevel]);

  const copyCorrected = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.corrected);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('クリップボードへのコピーに失敗しました');
    }
  }, [result]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-text-primary flex items-center gap-2">
          <SpellCheck className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
          文書校正
        </h1>
        <p className="text-sm text-text-secondary">
          原文を貼り付けると、誤字脱字・敬体・明瞭さを AI がチェックして修正案を提示します。
        </p>
      </header>

      <div className="surface-card p-3 flex items-start gap-2 text-xs text-text-secondary" role="note">
        <Info className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span>入力は最大 {formatBytes(MAX_INPUT_BYTES)}。機密情報は会社ポリシーに従って扱ってください。</span>
      </div>

      <section className="surface-card p-5 space-y-3" aria-labelledby="dp-input-heading">
        <h2 id="dp-input-heading" className="text-sm font-semibold text-text-primary">
          原文
        </h2>
        <textarea
          value={original}
          onChange={(e) => setOriginal(e.target.value)}
          placeholder="例: 平素よりお世話なっております。表題の件、以下の通り報告致します。..."
          rows={10}
          className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-y"
          disabled={running}
        />
        <div className="flex items-center justify-between text-xs">
          <span className={overCap ? 'text-status-fail' : 'text-text-muted'}>
            {formatBytes(inputBytes)} / {formatBytes(MAX_INPUT_BYTES)}
          </span>
          {overCap && <span className="text-status-fail">上限を超えています</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-text-muted mb-1">スタイル</span>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as DocStyle)}
              className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={running}
            >
              <option value="business">ビジネス</option>
              <option value="casual">カジュアル</option>
              <option value="formal">フォーマル</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-xs text-text-muted mb-1">チェックレベル</span>
            <select
              value={checkLevel}
              onChange={(e) => setCheckLevel(e.target.value as CheckLevel)}
              className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={running}
            >
              <option value="light">軽め (誤字/脱字中心)</option>
              <option value="strict">厳格 (敬体 / 明瞭さまで)</option>
            </select>
          </label>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={run}
            disabled={!canRun}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-card text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
          >
            {running ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} aria-hidden="true" />
                校正中...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
                校正実行
              </>
            )}
          </button>
        </div>
      </section>

      {error && (
        <div className="surface-card p-3 flex items-start gap-2 text-sm text-status-fail" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {usingMock && result && (
        <div className="surface-card p-3 text-xs text-text-muted" role="status">
          サンプル出力を表示中 (backend API 未接続)
        </div>
      )}

      {result && (
        <>
          <section className="surface-card p-5 space-y-3" aria-labelledby="dp-summary-heading">
            <h2 id="dp-summary-heading" className="text-sm font-semibold text-text-primary">
              全体所見
            </h2>
            <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{result.summary}</p>
          </section>

          <CorrectionListView corrections={result.corrections} />

          <section className="surface-card p-5 space-y-3" aria-labelledby="dp-corrected-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="dp-corrected-heading" className="text-sm font-semibold text-text-primary">
                校正後の全文
              </h2>
              <button
                type="button"
                onClick={copyCorrected}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-card text-xs font-medium bg-base-elevated text-text-primary border border-border hover:border-accent/40 transition-colors duration-120"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-status-ok" strokeWidth={1.5} aria-hidden="true" />
                    コピー済み
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
                    コピー
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-base-elevated border border-border rounded-card text-sm text-text-primary whitespace-pre-wrap">
              {result.corrected}
            </pre>
          </section>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Correction list                                                    */
/* ------------------------------------------------------------------ */

function CorrectionListView({ corrections }: { corrections: Correction[] }) {
  if (corrections.length === 0) {
    return (
      <section className="surface-card p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-2">修正提案</h2>
        <p className="text-xs text-text-muted">修正候補は検出されませんでした。</p>
      </section>
    );
  }

  return (
    <section className="surface-card p-5 space-y-3" aria-labelledby="dp-corrections-heading">
      <h2 id="dp-corrections-heading" className="text-sm font-semibold text-text-primary">
        修正提案 ({corrections.length}件)
      </h2>
      <ul className="space-y-2">
        {corrections.map((c, i) => (
          <li key={i} className="p-3 bg-base-elevated rounded-card border border-border">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-sm">
                  <span className="line-through text-status-fail/80">{c.before}</span>
                  <span className="mx-2 text-text-muted">→</span>
                  <span className="underline decoration-accent text-accent font-medium">{c.after}</span>
                </div>
                <div
                  className="text-xs text-text-secondary"
                  title={c.reason}
                >
                  理由: {c.reason}
                </div>
              </div>
              {c.category && (
                <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-card border flex-shrink-0 ${CATEGORY_COLORS[c.category]}`}>
                  {CATEGORY_LABELS[c.category]}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
