/**
 * agent/excel-analyzer.ts — AI 社員 v2.1 Excel analysis tool.
 *
 * Given a base64-encoded .xlsx / .xls / .csv workbook plus a natural-language
 * question, this module:
 *   1. Parses the workbook with `xlsx` (SheetJS).
 *   2. Asks an LLM to choose the most relevant sheet given the question and
 *      a compact preview of each sheet (name + shape + first 20 rows).
 *   3. Computes pandas-style aggregations on the chosen sheet:
 *        - numeric columns     → { sum, avg, count, min, max }
 *        - categorical columns → value_counts (top 10)
 *   4. Asks the LLM for a natural-language insight summary, then returns a
 *      structured payload the dashboard can render directly.
 *
 * The module is split into many small functions so that the main planning
 * phases (sheet selection, aggregation, narrative) are independently
 * testable.
 */
import * as XLSX from 'xlsx';
import type { FastifyInstance } from 'fastify';
import { callLlmViaProxy, type LlmMessage } from '../routes/tools/_shared.js';

export interface ExcelAnalyzerInput {
  fileBase64: string;
  /** Optional hint; if omitted, the LLM picks the most relevant sheet. */
  sheetName?: string;
  question: string;
}

export type CellValue = string | number | boolean | null;

export interface SheetPreview {
  name: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  sample: Record<string, CellValue>[];
}

export interface NumericAggregation {
  kind: 'numeric';
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

export interface CategoricalAggregation {
  kind: 'categorical';
  count: number;
  unique: number;
  top: Array<{ value: string; count: number }>;
}

export type ColumnAggregation = NumericAggregation | CategoricalAggregation;

export interface RecommendedChart {
  type: 'bar' | 'line' | 'pie';
  xCol: string;
  yCol: string;
}

export interface ExcelAnalyzerOutput {
  selectedSheet: string;
  summary: string;
  insights: string[];
  aggregations: Record<string, ColumnAggregation>;
  recommendedCharts: RecommendedChart[];
  sheets: SheetPreview[];
}

const MAX_PREVIEW_ROWS = 20;

/**
 * Load a workbook from base64 and return a preview of every sheet. Throws
 * if the buffer is not a valid spreadsheet. We use `cellDates:true` so that
 * Excel dates round-trip as ISO strings rather than 1900-offset numbers.
 */
export function loadWorkbook(fileBase64: string): XLSX.WorkBook {
  const buf = Buffer.from(fileBase64, 'base64');
  if (buf.length === 0) {
    throw new Error('empty workbook');
  }
  return XLSX.read(buf, { type: 'buffer', cellDates: true });
}

/** Extract a structured preview of every sheet in the workbook. */
export function previewSheets(wb: XLSX.WorkBook): SheetPreview[] {
  const previews: SheetPreview[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, CellValue>>(sheet, {
      defval: null,
      raw: true,
    });
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    previews.push({
      name,
      rowCount: rows.length,
      columnCount: columns.length,
      columns,
      sample: rows.slice(0, MAX_PREVIEW_ROWS),
    });
  }
  return previews;
}

/**
 * Aggregate every column of a sheet. Numeric-looking columns (>50% numeric
 * values) get min/max/avg/sum; otherwise they are treated as categorical
 * and we produce a top-10 value_counts table.
 */
export function aggregateSheet(
  sheet: XLSX.WorkSheet,
): Record<string, ColumnAggregation> {
  const rows = XLSX.utils.sheet_to_json<Record<string, CellValue>>(sheet, {
    defval: null,
    raw: true,
  });
  const out: Record<string, ColumnAggregation> = {};
  if (rows.length === 0) return out;

  const columns = Object.keys(rows[0]);
  for (const col of columns) {
    const values = rows.map((r) => r[col]).filter((v) => v !== null && v !== '');
    if (values.length === 0) continue;
    const numericValues = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const numericRatio = numericValues.length / values.length;
    if (numericRatio >= 0.5 && numericValues.length > 0) {
      const sum = numericValues.reduce((a, b) => a + b, 0);
      out[col] = {
        kind: 'numeric',
        count: numericValues.length,
        sum,
        avg: sum / numericValues.length,
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
      };
    } else {
      const counts = new Map<string, number>();
      for (const v of values) {
        const key = String(v);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const sorted = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({ value, count }));
      out[col] = {
        kind: 'categorical',
        count: values.length,
        unique: counts.size,
        top: sorted,
      };
    }
  }
  return out;
}

/** Suggest up to 3 simple charts based on column types. */
export function recommendCharts(
  aggregations: Record<string, ColumnAggregation>,
): RecommendedChart[] {
  const numericCols = Object.entries(aggregations)
    .filter(([, v]) => v.kind === 'numeric')
    .map(([k]) => k);
  const categoricalCols = Object.entries(aggregations)
    .filter(([, v]) => v.kind === 'categorical')
    .map(([k]) => k);

  const charts: RecommendedChart[] = [];
  if (categoricalCols.length > 0 && numericCols.length > 0) {
    charts.push({ type: 'bar', xCol: categoricalCols[0], yCol: numericCols[0] });
  }
  if (numericCols.length >= 2) {
    charts.push({ type: 'line', xCol: numericCols[0], yCol: numericCols[1] });
  }
  if (categoricalCols.length > 0) {
    charts.push({ type: 'pie', xCol: categoricalCols[0], yCol: categoricalCols[0] });
  }
  return charts.slice(0, 3);
}

/**
 * Ask the LLM to choose the best sheet + produce narrative insights. The
 * sheet choice is recovered from the first line of the response, formatted
 * as `SHEET: <name>`, with the rest taken as the narrative summary.
 */
async function askLlmForInsight(
  fastify: FastifyInstance,
  question: string,
  sheets: SheetPreview[],
  preSelected: string | undefined,
  aggregations: Record<string, ColumnAggregation> | null,
  workspaceId?: string,
): Promise<{ selectedSheet: string; summary: string; insights: string[] }> {
  const sheetSummary = sheets
    .map(
      (s) =>
        `- ${s.name}: ${s.rowCount} rows × ${s.columnCount} cols, columns=${s.columns.slice(0, 20).join(', ')}`,
    )
    .join('\n');
  const messages: LlmMessage[] = [
    {
      role: 'system',
      content: [
        'あなたは日本語で働くデータアナリストです。',
        '与えられた Excel の sheet 一覧と集計結果をもとに、質問に答えます。',
        '出力は必ず次の形式:',
        '1行目: `SHEET: <最も関連する sheet 名>`',
        '2行目以降: 要約 1-2 段落 + 箇条書きの洞察 3-5 件',
        '絵文字、Markdown 見出しは使わない。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `質問: ${question}`,
        preSelected ? `ユーザー指定 sheet: ${preSelected}` : '',
        '',
        'sheets:',
        sheetSummary,
        '',
        aggregations
          ? `集計結果 (JSON):\n${JSON.stringify(aggregations).slice(0, 4000)}`
          : '(集計結果はこの後計算されます)',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];

  const { content } = await callLlmViaProxy(fastify, messages, {
    model: 'gpt-4o-mini',
    temperature: 0.2,
    maxTokens: 1200,
    workspaceId,
    traceType: 'agent',
  });

  const lines = content.split('\n');
  let selectedSheet = preSelected ?? sheets[0]?.name ?? '';
  const first = lines[0]?.trim() ?? '';
  const m = /^SHEET:\s*(.+)$/i.exec(first);
  if (m) {
    const candidate = m[1].trim();
    if (sheets.find((s) => s.name === candidate)) selectedSheet = candidate;
    lines.shift();
  }
  const rest = lines.join('\n').trim();
  const insights = rest
    .split('\n')
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter((l) => l.length > 0 && !/^sheet:/i.test(l));
  return {
    selectedSheet,
    summary: rest.split('\n').slice(0, 3).join(' ').slice(0, 500),
    insights: insights.slice(0, 8),
  };
}

/** Main entry point: parse workbook → aggregate → ask LLM → return payload. */
export async function analyzeExcel(
  fastify: FastifyInstance,
  input: ExcelAnalyzerInput,
): Promise<ExcelAnalyzerOutput> {
  if (!input.question || input.question.trim().length < 2) {
    throw new Error('question is required');
  }
  const wb = loadWorkbook(input.fileBase64);
  const sheets = previewSheets(wb);
  if (sheets.length === 0) {
    throw new Error('workbook has no sheets');
  }

  // First pass: pick a sheet (LLM), then aggregate it, then second LLM pass
  // for narrative. We do two LLM calls so the narrative has access to the
  // numeric aggregations — this gives much sharper insight text.
  const firstPass = await askLlmForInsight(
    fastify,
    input.question,
    sheets,
    input.sheetName,
    null,
  );
  const chosenName = sheets.find((s) => s.name === firstPass.selectedSheet)?.name ?? sheets[0].name;
  const chosenSheet = wb.Sheets[chosenName];
  if (!chosenSheet) {
    throw new Error(`sheet not found: ${chosenName}`);
  }
  const aggregations = aggregateSheet(chosenSheet);
  const recommendedCharts = recommendCharts(aggregations);

  const secondPass = await askLlmForInsight(
    fastify,
    input.question,
    sheets,
    chosenName,
    aggregations,
  );

  return {
    selectedSheet: chosenName,
    summary: secondPass.summary || firstPass.summary,
    insights: secondPass.insights.length > 0 ? secondPass.insights : firstPass.insights,
    aggregations,
    recommendedCharts,
    sheets,
  };
}
