/**
 * excel-analyzer.test.ts — AI 社員 v2.1 Excel analyzer unit tests.
 *
 * Covers the pure/parse/aggregate surface (no LLM call). We build a tiny
 * workbook in-memory with `xlsx`, serialise it to base64, and verify that:
 *   1. loadWorkbook + previewSheets round-trip the data.
 *   2. aggregateSheet produces numeric/categorical summaries as expected.
 *   3. recommendCharts picks chart types that match the column shapes.
 *
 * The LLM-dependent `analyzeExcel` entry point is exercised separately via
 * the route test; keeping the unit test network-free keeps CI fast and
 * deterministic.
 */
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  loadWorkbook,
  previewSheets,
  aggregateSheet,
  recommendCharts,
} from '../../agent/excel-analyzer.js';

function buildSampleXlsxBase64(): string {
  const wb = XLSX.utils.book_new();
  const data = [
    ['product', 'month', 'revenue', 'region'],
    ['FujiTrace Pro', '2026-03', 150000, 'Tokyo'],
    ['FujiTrace Pro', '2026-04', 180000, 'Tokyo'],
    ['FujiTrace Max', '2026-03', 300000, 'Osaka'],
    ['FujiTrace Max', '2026-04', 450000, 'Osaka'],
    ['FujiTrace Free', '2026-04', 0, 'Tokyo'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'sales');
  // Second sheet — makes multi-sheet pick logic testable.
  const emptyWs = XLSX.utils.aoa_to_sheet([['note'], ['internal']]);
  XLSX.utils.book_append_sheet(wb, emptyWs, 'notes');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buf.toString('base64');
}

describe('excel-analyzer: parse + preview', () => {
  it('loads a base64 xlsx and lists every sheet', () => {
    const b64 = buildSampleXlsxBase64();
    const wb = loadWorkbook(b64);
    const previews = previewSheets(wb);
    expect(previews.map((p) => p.name)).toEqual(['sales', 'notes']);
    const sales = previews[0];
    expect(sales.rowCount).toBe(5);
    expect(sales.columnCount).toBe(4);
    expect(sales.columns).toEqual(['product', 'month', 'revenue', 'region']);
    expect(sales.sample.length).toBe(5);
  });

  it('rejects an empty buffer', () => {
    expect(() => loadWorkbook('')).toThrow();
  });
});

describe('excel-analyzer: aggregation', () => {
  it('recognises numeric and categorical columns', () => {
    const b64 = buildSampleXlsxBase64();
    const wb = loadWorkbook(b64);
    const agg = aggregateSheet(wb.Sheets['sales']);
    const revenue = agg['revenue'];
    expect(revenue).toBeDefined();
    expect(revenue.kind).toBe('numeric');
    if (revenue.kind === 'numeric') {
      expect(revenue.count).toBe(5);
      expect(revenue.sum).toBe(1080000);
      expect(revenue.min).toBe(0);
      expect(revenue.max).toBe(450000);
    }
    const region = agg['region'];
    expect(region.kind).toBe('categorical');
    if (region.kind === 'categorical') {
      expect(region.unique).toBe(2);
      expect(region.top.find((t) => t.value === 'Tokyo')?.count).toBe(3);
    }
  });
});

describe('excel-analyzer: chart recommendations', () => {
  it('picks bar for categorical×numeric, line for numeric×numeric', () => {
    const b64 = buildSampleXlsxBase64();
    const wb = loadWorkbook(b64);
    const agg = aggregateSheet(wb.Sheets['sales']);
    const charts = recommendCharts(agg);
    expect(charts.length).toBeGreaterThan(0);
    expect(charts[0].type).toBe('bar');
    expect(['region', 'product', 'month']).toContain(charts[0].xCol);
    expect(charts[0].yCol).toBe('revenue');
  });
});
