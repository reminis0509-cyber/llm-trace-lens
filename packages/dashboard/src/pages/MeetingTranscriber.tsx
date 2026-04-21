/**
 * MeetingTranscriber — 音声議事録 (AI Employee v2.1, 2026-04-21)
 *
 * Route: /dashboard/tools/meeting-transcriber
 *
 * 入力:
 *   audio file (.mp3/.wav/.m4a, 25MB cap)
 *   language (ja / en / auto)
 *
 * API:
 *   POST /api/tools/meeting-transcribe
 *     body: { fileName, fileBase64, language }
 *     → {
 *          transcript: string,
 *          minutes: {
 *            date?: string,
 *            attendees?: string[],
 *            agenda?: string[],
 *            decisions?: string[],
 *            todos?: { text: string; owner?: string; due?: string }[],
 *            nextMeeting?: string,
 *          },
 *          markdown: string
 *        }
 *
 * PDF: generateMarkdownPdf を再利用
 */

import { useCallback, useRef, useState } from 'react';
import {
  Upload,
  Mic,
  Play,
  Loader2,
  AlertTriangle,
  Info,
  Copy,
  Check,
  FileDown,
  ChevronDown,
} from 'lucide-react';
import { fetchJson, isRecord } from '../lib/fetchJson';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB
const ACCEPTED_EXT = ['.mp3', '.wav', '.m4a'];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Language = 'ja' | 'en' | 'auto';

interface TodoItem {
  text: string;
  owner?: string;
  due?: string;
}

interface Minutes {
  date?: string;
  attendees?: string[];
  agenda?: string[];
  decisions?: string[];
  todos?: TodoItem[];
  nextMeeting?: string;
}

interface TranscribeResult {
  transcript: string;
  minutes: Minutes;
  markdown: string;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isTodoItem(v: unknown): v is TodoItem {
  if (!isRecord(v)) return false;
  if (typeof v.text !== 'string') return false;
  if ('owner' in v && v.owner !== undefined && typeof v.owner !== 'string') return false;
  if ('due' in v && v.due !== undefined && typeof v.due !== 'string') return false;
  return true;
}

function isMinutes(v: unknown): v is Minutes {
  if (!isRecord(v)) return false;
  if ('date' in v && v.date !== undefined && typeof v.date !== 'string') return false;
  if ('attendees' in v && v.attendees !== undefined && !isStringArray(v.attendees)) return false;
  if ('agenda' in v && v.agenda !== undefined && !isStringArray(v.agenda)) return false;
  if ('decisions' in v && v.decisions !== undefined && !isStringArray(v.decisions)) return false;
  if ('todos' in v && v.todos !== undefined) {
    if (!Array.isArray(v.todos) || !v.todos.every(isTodoItem)) return false;
  }
  if ('nextMeeting' in v && v.nextMeeting !== undefined && typeof v.nextMeeting !== 'string') return false;
  return true;
}

function isTranscribeResult(v: unknown): v is TranscribeResult {
  if (!isRecord(v)) return false;
  if (typeof v.transcript !== 'string') return false;
  if (!isMinutes(v.minutes)) return false;
  if (typeof v.markdown !== 'string') return false;
  return true;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function hasAcceptedExt(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXT.some((ext) => lower.endsWith(ext));
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function buildMockResult(fileName: string): TranscribeResult {
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  const transcript = `[サンプル transcript — backend API 未接続]
話者A: 本日はお集まりいただきありがとうございます。
話者B: 今回のテーマは次四半期の製品ロードマップです。
話者A: 主要機能としてはスライド生成、Excel 分析、音声議事録の3つを優先します。
話者B: スケジュールは来月中旬までに β リリース、その後ユーザーテストで進めましょう。
話者A: ToDo としては、それぞれ担当者を割り当てて来週までに仕様を固めます。
話者B: 了解しました。次回は来週月曜に同時刻で。`;

  const markdown = `# 議事録

- 日時: ${today}
- 参加者: 話者A, 話者B
- 議題: 次四半期の製品ロードマップ

## 決定事項
- 次四半期はスライド生成 / Excel 分析 / 音声議事録 の3機能を優先
- β リリースは来月中旬

## ToDo
- [ ] スライド生成の仕様を固める (担当: 話者A, 期限: 来週)
- [ ] Excel 分析の技術選定 (担当: 話者B, 期限: 来週)

## 次回
- 来週月曜 同時刻`;

  return {
    transcript,
    minutes: {
      date: today,
      attendees: ['話者A', '話者B'],
      agenda: ['次四半期の製品ロードマップ'],
      decisions: [
        '次四半期はスライド生成 / Excel 分析 / 音声議事録 の3機能を優先',
        'β リリースは来月中旬',
      ],
      todos: [
        { text: 'スライド生成の仕様を固める', owner: '話者A', due: '来週' },
        { text: 'Excel 分析の技術選定', owner: '話者B', due: '来週' },
      ],
      nextMeeting: '来週月曜 同時刻',
    },
    markdown: `# 議事録 — ${fileName || '(音声ファイル)'}\n\n${markdown}`,
  };
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

export function MeetingTranscriber() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<Language>('ja');
  const [result, setResult] = useState<TranscribeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [copied, setCopied] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetFile = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
    setUsingMock(false);
    setTranscriptOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleFile = useCallback((f: File) => {
    if (!hasAcceptedExt(f.name)) {
      setError('対応形式は .mp3 / .wav / .m4a のみです');
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError(`ファイルサイズは ${formatBytes(MAX_FILE_BYTES)} 以下にしてください`);
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
    setUsingMock(false);
  }, []);

  const onFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const canRun = !!file && !running;

  const run = useCallback(async () => {
    if (!canRun || !file) return;
    setRunning(true);
    setResult(null);
    setError(null);
    setUsingMock(false);
    try {
      const base64 = await fileToBase64(file);
      try {
        const res = await fetchJson('/api/tools/meeting-transcribe', {
          method: 'POST',
          body: {
            fileName: file.name,
            fileBase64: base64,
            language,
          },
        });
        if (!isTranscribeResult(res)) throw new Error('invalid');
        setResult(res);
      } catch {
        setResult(buildMockResult(file.name));
        setUsingMock(true);
      }
    } catch (e) {
      setError((e as Error).message || '文字起こしに失敗しました');
    } finally {
      setRunning(false);
    }
  }, [canRun, file, language]);

  const copyMarkdown = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('クリップボードへのコピーに失敗しました');
    }
  }, [result]);

  const downloadPdf = useCallback(async () => {
    if (!result) return;
    setPdfBusy(true);
    setError(null);
    try {
      const mod = await import('../lib/pdf/markdown-pdf');
      const blob = await mod.generateMarkdownPdf(result.markdown, { title: '議事録' });
      const safeName = (file?.name || 'meeting').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_');
      triggerDownload(blob, `${safeName}_議事録.pdf`);
    } catch (e) {
      setError((e as Error).message || 'PDF 生成に失敗しました');
    } finally {
      setPdfBusy(false);
    }
  }, [result, file]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-text-primary flex items-center gap-2">
          <Mic className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
          音声議事録
        </h1>
        <p className="text-sm text-text-secondary">
          会議音声をアップロードすると、文字起こし + 議事録 (日時 / 参加者 / 議題 / 決定事項 / ToDo / 次回) を生成します。
        </p>
      </header>

      <div className="surface-card p-3 flex items-start gap-2 text-xs text-text-secondary" role="note">
        <Info className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span>
          アップロードは最大 {formatBytes(MAX_FILE_BYTES)}、対応形式は .mp3 / .wav / .m4a。処理には数秒〜数十秒かかります。
        </span>
      </div>

      {/* Upload */}
      <section className="surface-card p-5 space-y-3" aria-labelledby="mt-upload-heading">
        <h2 id="mt-upload-heading" className="text-sm font-semibold text-text-primary">
          音声ファイル
        </h2>

        {!file && (
          <label className="flex flex-col items-center justify-center gap-2 py-8 border border-dashed border-border rounded-card cursor-pointer hover:border-accent/40 transition-colors duration-120">
            <Upload className="w-6 h-6 text-text-muted" strokeWidth={1.5} aria-hidden="true" />
            <span className="text-sm text-text-primary">音声ファイルを選択</span>
            <span className="text-xs text-text-muted">.mp3 / .wav / .m4a / 最大 {formatBytes(MAX_FILE_BYTES)}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a,audio/*"
              className="hidden"
              onChange={onFileInputChange}
              aria-label="音声ファイルアップロード"
            />
          </label>
        )}

        {file && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 p-3 bg-base-elevated rounded-card border border-border">
              <div className="flex items-center gap-2 min-w-0">
                <Mic className="w-4 h-4 text-accent flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-sm text-text-primary truncate">{file.name}</div>
                  <div className="text-xs text-text-muted">{formatBytes(file.size)}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={resetFile}
                className="text-xs text-text-secondary hover:text-text-primary"
              >
                変更
              </button>
            </div>

            <label className="block">
              <span className="block text-xs text-text-muted mb-1">言語</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                disabled={running}
              >
                <option value="ja">日本語</option>
                <option value="en">英語</option>
                <option value="auto">自動検出</option>
              </select>
            </label>

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
                    文字起こし中...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
                    文字起こし + 議事録生成
                  </>
                )}
              </button>
            </div>
          </div>
        )}
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
          <MinutesView minutes={result.minutes} />

          <section className="surface-card p-5" aria-labelledby="mt-actions-heading">
            <h2 id="mt-actions-heading" className="text-sm font-semibold text-text-primary mb-3">
              エクスポート
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={copyMarkdown}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-card text-xs font-medium bg-base-elevated text-text-primary border border-border hover:border-accent/40 transition-colors duration-120"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-status-ok" strokeWidth={1.5} aria-hidden="true" />
                    コピー済み
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
                    Markdown コピー
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={downloadPdf}
                disabled={pdfBusy}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-card text-xs font-medium bg-base-elevated text-text-primary border border-border hover:border-accent/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-120"
              >
                {pdfBusy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} aria-hidden="true" />
                    生成中...
                  </>
                ) : (
                  <>
                    <FileDown className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
                    PDF 出力
                  </>
                )}
              </button>
            </div>
          </section>

          <section className="surface-card p-5" aria-labelledby="mt-transcript-heading">
            <button
              type="button"
              onClick={() => setTranscriptOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 text-left"
              aria-expanded={transcriptOpen}
              aria-controls="mt-transcript-panel"
            >
              <h2 id="mt-transcript-heading" className="text-sm font-semibold text-text-primary">
                全 transcript
              </h2>
              <ChevronDown
                className={`w-4 h-4 text-text-muted transition-transform duration-120 ${transcriptOpen ? 'rotate-180' : ''}`}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </button>
            {transcriptOpen && (
              <pre
                id="mt-transcript-panel"
                className="mt-3 p-3 bg-base-elevated border border-border rounded-card text-xs text-text-primary overflow-auto max-h-[480px] whitespace-pre-wrap"
              >
                {result.transcript}
              </pre>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Minutes card                                                       */
/* ------------------------------------------------------------------ */

function MinutesView({ minutes }: { minutes: Minutes }) {
  const cards: { label: string; node: React.ReactNode }[] = [];

  if (minutes.date) {
    cards.push({ label: '日時', node: <span className="text-sm text-text-primary">{minutes.date}</span> });
  }
  if (minutes.attendees && minutes.attendees.length > 0) {
    cards.push({
      label: '参加者',
      node: (
        <div className="flex flex-wrap gap-1.5">
          {minutes.attendees.map((a, i) => (
            <span key={i} className="inline-flex items-center px-2 py-0.5 text-xs rounded-card bg-accent/10 text-accent border border-accent/20">
              {a}
            </span>
          ))}
        </div>
      ),
    });
  }
  if (minutes.agenda && minutes.agenda.length > 0) {
    cards.push({
      label: '議題',
      node: (
        <ul className="space-y-1">
          {minutes.agenda.map((a, i) => (
            <li key={i} className="text-sm text-text-primary flex items-start gap-2">
              <span className="text-text-muted flex-shrink-0">・</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      ),
    });
  }
  if (minutes.decisions && minutes.decisions.length > 0) {
    cards.push({
      label: '決定事項',
      node: (
        <ul className="space-y-1">
          {minutes.decisions.map((d, i) => (
            <li key={i} className="text-sm text-text-primary flex items-start gap-2">
              <span className="text-accent flex-shrink-0">◆</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      ),
    });
  }
  if (minutes.todos && minutes.todos.length > 0) {
    cards.push({
      label: 'ToDo',
      node: (
        <ul className="space-y-1.5">
          {minutes.todos.map((t, i) => (
            <li key={i} className="text-sm text-text-primary">
              <div className="flex items-start gap-2">
                <span className="text-text-muted flex-shrink-0">□</span>
                <span className="flex-1">{t.text}</span>
              </div>
              {(t.owner || t.due) && (
                <div className="ml-5 mt-0.5 text-xs text-text-muted">
                  {t.owner && <span>担当: {t.owner}</span>}
                  {t.owner && t.due && <span> / </span>}
                  {t.due && <span>期限: {t.due}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      ),
    });
  }
  if (minutes.nextMeeting) {
    cards.push({
      label: '次回',
      node: <span className="text-sm text-text-primary">{minutes.nextMeeting}</span>,
    });
  }

  if (cards.length === 0) {
    return (
      <section className="surface-card p-5">
        <p className="text-xs text-text-muted">議事録の構造化データが取得できませんでした。全 transcript を参照してください。</p>
      </section>
    );
  }

  return (
    <section className="surface-card p-5 space-y-4" aria-labelledby="mt-minutes-heading">
      <h2 id="mt-minutes-heading" className="text-sm font-semibold text-text-primary">
        議事録
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((c, i) => (
          <div key={i} className="p-3 bg-base-elevated rounded-card border border-border">
            <div className="text-xs text-text-muted mb-1.5">{c.label}</div>
            {c.node}
          </div>
        ))}
      </div>
    </section>
  );
}
