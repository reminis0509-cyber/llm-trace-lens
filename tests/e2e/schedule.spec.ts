/**
 * schedule.spec — /dashboard/schedule (ScheduleManager) 回帰 pin
 * (AI Employee v2, 2026-04-20)
 *
 * 定期タスク管理画面。MOCK_SCHEDULE が描画され、新規モーダルでプリセット
 * 選択と custom cron 入力が切り替わることを pin する。backend 未接続
 * fallback 前提。
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

test.describe('ScheduleManager page (/dashboard/schedule)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/schedule');
  });

  test('heading "定期タスク" is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '定期タスク', level: 1 })).toBeVisible();
  });

  test('shows "サンプルデータを表示中" badge when backend is offline', async ({ page }) => {
    await expect(
      page.getByRole('status').filter({ hasText: 'サンプルデータを表示中' }),
    ).toBeVisible();
  });

  test('renders MOCK_SCHEDULE rows (朝のブリーフィング + 月次請求書 発行)', async ({ page }) => {
    await expect(page.getByText('朝のブリーフィング').first()).toBeVisible();
    await expect(page.getByText('月次請求書 発行').first()).toBeVisible();
  });

  test('disabled task shows "無効" pill', async ({ page }) => {
    // MOCK_SCHEDULE[1] enabled=false
    await expect(page.getByText('無効').first()).toBeVisible();
  });

  test('opening the create modal shows name/kind/preset fields', async ({ page }) => {
    const cta = page.getByRole('button', { name: '新しい定期タスクを追加' });
    await expect(cta).toBeVisible();
    await cta.click();

    const dialog = page.getByRole('dialog', { name: '定期タスクを追加' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('名前')).toBeVisible();
    await expect(dialog.getByLabel('タスク種別')).toBeVisible();
    await expect(dialog.getByLabel('スケジュール')).toBeVisible();
  });

  test('selecting "カスタム (raw cron)" reveals cron input', async ({ page }) => {
    await page.getByRole('button', { name: '新しい定期タスクを追加' }).click();
    const dialog = page.getByRole('dialog', { name: '定期タスクを追加' });

    await dialog.getByLabel('スケジュール').selectOption({ label: 'カスタム (raw cron)' });
    await expect(dialog.getByLabel(/cron 式/)).toBeVisible();
  });

  test('登録 button enables only when name + cron filled', async ({ page }) => {
    await page.getByRole('button', { name: '新しい定期タスクを追加' }).click();
    const dialog = page.getByRole('dialog', { name: '定期タスクを追加' });

    const submit = dialog.getByRole('button', { name: '登録' });
    await expect(submit).toBeDisabled();

    await dialog.getByLabel('名前').fill('E2E 定期タスク');
    // preset 初期値 weekday-9am は cron=0 9 * * 1-5 がデフォで入るので有効化される
    await expect(submit).toBeEnabled();
  });
});
