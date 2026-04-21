/**
 * web-app-builder.spec — /dashboard/tools/web-app-builder 回帰 pin
 * (AI Employee v2, 2026-04-20)
 *
 * β バッジ、β 警告 note、spec textarea、生成ボタン、mock fallback で生成結果
 * Markdown が描画されることを pin する。
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

test.describe('WebAppBuilder page (/dashboard/tools/web-app-builder)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/tools/web-app-builder');
  });

  test('heading includes "Web App Builder" with β badge', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /Web App Builder/, level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('β');
  });

  test('shows the β 警告 note about セキュリティ・テスト方針', async ({ page }) => {
    await expect(page.getByRole('note')).toBeVisible();
    await expect(page.getByRole('note')).toContainText(/β 機能/);
  });

  test('spec textarea + スキャフォールド生成 button are rendered', async ({ page }) => {
    const textarea = page.getByPlaceholder(/顧客管理ツール/);
    await expect(textarea).toBeVisible();

    const generate = page.getByRole('button', { name: /スキャフォールド生成/ });
    await expect(generate).toBeVisible();
    await expect(generate).toBeDisabled();
  });

  test('entering a spec enables the generate button', async ({ page }) => {
    const textarea = page.getByPlaceholder(/顧客管理ツール/);
    await textarea.fill('E2E テスト用 spec');
    await expect(page.getByRole('button', { name: /スキャフォールド生成/ })).toBeEnabled();
  });

  test('clicking generate produces a 生成結果 section (mock fallback)', async ({ page }) => {
    await page.getByPlaceholder(/顧客管理ツール/).fill('顧客管理ツール demo');
    await page.getByRole('button', { name: /スキャフォールド生成/ }).click();

    await expect(page.getByRole('heading', { name: '生成結果' })).toBeVisible({ timeout: 10_000 });
  });

  test('mock fallback badge is shown after generation with no backend', async ({ page }) => {
    await page.getByPlaceholder(/顧客管理ツール/).fill('mock');
    await page.getByRole('button', { name: /スキャフォールド生成/ }).click();

    await expect(
      page.getByRole('status').filter({ hasText: 'サンプル出力を表示中' }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
