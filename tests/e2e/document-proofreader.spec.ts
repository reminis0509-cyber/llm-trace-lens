/**
 * document-proofreader.spec — /dashboard/tools/document-proofreader 回帰 pin
 * (AI Employee v2.1, 2026-04-21)
 *
 * 文章 textarea を入力 → AI が文体 (style) / チェックレベル (checkLevel) を
 * 参照して校正 → before / after の diff を描画するツール。backend 並行実装中
 * のため、`/api/agent/document-proofreader` が 404 の場合はモック fallback
 * で diff を描画する。
 *
 * ここで pin する内容:
 *   - β バッジ付き heading
 *   - textarea 入力可
 *   - style select (ビジネス / 学術 / カジュアル 等)
 *   - checkLevel select (軽め / 標準 / 厳密 等)
 *   - 実行ボタンは textarea 空で disabled
 *   - 実行 → diff UI (before / after 表示)
 *   - 「校正後の全文コピー」ボタン可視
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

test.describe('DocumentProofreader page (/dashboard/tools/document-proofreader)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/tools/document-proofreader');
  });

  test('heading "文書校正" is visible with β badge', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /文書校正|校正/, level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('β');
  });

  test('文章 textarea is visible and editable', async ({ page }) => {
    const textarea = page.getByLabel(/文章|原稿|text/i).first();
    await expect(textarea).toBeVisible();

    await textarea.fill('これは E2E テスト用の文章です。誤字があるかもしれない。');
    await expect(textarea).toHaveValue(/E2E/);
  });

  test('style and checkLevel selects are visible', async ({ page }) => {
    await expect(page.getByLabel(/文体|style/i).first()).toBeVisible();
    await expect(page.getByLabel(/チェックレベル|厳密度|checkLevel/i).first()).toBeVisible();
  });

  test('実行 button is disabled when textarea is empty', async ({ page }) => {
    const run = page.getByRole('button', { name: /校正|チェック実行|実行/ }).first();
    await expect(run).toBeVisible();
    await expect(run).toBeDisabled();
  });

  test('entering text enables 実行 button', async ({ page }) => {
    await page.getByLabel(/文章|原稿|text/i).first().fill('校正対象の文章です。');
    const run = page.getByRole('button', { name: /校正|チェック実行|実行/ }).first();
    await expect(run).toBeEnabled();
  });

  test('clicking 実行 renders before / after diff UI (mock fallback)', async ({ page }) => {
    await page.getByLabel(/文章|原稿|text/i).first().fill('E2E mock 校正文章');
    await page.getByRole('button', { name: /校正|チェック実行|実行/ }).first().click();

    // diff UI: before と after の heading が 2 つ並ぶ想定
    await expect(page.getByRole('heading', { name: /Before|修正前|原文/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /After|修正後|校正後/ })).toBeVisible({ timeout: 10_000 });
  });

  test('「校正後の全文コピー」 button is visible after execution', async ({ page }) => {
    await page.getByLabel(/文章|原稿|text/i).first().fill('コピー確認用');
    await page.getByRole('button', { name: /校正|チェック実行|実行/ }).first().click();

    await expect(
      page.getByRole('button', { name: /校正後の全文コピー|全文コピー/ }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('mock fallback badge appears after execution with no backend', async ({ page }) => {
    await page.getByLabel(/文章|原稿|text/i).first().fill('fallback proof');
    await page.getByRole('button', { name: /校正|チェック実行|実行/ }).first().click();

    await expect(
      page.getByRole('status').filter({ hasText: /サンプル出力|backend.*未接続/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
