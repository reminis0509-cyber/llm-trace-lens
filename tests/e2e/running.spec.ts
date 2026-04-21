/**
 * running.spec — /dashboard/running (ConcurrentTaskBoard) 回帰 pin
 * (AI Employee v2, 2026-04-20)
 *
 * 並列実行ビュー: メトリクス4枚、実行中セクション、待機中、直近完了の
 * 描画を pin。backend 未接続 fallback (MOCK_STATUS + MOCK_TASKS) 前提。
 * 5秒 polling は stub 下でも走り続けるので setInterval の挙動は alert で
 * 検証せず、初期描画の整合性のみ確認する。
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

test.describe('ConcurrentTaskBoard page (/dashboard/running)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/running');
  });

  test('heading "並列実行ビュー" is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '並列実行ビュー', level: 1 })).toBeVisible();
  });

  test('renders 4 metric cards (実行中 / 待機中 / 直近完了 / 同時実行上限)', async ({ page }) => {
    await expect(page.getByText('実行中', { exact: true })).toBeVisible();
    await expect(page.getByText('待機中', { exact: true })).toBeVisible();
    await expect(page.getByText('直近完了', { exact: true })).toBeVisible();
    await expect(page.getByText('同時実行上限', { exact: true })).toBeVisible();
  });

  test('shows "サンプルデータを表示中" badge when backend is offline', async ({ page }) => {
    await expect(
      page.getByRole('status').filter({ hasText: 'サンプルデータを表示中' }),
    ).toBeVisible();
  });

  test('renders running section with at least one mock task', async ({ page }) => {
    const runningHeading = page.getByRole('heading', { name: /実行中 \(\d+\)/ });
    await expect(runningHeading).toBeVisible();

    // MOCK_TASKS contains a running task "請求書チェック (4月分)"
    await expect(page.getByText('請求書チェック (4月分)').first()).toBeVisible();
  });

  test('renders queued section', async ({ page }) => {
    const queuedHeading = page.getByRole('heading', { name: /待機中 \(\d+\)/ });
    await expect(queuedHeading).toBeVisible();
  });

  test('renders recently finished section with completed mock', async ({ page }) => {
    const doneHeading = page.getByRole('heading', { name: /直近完了 \(\d+\)/ });
    await expect(doneHeading).toBeVisible();
    await expect(page.getByText('発注書作成 完了').first()).toBeVisible();
  });

  test('progressbar renders with valid ARIA attributes for running task', async ({ page }) => {
    const bar = page.getByRole('progressbar').first();
    await expect(bar).toBeVisible();
    const now = await bar.getAttribute('aria-valuenow');
    expect(Number(now)).toBeGreaterThanOrEqual(0);
    expect(Number(now)).toBeLessThanOrEqual(100);
  });
});
