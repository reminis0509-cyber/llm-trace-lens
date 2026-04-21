/**
 * api-keys.spec — /dashboard/settings/api-keys (FujiTraceApiKeys) 回帰 pin
 * (AI Employee v2, 2026-04-20)
 *
 * FujiTrace 自身の API key 発行画面。MOCK_KEYS 1件の一覧と、新規発行モーダル、
 * 発行直後に出る平文キー + コピーボタン + curl 例を pin する。
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

test.describe('FujiTraceApiKeys page (/dashboard/settings/api-keys)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/settings/api-keys');
  });

  test('heading "FujiTrace API キー" is visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'FujiTrace API キー', level: 1 }),
    ).toBeVisible();
  });

  test('shows "サンプルデータを表示中" badge when backend is offline', async ({ page }) => {
    await expect(
      page.getByRole('status').filter({ hasText: 'サンプルデータを表示中' }),
    ).toBeVisible();
  });

  test('MOCK_KEYS preview is masked (ft_****1a2b)', async ({ page }) => {
    await expect(page.getByText('本番サーバー').first()).toBeVisible();
    await expect(page.getByText('ft_****1a2b')).toBeVisible();
  });

  test('新規発行 button opens the create modal', async ({ page }) => {
    const cta = page.getByRole('button', { name: /新規発行/ }).first();
    await expect(cta).toBeVisible();
    await cta.click();

    const dialog = page.getByRole('dialog', { name: 'API キーを発行' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('キー名')).toBeVisible();
  });

  test('発行 button enables only when name is provided', async ({ page }) => {
    await page.getByRole('button', { name: /新規発行/ }).first().click();
    const dialog = page.getByRole('dialog', { name: 'API キーを発行' });
    const submit = dialog.getByRole('button', { name: '発行' });
    await expect(submit).toBeDisabled();
    await dialog.getByLabel('キー名').fill('E2E テストキー');
    await expect(submit).toBeEnabled();
  });

  test('issuing a key surfaces the plaintext + copy button + curl example (mock)', async ({ page }) => {
    await page.getByRole('button', { name: /新規発行/ }).first().click();
    const createDialog = page.getByRole('dialog', { name: 'API キーを発行' });
    await createDialog.getByLabel('キー名').fill('E2E 一時キー');
    await createDialog.getByRole('button', { name: '発行' }).click();

    // Post-issue dialog opens with plaintext visible
    const issuedDialog = page.getByRole('dialog', { name: 'API キーを発行しました' });
    await expect(issuedDialog).toBeVisible();

    // 平文キー (mock の場合は ft_ 始まり)
    await expect(issuedDialog.getByText(/ft_[a-z0-9]+/)).toBeVisible();

    // コピー button + curl 例
    await expect(issuedDialog.getByRole('button', { name: 'API キーをコピー' })).toBeVisible();
    await expect(issuedDialog.locator('pre')).toContainText('curl');
    await expect(issuedDialog.locator('pre')).toContainText('Authorization');
  });

  test('warning banner mentions 今回のみ表示', async ({ page }) => {
    await page.getByRole('button', { name: /新規発行/ }).first().click();
    const createDialog = page.getByRole('dialog', { name: 'API キーを発行' });
    await createDialog.getByLabel('キー名').fill('one-time');
    await createDialog.getByRole('button', { name: '発行' }).click();

    const issuedDialog = page.getByRole('dialog', { name: 'API キーを発行しました' });
    await expect(issuedDialog.getByText(/今回のみ表示/)).toBeVisible();
  });
});
