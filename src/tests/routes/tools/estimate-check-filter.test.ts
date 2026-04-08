/**
 * Tests for filterArithmeticHallucinations — ensures the deterministic
 * verifyArithmetic result is the source of truth for calculation fields,
 * stripping any LLM-reported "calc mismatch" critical_issues that the local
 * checker did not flag.
 */
import { describe, it, expect } from 'vitest';
import { filterArithmeticHallucinations } from '../../../routes/tools/estimate-check.js';

interface Issue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

describe('filterArithmeticHallucinations', () => {
  it('drops LLM arithmetic claims when local checker is silent', () => {
    const llm: Issue[] = [
      { field: 'tax_amount', severity: 'error', message: '計算が合いません' },
      { field: 'total', severity: 'error', message: '合計が違います' },
    ];
    const result = filterArithmeticHallucinations(llm, new Set<string>());
    expect(result).toEqual([]);
  });

  it('keeps LLM arithmetic claims that the local checker also flagged', () => {
    const llm: Issue[] = [
      { field: 'tax_amount', severity: 'error', message: '計算が合いません' },
    ];
    const result = filterArithmeticHallucinations(llm, new Set(['tax_amount']));
    expect(result).toHaveLength(1);
  });

  it('keeps non-arithmetic critical issues untouched', () => {
    const llm: Issue[] = [
      { field: 'invoice_number', severity: 'error', message: 'インボイス番号がありません' },
      { field: 'client.company_name', severity: 'error', message: '宛先が空' },
    ];
    const result = filterArithmeticHallucinations(llm, new Set<string>());
    expect(result).toHaveLength(2);
  });

  it('handles items[<n>].subtotal pattern', () => {
    const llm: Issue[] = [
      { field: 'items[0].subtotal', severity: 'error', message: '項目1が違う' },
      { field: 'items[1].subtotal', severity: 'error', message: '項目2が違う' },
    ];
    const result = filterArithmeticHallucinations(llm, new Set(['items[1].subtotal']));
    expect(result).toHaveLength(1);
    expect(result[0].field).toBe('items[1].subtotal');
  });

  it('tolerates issues without a field property', () => {
    const llm: Issue[] = [
      { field: '', severity: 'error', message: '何か変です' },
    ];
    const result = filterArithmeticHallucinations(llm, new Set<string>());
    expect(result).toHaveLength(1);
  });
});
