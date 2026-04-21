/**
 * excel-analyzer.spec — /dashboard/tools/excel-analyzer 回帰 pin
 * (AI Employee v2.1, 2026-04-21)
 *
 * Excel / CSV ファイルをアップロードし、自然言語で質問 → AI が
 * summary / insights / aggregations を返すツール。backend 並行実装中の
 * ため、`/api/agent/excel-analyzer` が 404 の場合はモック fallback で
 * 結果を描画する。
 *
 * ここで pin する内容:
 *   - β バッジ付き heading
 *   - ファイルアップロード UI (input[type=file])
 *   - 質問 textarea / input
 *   - 実行ボタンは「アップロード前は disabled」
 *   - アップロード + 質問入力後に enabled
 *   - 実行後に summary / insights / aggregations セクションが描画される
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

/**
 * Playwright は setInputFiles で name + mimeType + buffer を渡せるので、
 * ディスクに fixture を用意しない方針 (依存最小化)。CSV は plain text として
 * アップロードする。
 */
const MOCK_CSV = {
  name: 'sample.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from('date,amount\n2026-04-01,1000\n2026-04-02,2000\n', 'utf-8'),
};

test.describe('ExcelAnalyzer page (/dashboard/tools/excel-analyzer)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/tools/excel-analyzer');
  });

  test('heading "Excel分析" is visible with β badge', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /Excel分析|Excel 分析|エクセル分析/, level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('β');
  });

  test('file upload input is rendered', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();
  });

  test('question textarea / input is visible', async ({ page }) => {
    const question = page.getByLabel(/質問|問い合わせ/).first();
    await expect(question).toBeVisible();
  });

  test('実行 button is disabled before file upload', async ({ page }) => {
    const run = page.getByRole('button', { name: /実行|分析開始|分析する/ }).first();
    await expect(run).toBeVisible();
    await expect(run).toBeDisabled();
  });

  test('uploading a file + entering a question enables 実行', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(MOCK_CSV);

    await page.getByLabel(/質問|問い合わせ/).first().fill('合計金額を教えて');

    const run = page.getByRole('button', { name: /実行|分析開始|分析する/ }).first();
    await expect(run).toBeEnabled();
  });

  test('clicking 実行 renders summary / insights / aggregations sections (mock fallback)', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(MOCK_CSV);
    await page.getByLabel(/質問|問い合わせ/).first().fill('E2E mock question');
    await page.getByRole('button', { name: /実行|分析開始|分析する/ }).first().click();

    await expect(page.getByRole('heading', { name: /サマリ|要約|summary/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /インサイト|示唆|insights/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /集計|aggregations/i })).toBeVisible({ timeout: 10_000 });
  });

  test('mock fallback badge appears after execution with no backend', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(MOCK_CSV);
    await page.getByLabel(/質問|問い合わせ/).first().fill('mock');
    await page.getByRole('button', { name: /実行|分析開始|分析する/ }).first().click();

    await expect(
      page.getByRole('status').filter({ hasText: /サンプル出力|backend.*未接続/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
