/**
 * briefing.spec — /dashboard/briefing (MorningBriefing) 回帰 pin
 * (AI Employee v1, 2026-04-20)
 *
 * 朝のブリーフィング画面の最低保証仕様。backend 未接続 fallback mock が
 * 発火することと、3 セクション + CTA が描画されることを確認する。
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

test.describe('MorningBriefing page (/dashboard/briefing)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/briefing');
  });

  test('shows a time-of-day greeting (おはよう / こんにちは / おつかれさま)', async ({ page }) => {
    // Page.timezone = Asia/Tokyo (config), system clock 依存で 3 種のどれか
    const greetingLocator = page.locator('h1').filter({
      hasText: /おはようございます|こんにちは|おつかれさまです/,
    });
    await expect(greetingLocator).toBeVisible();
  });

  test('renders 3 sections: 今日の予定 / 昨日完了したタスク / 保留中のタスク', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '今日の予定' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '昨日完了したタスク' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '保留中のタスク' })).toBeVisible();
  });

  test('CTA button "AI社員に仕事を任せる" is clickable', async ({ page }) => {
    const cta = page.getByRole('button', { name: /AI社員に仕事を任せる/ });
    await expect(cta).toBeVisible();
    await expect(cta).toBeEnabled();
    await cta.click();
    // ハッシュが更新され、AI社員タブへ切り替わる
    await expect.poll(() => page.url()).toContain('ai-clerk');
  });

  test('shows "サンプルデータを表示中" badge when backend is offline', async ({ page }) => {
    const mockBadge = page.getByRole('status').filter({ hasText: 'サンプルデータを表示中' });
    await expect(mockBadge).toBeVisible();
  });

  test('calendar is offline: shows Google Calendar connect CTA', async ({ page }) => {
    // MOCK_BRIEFING.calendarConnected === false なので接続 CTA が出る
    const connectBtn = page.getByRole('button', {
      name: /Google Calendar を接続する設定画面に移動/,
    });
    await expect(connectBtn).toBeVisible();
  });
});
