/**
 * Programmatic arithmetic checker for document verification.
 *
 * Validates financial calculations deterministically (100% accurate)
 * instead of relying on LLM arithmetic reasoning.
 *
 * Supports:
 *   - Line item: amount === quantity * unit_price
 *   - Subtotal: sum of all item amounts
 *   - Tax: floor(subtotal * tax_rate), supports 10% and 8% (reduced rate)
 *   - Total: subtotal + tax
 */

export interface ExtractedItem {
  name: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface ExtractedFinancialData {
  items: ExtractedItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  has_financial_data: boolean;
}

export interface ArithmeticIssue {
  field: string;
  severity: 'error';
  message: string;
}

export interface ArithmeticCheckResult {
  ok: boolean;
  issues: ArithmeticIssue[];
}

/**
 * Run deterministic arithmetic verification on extracted financial data.
 *
 * Returns `{ ok: true, issues: [] }` when all calculations match,
 * or `{ ok: false, issues: [...] }` with specific mismatches.
 */
export function checkArithmetic(data: ExtractedFinancialData): ArithmeticCheckResult {
  if (!data.has_financial_data || !data.items || data.items.length === 0) {
    return { ok: true, issues: [] };
  }

  const issues: ArithmeticIssue[] = [];

  // 1. Per-item: amount === quantity * unit_price
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    const expected = Math.round(item.quantity * item.unit_price);
    if (expected !== item.amount) {
      issues.push({
        field: `items[${i}].amount`,
        severity: 'error',
        message: `項目「${item.name}」の金額が一致しません。${item.quantity} × ¥${item.unit_price.toLocaleString()} = ¥${expected.toLocaleString()} ですが、¥${item.amount.toLocaleString()} と記載されています`,
      });
    }
  }

  // 2. Subtotal === sum of item amounts
  const sumItems = data.items.reduce((acc, it) => acc + it.amount, 0);
  if (sumItems !== data.subtotal) {
    issues.push({
      field: 'subtotal',
      severity: 'error',
      message: `小計が一致しません。明細合計 ¥${sumItems.toLocaleString()} ですが、¥${data.subtotal.toLocaleString()} と記載されています`,
    });
  }

  // 3. Tax === floor(subtotal * tax_rate)
  // tax_rate can be a decimal (0.10) or percentage (10)
  const rate = data.tax_rate > 1 ? data.tax_rate / 100 : data.tax_rate;
  const expectedTax = Math.floor(data.subtotal * rate);
  if (Math.abs(expectedTax - data.tax_amount) > 1) {
    issues.push({
      field: 'tax_amount',
      severity: 'error',
      message: `消費税額が一致しません。小計 ¥${data.subtotal.toLocaleString()} × ${(rate * 100).toFixed(0)}% = ¥${expectedTax.toLocaleString()} ですが、¥${data.tax_amount.toLocaleString()} と記載されています`,
    });
  }

  // 4. Total === subtotal + tax_amount
  const expectedTotal = data.subtotal + data.tax_amount;
  if (expectedTotal !== data.total) {
    issues.push({
      field: 'total',
      severity: 'error',
      message: `合計金額が一致しません。小計 ¥${data.subtotal.toLocaleString()} + 消費税 ¥${data.tax_amount.toLocaleString()} = ¥${expectedTotal.toLocaleString()} ですが、¥${data.total.toLocaleString()} と記載されています`,
    });
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
