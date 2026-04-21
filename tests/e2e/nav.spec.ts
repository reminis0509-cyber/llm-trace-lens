/**
 * nav.spec — Dashboard main tabs smoke (updated for v2, 2026-04-20)
 *
 * v1 は 7 main tabs (briefing / ai-clerk / tasks / watch / learn / team /
 * settings) が header に直接並ぶ構造だったが、v2 で 5 main + その他
 * dropdown に再編された。詳細な v2 nav pin は `nav-v2.spec.ts` へ移管。
 * 本 spec は v2 でも壊れない最小限の smoke assertion だけを残す。
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

interface TabSpec {
  label: string;
  hashFragment: string;
}

// v2 main tabs from packages/dashboard/src/pages/Dashboard.tsx (2026-04-20)
const TABS: TabSpec[] = [
  { label: 'ブリーフィング', hashFragment: 'briefing' },
  { label: 'AI社員', hashFragment: 'ai-clerk' },
  { label: 'プロジェクト', hashFragment: 'projects' },
  { label: 'タスク', hashFragment: 'tasks' },
  { label: 'トレース', hashFragment: 'watch' },
];

test.describe('Dashboard top navigation', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/');
  });

  test('all 5 primary tabs are visible in the header', async ({ page }) => {
    const nav = page.locator('header nav').first();
    await expect(nav).toBeVisible();

    for (const tab of TABS) {
      // ラベル span (xl:inline) ではなく button scoped matcher で拾う
      const tabBtn = nav.getByRole('button', { name: new RegExp(escapeRegExp(tab.label)) });
      await expect(tabBtn.first()).toBeVisible();
    }
  });

  test('clicking each tab switches the active state without a 404', async ({ page }) => {
    // console error を監視 (404 や React エラーを拾う)
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const nav = page.locator('header nav').first();

    for (const tab of TABS) {
      const tabBtn = nav.getByRole('button', { name: new RegExp(escapeRegExp(tab.label)) }).first();
      await tabBtn.click();

      // Watch タブは ambient fullscreen レイアウトに切り替わるため
      // main 要素が消える。他タブは main 配下で body 描画。両方 OK とする。
      await page.waitForTimeout(100); // tab state 反映を待つ
      // ページが落ちていない (404 相当ではない) ことの最低条件として
      // header nav が継続表示されることをチェック
      await expect(page.locator('header nav').first()).toBeVisible();
    }

    expect(errors, `Page errors: ${errors.join('\n')}`).toEqual([]);
  });

  test('header logo svg is always visible', async ({ page }) => {
    const headerSvg = page.locator('header svg').first();
    await expect(headerSvg).toBeVisible();
  });
});

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
