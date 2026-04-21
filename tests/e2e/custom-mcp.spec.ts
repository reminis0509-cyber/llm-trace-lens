/**
 * custom-mcp.spec — /dashboard/settings/custom-mcp 回帰 pin
 * (AI Employee v2, 2026-04-20)
 *
 * カスタム MCP サーバー管理画面。MOCK_SERVERS 1件が描画され、追加モーダル
 * の name / url / authHeader フィールドが正しく表示されることを pin する。
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

test.describe('CustomMcpSettings page (/dashboard/settings/custom-mcp)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/settings/custom-mcp');
  });

  test('heading "カスタム MCP" is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'カスタム MCP', level: 1 })).toBeVisible();
  });

  test('shows "サンプルデータを表示中" badge when backend offline', async ({ page }) => {
    await expect(
      page.getByRole('status').filter({ hasText: 'サンプルデータを表示中' }),
    ).toBeVisible();
  });

  test('renders the MOCK_SERVERS mock row', async ({ page }) => {
    await expect(page.getByText('社内台帳 MCP').first()).toBeVisible();
    await expect(page.getByText('https://internal.example.com/mcp')).toBeVisible();
  });

  test('masked auth header preview is shown', async ({ page }) => {
    // MOCK_SERVERS[0].authHeaderPreview = 'Bearer ****abcd'
    await expect(page.getByText('Bearer ****abcd')).toBeVisible();
  });

  test('追加 button opens the modal with name/url/auth fields', async ({ page }) => {
    const cta = page.getByRole('button', { name: /追加/ }).first();
    await expect(cta).toBeVisible();
    await cta.click();

    const dialog = page.getByRole('dialog', { name: 'MCP サーバーを追加' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('名前')).toBeVisible();
    await expect(dialog.getByLabel('URL')).toBeVisible();
    await expect(dialog.getByLabel(/認証ヘッダ/)).toBeVisible();
  });

  test('auth header input is of type password (never echoed)', async ({ page }) => {
    await page.getByRole('button', { name: /追加/ }).first().click();
    const dialog = page.getByRole('dialog', { name: 'MCP サーバーを追加' });
    const authInput = dialog.getByLabel(/認証ヘッダ/);
    await expect(authInput).toHaveAttribute('type', 'password');
  });

  test('登録 enables only when name + url are filled', async ({ page }) => {
    await page.getByRole('button', { name: /追加/ }).first().click();
    const dialog = page.getByRole('dialog', { name: 'MCP サーバーを追加' });

    const submit = dialog.getByRole('button', { name: '登録' });
    await expect(submit).toBeDisabled();

    await dialog.getByLabel('名前').fill('E2E MCP');
    await dialog.getByLabel('URL').fill('https://example.com/mcp');
    await expect(submit).toBeEnabled();
  });
});
