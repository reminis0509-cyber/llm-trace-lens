/**
 * connector-v2.spec — /dashboard/settings/connectors v2 状態 pin
 * (AI Employee v2, 2026-04-20)
 *
 * v1 では Google Calendar / Gmail 以外は「近日対応」だったが、v2 で
 * Chatwork / Slack / freee / Google Drive / Notion / GitHub / LINE の
 * 7 種が有効化された (計 9 種)。本 spec は v2 の状態を pin する。
 *
 *  - 9 種全てのコネクタが item として描画されること
 *  - Chatwork / LINE は API キー型で、接続ボタン押下で API Key モーダルが
 *    開き password input が type=password であること
 *  - 近日対応 / 準備中 の disabled state は v2 では存在しないこと
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

test.describe('ConnectorSettings v2 (/dashboard/settings/connectors)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/settings/connectors');
  });

  test('page heading is コネクタ', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'コネクタ', level: 1 })).toBeVisible();
  });

  const allConnectors = [
    'Google Calendar',
    'Gmail',
    'Google Drive',
    'Slack',
    'Chatwork',
    'freee',
    'Notion',
    'GitHub',
    'LINE Messaging',
  ];

  for (const name of allConnectors) {
    test(`${name} is rendered with an enabled "接続する" button`, async ({ page }) => {
      const item = page.getByRole('listitem').filter({ hasText: name }).first();
      await expect(item).toBeVisible();

      const connect = item.getByRole('button', { name: `${name} を接続する` });
      await expect(connect).toBeVisible();
      await expect(connect).toBeEnabled();
      await expect(connect).toHaveText('接続する');
    });
  }

  test('v1 の「近日対応」/「準備中」バッジは v2 では描画されない', async ({ page }) => {
    await expect(page.getByText('近日対応')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /は近日対応予定/ })).toHaveCount(0);
  });

  test('API キー型は「API キー」バッジを表示する (Chatwork)', async ({ page }) => {
    const item = page.getByRole('listitem').filter({ hasText: 'Chatwork' }).first();
    await expect(item).toContainText('API キー');
  });

  test('API キー型は「API キー」バッジを表示する (LINE Messaging)', async ({ page }) => {
    const item = page.getByRole('listitem').filter({ hasText: 'LINE Messaging' }).first();
    await expect(item).toContainText('API キー');
  });

  test('Chatwork 接続ボタンで API Key モーダルが開く', async ({ page }) => {
    const item = page.getByRole('listitem').filter({ hasText: 'Chatwork' }).first();
    await item.getByRole('button', { name: 'Chatwork を接続する' }).click();

    const dialog = page.getByRole('dialog', { name: 'Chatwork を接続' });
    await expect(dialog).toBeVisible();

    const secret = dialog.getByLabel('API Token');
    await expect(secret).toBeVisible();
    await expect(secret).toHaveAttribute('type', 'password');
  });

  test('LINE Messaging 接続ボタンで API Key モーダルが開き label が Channel Access Token', async ({ page }) => {
    const item = page.getByRole('listitem').filter({ hasText: 'LINE Messaging' }).first();
    await item.getByRole('button', { name: 'LINE Messaging を接続する' }).click();

    const dialog = page.getByRole('dialog', { name: 'LINE Messaging を接続' });
    await expect(dialog).toBeVisible();

    const secret = dialog.getByLabel('Channel Access Token');
    await expect(secret).toBeVisible();
    await expect(secret).toHaveAttribute('type', 'password');
  });

  test('API Key モーダルで保存ボタンが initially disabled', async ({ page }) => {
    const item = page.getByRole('listitem').filter({ hasText: 'Chatwork' }).first();
    await item.getByRole('button', { name: 'Chatwork を接続する' }).click();

    const dialog = page.getByRole('dialog', { name: 'Chatwork を接続' });
    const save = dialog.getByRole('button', { name: /保存して接続/ });
    await expect(save).toBeDisabled();

    await dialog.getByLabel('API Token').fill('dummy-token-123');
    await expect(save).toBeEnabled();
  });
});
