/**
 * taskboard.spec — /dashboard/tasks (TaskBoard) 回帰 pin
 * (AI Employee v1, 2026-04-20)
 *
 * 3 列 Kanban (昨日完了 / 今日実行 / 保留中) と mock データカード、
 * カードクリック時の alert() stub を pin する。
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

test.describe('TaskBoard page (/dashboard/tasks)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/tasks');
  });

  test('renders 3-column Kanban (昨日完了 / 今日実行 / 保留中)', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '昨日完了' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '今日実行' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '保留中' })).toBeVisible();
  });

  test('shows mock task cards when backend offline', async ({ page }) => {
    // MOCK_TASKS.tasks から各カラムに少なくとも 1 件入る
    const sampleTitles = [
      '株式会社サンプル商事 向け 見積書',
      '月次請求書 (4月分)',
      '発注書 (ベンダー様)',
      '納品書 (株式会社サンプル商事)',
      '送付状 (見積書添付用)',
      '請求書チェック (3月分)',
    ];

    for (const title of sampleTitles) {
      await expect(page.getByRole('button', { name: new RegExp(`${escapeRegExp(title)}.*の詳細を開く`) })).toBeVisible();
    }
  });

  test('clicking a card triggers an alert (Phase 2 stub)', async ({ page }) => {
    // 事前に dialog handler を登録
    let dialogMessage: string | null = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    const firstCard = page.getByRole('button', {
      name: /株式会社サンプル商事 向け 見積書.*の詳細を開く/,
    });
    await firstCard.click();

    await expect.poll(() => dialogMessage).not.toBeNull();
    expect(dialogMessage).toContain('株式会社サンプル商事 向け 見積書');
    expect(dialogMessage).toContain('ID:');
  });

  test('shows "サンプルデータを表示中" badge when backend offline', async ({ page }) => {
    await expect(
      page.getByRole('status').filter({ hasText: 'サンプルデータを表示中' }),
    ).toBeVisible();
  });
});

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
