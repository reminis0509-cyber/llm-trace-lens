/**
 * connector-settings.spec — /dashboard/settings/connectors v1 smoke
 * (updated for AI Employee v2, 2026-04-20)
 *
 * v1 は 2 種有効 + 4 種「近日対応」だったが、v2 で 9 種全て有効化された。
 * 詳細な v2 状態 pin は `connector-v2.spec.ts` に移管。本 spec は v1 から
 * 引き続き有効な最小限の assertion (heading + Google Calendar/Gmail が
 * 接続可能) だけを残す。「近日対応」assertion は v2 で衝突するため削除。
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

test.describe('ConnectorSettings page (/dashboard/settings/connectors) — v1 smoke', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/settings/connectors');
  });

  test('Google Calendar shows "接続する" button (available)', async ({ page }) => {
    const item = page.getByRole('listitem').filter({ hasText: 'Google Calendar' }).first();
    await expect(item).toBeVisible();
    const connectBtn = item.getByRole('button', { name: 'Google Calendar を接続する' });
    await expect(connectBtn).toBeVisible();
    await expect(connectBtn).toBeEnabled();
    await expect(connectBtn).toHaveText('接続する');
  });

  test('Gmail shows "接続する" button (available)', async ({ page }) => {
    const item = page.getByRole('listitem').filter({ hasText: 'Gmail' }).first();
    await expect(item).toBeVisible();
    const connectBtn = item.getByRole('button', { name: 'Gmail を接続する' });
    await expect(connectBtn).toBeVisible();
    await expect(connectBtn).toBeEnabled();
    await expect(connectBtn).toHaveText('接続する');
  });

  test('page heading is コネクタ', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'コネクタ', level: 1 })).toBeVisible();
  });
});
