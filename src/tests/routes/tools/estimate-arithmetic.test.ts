/**
 * Tests for the deterministic arithmetic verification exported by
 * src/routes/tools/estimate-check.ts (verifyArithmetic).
 *
 * QA M-2: verifyArithmetic is now exported from the route module, so this
 * file imports the real production implementation instead of duplicating it.
 */
import { describe, it, expect } from 'vitest';
import type { EstimateData } from '../../../types/ai-tools.js';
import { verifyArithmetic } from '../../../routes/tools/estimate-check.js';

function baseEstimate(overrides: Partial<EstimateData> = {}): EstimateData {
  return {
    estimate_number: '20260408-001',
    issue_date: '2026-04-08',
    valid_until: '2026-05-08',
    client: { company_name: 'テスト株式会社', honorific: '御中' },
    subject: 'Web システム開発',
    items: [
      {
        name: '要件定義',
        quantity: 10,
        unit: '人日',
        unit_price: 80000,
        tax_rate: 10,
        subtotal: 800000,
      },
      {
        name: '実装',
        quantity: 20,
        unit: '人日',
        unit_price: 80000,
        tax_rate: 10,
        subtotal: 1600000,
      },
    ],
    subtotal: 2400000,
    tax_amount: 240000,
    total: 2640000,
    ...overrides,
  };
}

describe('verifyArithmetic (estimate-check deterministic safety net)', () => {
  it('returns no issues for a correct estimate', () => {
    const issues = verifyArithmetic(baseEstimate());
    expect(issues).toEqual([]);
  });

  it('detects per-item subtotal mismatch', () => {
    const estimate = baseEstimate();
    estimate.items[0].subtotal = 700000; // wrong: should be 800000
    estimate.subtotal = 2300000;
    estimate.total = 2540000;
    estimate.tax_amount = 240000; // keep tax unchanged to isolate first error
    const issues = verifyArithmetic(estimate);
    const fields = issues.map((i) => i.field);
    expect(fields).toContain('items[0].subtotal');
  });

  it('detects overall subtotal mismatch', () => {
    const estimate = baseEstimate();
    estimate.subtotal = 2500000; // wrong
    estimate.total = 2740000;
    const issues = verifyArithmetic(estimate);
    expect(issues.some((i) => i.field === 'subtotal')).toBe(true);
  });

  it('detects tax amount mismatch beyond rounding tolerance', () => {
    const estimate = baseEstimate();
    estimate.tax_amount = 200000; // wrong: expected 240000
    estimate.total = 2600000;
    const issues = verifyArithmetic(estimate);
    expect(issues.some((i) => i.field === 'tax_amount')).toBe(true);
  });

  it('tolerates 1円 rounding difference on tax', () => {
    const estimate = baseEstimate();
    estimate.tax_amount = 240001; // 1円 off
    estimate.total = 2640001;
    const issues = verifyArithmetic(estimate);
    expect(issues.some((i) => i.field === 'tax_amount')).toBe(false);
  });

  it('detects total mismatch', () => {
    const estimate = baseEstimate();
    estimate.total = 2700000; // wrong: should be 2640000
    const issues = verifyArithmetic(estimate);
    expect(issues.some((i) => i.field === 'total')).toBe(true);
  });

  it('handles mixed tax rates (軽減税率 + 標準税率)', () => {
    const estimate = baseEstimate({
      items: [
        {
          name: '軽減税率品',
          quantity: 100,
          unit: '個',
          unit_price: 500,
          tax_rate: 8,
          subtotal: 50000,
        },
        {
          name: '標準税率品',
          quantity: 10,
          unit: '個',
          unit_price: 1000,
          tax_rate: 10,
          subtotal: 10000,
        },
      ],
      subtotal: 60000,
      tax_amount: 5000, // 50000*0.08 + 10000*0.10 = 4000 + 1000 = 5000
      total: 65000,
    });
    expect(verifyArithmetic(estimate)).toEqual([]);
  });

  it('flags simultaneous multiple errors in one pass', () => {
    const estimate = baseEstimate({
      items: [
        {
          name: 'バグ項目',
          quantity: 2,
          unit: '式',
          unit_price: 50000,
          tax_rate: 10,
          subtotal: 99999, // wrong (should be 100000)
        },
      ],
      subtotal: 100000, // doesn't match sumItems(99999)
      tax_amount: 9999,
      total: 109000, // doesn't match 100000+9999=109999
    });
    const issues = verifyArithmetic(estimate);
    const fields = issues.map((i) => i.field);
    expect(fields).toContain('items[0].subtotal');
    expect(fields).toContain('subtotal');
    expect(fields).toContain('total');
  });
});
