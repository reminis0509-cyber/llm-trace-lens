/**
 * ExcelAnalyzer — Excel 分析 (AI Employee v2.1, 2026-04-21)
 *
 * Route: /dashboard/tools/excel-analyzer
 *
 * 入力:
 *   file (.xlsx/.xls, 10MB cap)
 *   analyzeSheet (sheet 名、ファイル解析後に選択)
 *   question (自由記述の質問)
 *
 * API:
 *   POST /api/tools/excel-analyze
 *     body: { fileName, fileBase64, sheet, question }
 *     → { sheets: string[], summary, insights: string[],
 *         aggregations: { title, rows: Record<string, unknown>[] }[],
 *         recommendedCharts: { title, type, note }[] }
 *
 * 初回アップロード時は sheet 一覧だけ取得するため、
 * question を空のまま投げると sheets のみ返す仕様を backend に期待。
 * fallback モックでは簡易的に "Sheet1/Sheet2" を返す。
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Play,
  Loader2,
  AlertTriangle,
  Info,
  BarChart3,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchJson, isRecord } from '../lib/fetchJson';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED_EXT = ['.xlsx', '.xls'];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AggregationTable {
  title: string;
  rows: Record<string, unknown>[];
}

interface RecommendedChart {
  title: string;
  type: 'bar' | 'line' | 'pie' | 'scatter';
  note?: string;
}

interface AnalyzeResult {
  sheets: string[];
  summary: string;
  insights: string[];
  aggregations: AggregationTable[];
  recommendedCharts: RecommendedChart[];
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isAggregationTable(v: unknown): v is AggregationTable {
  if (!isRecord(v)) return false;
  if (typeof v.title !== 'string') return false;
  if (!Array.isArray(v.rows)) return false;
  return v.rows.every((r) => isRecord(r));
}

function isRecommendedChart(v: unknown): v is RecommendedChart {
  if (!isRecord(v)) return false;
  if (typeof v.title !== 'string') return false;
  if (v.type !== 'bar' && v.type !== 'line' && v.type !== 'pie' && v.type !== 'scatter') return false;
  if ('note' in v && v.note !== undefined && typeof v.note !== 'string') return false;
  return true;
}

function isAnalyzeResult(v: unknown): v is AnalyzeResult {
  if (!isRecord(v)) return false;
  if (!isStringArray(v.sheets)) return false;
  if (typeof v.summary !== 'string') return false;
  if (!isStringArray(v.insights)) return false;
  if (!Array.isArray(v.aggregations) || !v.aggregations.every(isAggregationTable)) return false;
  if (!Array.isArray(v.recommendedCharts) || !v.recommendedCharts.every(isRecommendedChart)) return false;
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

function buildMockResult(fileName: string, question: string, sheet: string): AnalyzeResult {
  return {
    sheets: ['Sheet1', 'Sheet2', '売上データ'],
    summary: `## ${fileName || '(ファイル)'} の分析結果

> サンプル出力 (backend API 未接続)

対象シート: **${sheet || 'Sheet1'}**
質問: ${question || '(質問未指定)'}

全体として、対象データには 3 列 / 100 行程度の時系列情報が含まれていると想定されます。`,
    insights: [
      '月別で緩やかな右肩上がりのトレンドが見られます',
      '4 月と 10 月に顕著なピークがあります',
      '特定カテゴリが全体の 40% を占めています',
    ],
    aggregations: [
      {
        title: '月別合計 (サンプル)',
        rows: [
          { 月: '2026-01', 売上: 1200000, 件数: 34 },
          { 月: '2026-02', 売上: 1350000, 件数: 38 },
          { 月: '2026-03', 売上: 1780000, 件数: 47 },
          { 月: '2026-04', 売上: 2100000, 件数: 54 },
        ],
      },
    ],
    recommendedCharts: [
      { title: '月別売上推移', type: 'line', note: '時系列トレンドを可視化' },
      { title: 'カテゴリ別売上構成', type: 'pie', note: '構成比を確認' },
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ExcelAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetAll = useCallback(() => {
    setFile(null);
    setSheets([]);
    setSelectedSheet('');
    setQuestion('');
    setResult(null);
    setError(null);
    setUsingMock(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const detectSheets = useCallback(async (f: File) => {
    setDetecting(true);
    setError(null);
    try {
      const base64 = await fileToBase64(f);
      try {
        const res = await fetchJson('/api/tools/excel-analyze', {
          method: 'POST',
          body: {
            fileName: f.name,
            fileBase64: base64,
            sheet: '',
            question: '',
          },
        });
        if (!isRecord(res) || !isStringArray(res.sheets)) {
          throw new Error('invalid');
        }
        setSheets(res.sheets);
        setSelectedSheet(res.sheets[0] ?? '');
      } catch {
        const mock = buildMockResult(f.name, '', '');
        setSheets(mock.sheets);
        setSelectedSheet(mock.sheets[0] ?? '');
      }
    } catch (e) {
      setError((e as Error).message || 'ファイルの読み込みに失敗しました');
    } finally {
      setDetecting(false);
    }
  }, []);

  const handleFile = useCallback(async (f: File) => {
    if (!hasAcceptedExt(f.name)) {
      setError('対応形式は .xlsx / .xls のみです');
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError(`ファイルサイズは ${formatBytes(MAX_FILE_BYTES)} 以下にしてください`);
      return;
    }
    setFile(f);
    setResult(null);
    setUsingMock(false);
    await detectSheets(f);
  }, [detectSheets]);

  const onFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
  }, [handleFile]);

  const canRun = !!file && !!selectedSheet && question.trim().length > 0 && !running;

  const run = useCallback(async () => {
    if (!canRun || !file) return;
    setRunning(true);
    setResult(null);
    setError(null);
    setUsingMock(false);
    try {
      const base64 = await fileToBase64(file);
      try {
        const res = await fetchJson('/api/tools/excel-analyze', {
          method: 'POST',
          body: {
            fileName: file.name,
            fileBase64: base64,
            sheet: selectedSheet,
            question: question.trim(),
          },
        });
        if (!isAnalyzeResult(res)) throw new Error('invalid');
        setResult(res);
      } catch {
        setResult(buildMockResult(file.name, question.trim(), selectedSheet));
        setUsingMock(true);
      }
    } catch (e) {
      setError((e as Error).message || '分析に失敗しました');
    } finally {
      setRunning(false);
    }
  }, [canRun, file, selectedSheet, question]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-text-primary flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
          Excel 分析
        </h1>
        <p className="text-sm text-text-secondary">
          Excel ファイルをアップロードし、自然言語で質問することで AI が要約・集計・グラフ提案を行います。
        </p>
      </header>

      <div className="surface-card p-3 flex items-start gap-2 text-xs text-text-secondary" role="note">
        <Info className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span>
          アップロードは最大 {formatBytes(MAX_FILE_BYTES)}、対応形式は .xlsx / .xls。機密データは会社ポリシーに従って扱ってください。
        </span>
      </div>

      {/* Upload */}
      <section className="surface-card p-5 space-y-3" aria-labelledby="ea-upload-heading">
        <h2 id="ea-upload-heading" className="text-sm font-semibold text-text-primary">
          ファイル
        </h2>

        {!file && (
          <label
            className="flex flex-col items-center justify-center gap-2 py-8 border border-dashed border-border rounded-card cursor-pointer hover:border-accent/40 transition-colors duration-120"
          >
            <Upload className="w-6 h-6 text-text-muted" strokeWidth={1.5} aria-hidden="true" />
            <span className="text-sm text-text-primary">Excel ファイルを選択</span>
            <span className="text-xs text-text-muted">.xlsx / .xls / 最大 {formatBytes(MAX_FILE_BYTES)}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onFileInputChange}
              aria-label="Excel ファイルアップロード"
            />
          </label>
        )}

        {file && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 p-3 bg-base-elevated rounded-card border border-border">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="w-4 h-4 text-accent flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-sm text-text-primary truncate">{file.name}</div>
                  <div className="text-xs text-text-muted">{formatBytes(file.size)}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={resetAll}
                className="text-xs text-text-secondary hover:text-text-primary"
              >
                変更
              </button>
            </div>

            {detecting && (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} aria-hidden="true" />
                シートを解析中...
              </div>
            )}

            {sheets.length > 0 && (
              <label className="block">
                <span className="block text-xs text-text-muted mb-1">分析対象シート</span>
                <select
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  disabled={running}
                >
                  {sheets.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </section>

      {/* Question */}
      {file && sheets.length > 0 && (
        <section className="surface-card p-5 space-y-3" aria-labelledby="ea-question-heading">
          <h2 id="ea-question-heading" className="text-sm font-semibold text-text-primary">
            質問
          </h2>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例: 売上の月別推移を教えて / カテゴリごとの構成比と傾向を要約して"
            rows={4}
            className="w-full px-3 py-2 bg-base border border-border rounded-card text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            disabled={running}
          />

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
                  分析中...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden="true" />
                  分析実行
                </>
              )}
            </button>
          </div>
        </section>
      )}

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

      {result && <AnalyzeResultView result={result} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Result view                                                        */
/* ------------------------------------------------------------------ */

function AnalyzeResultView({ result }: { result: AnalyzeResult }) {
  return (
    <div className="space-y-5">
      <section className="surface-card p-5" aria-labelledby="ea-summary-heading">
        <h2 id="ea-summary-heading" className="text-sm font-semibold text-text-primary mb-3">
          要約
        </h2>
        <div className="prose prose-sm max-w-none text-text-primary">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary}</ReactMarkdown>
        </div>
      </section>

      {result.insights.length > 0 && (
        <section className="surface-card p-5" aria-labelledby="ea-insights-heading">
          <h2 id="ea-insights-heading" className="text-sm font-semibold text-text-primary mb-3">
            インサイト
          </h2>
          <ul className="space-y-2">
            {result.insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                <span className="text-text-muted flex-shrink-0">・</span>
                <span>{ins}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.aggregations.map((agg, i) => (
        <AggregationTableView key={i} table={agg} />
      ))}

      {result.recommendedCharts.length > 0 && (
        <section className="surface-card p-5" aria-labelledby="ea-charts-heading">
          <h2 id="ea-charts-heading" className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" strokeWidth={1.5} aria-hidden="true" />
            推奨グラフ
          </h2>
          <ul className="space-y-2">
            {result.recommendedCharts.map((c, i) => (
              <li key={i} className="flex items-start justify-between gap-3 p-3 bg-base-elevated rounded-card border border-border">
                <div className="min-w-0">
                  <div className="text-sm text-text-primary">{c.title}</div>
                  {c.note && <div className="text-xs text-text-muted mt-1">{c.note}</div>}
                </div>
                <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-card bg-accent/10 text-accent border border-accent/20 flex-shrink-0">
                  {c.type}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-muted mt-3">
            実際のグラフ描画 (Recharts) は Phase A1 で対応予定です。
          </p>
        </section>
      )}
    </div>
  );
}

function AggregationTableView({ table }: { table: AggregationTable }) {
  const columns = useMemo(() => {
    const set = new Set<string>();
    for (const row of table.rows) {
      for (const key of Object.keys(row)) set.add(key);
    }
    return Array.from(set);
  }, [table.rows]);

  if (table.rows.length === 0) {
    return (
      <section className="surface-card p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-2">{table.title}</h3>
        <p className="text-xs text-text-muted">該当データがありません</p>
      </section>
    );
  }

  return (
    <section className="surface-card p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-3">{table.title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th key={col} className="px-2 py-2 text-text-secondary font-medium whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                {columns.map((col) => (
                  <td key={col} className="px-2 py-2 text-text-primary whitespace-nowrap tabular-nums">
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v.toLocaleString('ja-JP');
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
