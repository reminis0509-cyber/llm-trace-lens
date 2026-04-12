import { describe, it, expect } from 'vitest';
import { checkArithmetic } from '../../tools/arithmetic-checker.js';
import type { ExtractedFinancialData } from '../../tools/arithmetic-checker.js';

describe('checkArithmetic', () => {
  it('returns ok for correct invoice', () => {
    const data: ExtractedFinancialData = {
      items: [
        { name: 'デザイン費', quantity: 1, unit_price: 500000, amount: 500000 },
        { name: '開発費', quantity: 1, unit_price: 100000, amount: 100000 },
      ],
      subtotal: 600000,
      tax_rate: 0.10,
      tax_amount: 60000,
      total: 660000,
      has_financial_data: true,
    };

    const result = checkArithmetic(data);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('detects wrong tax amount (55000 instead of 60000)', () => {
    const data: ExtractedFinancialData = {
      items: [
        { name: 'デザイン費', quantity: 1, unit_price: 500000, amount: 500000 },
        { name: '開発費', quantity: 1, unit_price: 100000, amount: 100000 },
      ],
      subtotal: 600000,
      tax_rate: 0.10,
      tax_amount: 55000,
      total: 655000,
      has_financial_data: true,
    };

    const result = checkArithmetic(data);
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.field === 'tax_amount')).toBe(true);
  });

  it('detects item amount mismatch (quantity * unit_price != amount)', () => {
    const data: ExtractedFinancialData = {
      items: [
        { name: 'コンサル費', quantity: 3, unit_price: 100000, amount: 250000 }, // should be 300000
      ],
      subtotal: 250000,
      tax_rate: 0.10,
      tax_amount: 25000,
      total: 275000,
      has_financial_data: true,
    };

    const result = checkArithmetic(data);
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.field === 'items[0].amount')).toBe(true);
  });

  it('detects subtotal mismatch', () => {
    const data: ExtractedFinancialData = {
      items: [
        { name: 'A', quantity: 1, unit_price: 100000, amount: 100000 },
        { name: 'B', quantity: 1, unit_price: 200000, amount: 200000 },
      ],
      subtotal: 250000, // should be 300000
      tax_rate: 0.10,
      tax_amount: 25000,
      total: 275000,
      has_financial_data: true,
    };

    const result = checkArithmetic(data);
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.field === 'subtotal')).toBe(true);
  });

  it('detects total mismatch', () => {
    const data: ExtractedFinancialData = {
      items: [
        { name: 'A', quantity: 1, unit_price: 100000, amount: 100000 },
      ],
      subtotal: 100000,
      tax_rate: 0.10,
      tax_amount: 10000,
      total: 120000, // should be 110000
      has_financial_data: true,
    };

    const result = checkArithmetic(data);
    expect(result.ok).toBe(false);
    expect(result.issues.some(i => i.field === 'total')).toBe(true);
  });

  it('handles reduced tax rate (8%)', () => {
    const data: ExtractedFinancialData = {
      items: [
        { name: '食品', quantity: 10, unit_price: 1000, amount: 10000 },
      ],
      subtotal: 10000,
      tax_rate: 0.08,
      tax_amount: 800,
      total: 10800,
      has_financial_data: true,
    };

    const result = checkArithmetic(data);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('handles tax_rate as percentage (10 instead of 0.10)', () => {
    const data: ExtractedFinancialData = {
      items: [
        { name: 'サービス', quantity: 1, unit_price: 50000, amount: 50000 },
      ],
      subtotal: 50000,
      tax_rate: 10,
      tax_amount: 5000,
      total: 55000,
      has_financial_data: true,
    };

    const result = checkArithmetic(data);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('skips check when has_financial_data is false', () => {
    const data: ExtractedFinancialData = {
      items: [],
      subtotal: 0,
      tax_rate: 0,
      tax_amount: 0,
      total: 0,
      has_financial_data: false,
    };

    const result = checkArithmetic(data);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('allows ±1 yen tolerance on tax rounding', () => {
    // 33333 * 0.10 = 3333.3, floor = 3333
    const data: ExtractedFinancialData = {
      items: [
        { name: 'A', quantity: 1, unit_price: 33333, amount: 33333 },
      ],
      subtotal: 33333,
      tax_rate: 0.10,
      tax_amount: 3334, // floor is 3333, but within ±1 tolerance
      total: 36667,
      has_financial_data: true,
    };

    const result = checkArithmetic(data);
    expect(result.ok).toBe(true);
  });

  it('detects multiple issues simultaneously', () => {
    const data: ExtractedFinancialData = {
      items: [
        { name: 'A', quantity: 2, unit_price: 100000, amount: 150000 }, // wrong
        { name: 'B', quantity: 1, unit_price: 50000, amount: 50000 },
      ],
      subtotal: 200000, // item sum is 200000 (150000+50000), matches
      tax_rate: 0.10,
      tax_amount: 15000, // wrong (should be 20000)
      total: 215000,
      has_financial_data: true,
    };

    const result = checkArithmetic(data);
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
    expect(result.issues.some(i => i.field === 'items[0].amount')).toBe(true);
    expect(result.issues.some(i => i.field === 'tax_amount')).toBe(true);
  });
});
