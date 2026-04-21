/**
 * research.spec — /dashboard/research (WideResearch) 回帰 pin
 * (AI Employee v2, 2026-04-20)
 *
 * ワイドリサーチのクエリ入力 + データソース選択 + 起動。backend 不在時は
 * simulated progress → mock Markdown report を fallback で描画する。
 * SSE stub 構築のコストが高いので、ここでは mock fallback 経路のみ pin。
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

test.describe('WideResearch page (/dashboard/research)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/research');
  });

  test('heading "ワイド リサーチ" is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'ワイド リサーチ', level: 1 })).toBeVisible();
  });

  test('query textarea and data source toggles are rendered', async ({ page }) => {
    const textarea = page.getByPlaceholder(/建設業界の請求書電子化/);
    await expect(textarea).toBeVisible();

    // 3 source pills: Web / 社内ドキュメント / 過去タスク
    await expect(page.getByRole('button', { name: 'Web', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '社内ドキュメント' })).toBeVisible();
    await expect(page.getByRole('button', { name: '過去タスク' })).toBeVisible();
  });

  test('調査開始 button is disabled when query is empty', async ({ page }) => {
    const start = page.getByRole('button', { name: /調査開始/ });
    await expect(start).toBeVisible();
    await expect(start).toBeDisabled();
  });

  test('entering a query enables 調査開始', async ({ page }) => {
    const textarea = page.getByPlaceholder(/建設業界の請求書電子化/);
    await textarea.fill('E2E テスト用クエリ');

    const start = page.getByRole('button', { name: /調査開始/ });
    await expect(start).toBeEnabled();
  });

  test('toggling a data source changes aria-pressed state', async ({ page }) => {
    const internal = page.getByRole('button', { name: '社内ドキュメント' });
    await expect(internal).toHaveAttribute('aria-pressed', 'false');
    await internal.click();
    await expect(internal).toHaveAttribute('aria-pressed', 'true');
  });

  test('launching research shows 進捗 section (mock fallback)', async ({ page }) => {
    await page.getByPlaceholder(/建設業界の請求書電子化/).fill('mock query');
    await page.getByRole('button', { name: /調査開始/ }).click();

    // 進捗 heading が現れる (running state)
    await expect(page.getByRole('heading', { name: '進捗' })).toBeVisible({ timeout: 10_000 });
  });

  test('mock fallback eventually surfaces a レポート heading', async ({ page }) => {
    await page.getByPlaceholder(/建設業界の請求書電子化/).fill('fallback report');
    await page.getByRole('button', { name: /調査開始/ }).click();

    // mock が 5 ステップ × ~450ms を消化した後に report 表示
    await expect(page.getByRole('heading', { name: 'レポート' })).toBeVisible({ timeout: 15_000 });
  });
});
