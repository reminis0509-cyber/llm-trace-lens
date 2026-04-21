/**
 * rebrand.spec — 「AI事務員」→「AI社員」リブランド回帰 pin
 * (AI Employee v1, 2026-04-20)
 *
 * Landing (/) と Dashboard (/dashboard/briefing) のページテキストに
 * 旧称「AI事務員」が残っていないこと、及び 新称「AI社員」が主要な
 * 導線コピー (Hero / 最終 CTA / Dashboard tab label) で生きている
 * ことを pin する。v2 で誤って旧称を復活させた時に落とすための
 * regression net。
 */

import { test, expect } from '@playwright/test';
import {
  DASHBOARD_URL,
  gotoAuthedDashboard,
  stubBackendAsOffline,
} from './fixtures/dashboard';

test.describe('rebrand: AI社員 naming is consistent', () => {
  test('landing page does not contain 旧称 AI事務員 anywhere', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('AI事務員');
  });

  test('landing hero and final CTA both mention AI社員', async ({ page }) => {
    await page.goto('/');

    // Hero の H1 は「AI社員、雇いませんか。」(改行あり)
    const hero = page.locator('h1').first();
    await expect(hero).toBeVisible();
    await expect(hero).toContainText('AI社員');

    // 最終 CTA (#contact) の H2 も「AI社員、雇いませんか。」
    const finalCtaHeading = page.locator('#contact h2');
    await expect(finalCtaHeading).toBeVisible();
    await expect(finalCtaHeading).toContainText('AI社員');
  });

  test('dashboard briefing view does not contain 旧称 AI事務員', async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/briefing');

    // ブリーフィング本文が描画されるまで待つ
    await expect(page.getByRole('heading', { name: /ブリーフィング|今日の予定|おはよう|こんにちは|おつかれさま/ })).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('AI事務員');
  });

  test('dashboard briefing CTA button shows AI社員', async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/briefing');

    // 「AI社員に仕事を任せる」CTA ボタン
    const cta = page.getByRole('button', { name: /AI社員に仕事を任せる/ });
    await expect(cta).toBeVisible();
  });

  test('dashboard navigation exposes AI社員 tab', async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/');

    // AI社員 tab ボタン (xl viewport 以上でラベル表示、1440 viewport なら可視)
    const aiClerkTab = page.getByRole('button', { name: /AI社員/ }).first();
    await expect(aiClerkTab).toBeVisible();
  });
});

// Dashboard auth 画面など、特定のユーザー依存パスで「AI事務員」が残って
// いないかを軽く pin (visit 時にリダイレクトが入っても dashboard 配下の
// テキスト全体で禁止語とする)
test.describe('rebrand: fallback surfaces', () => {
  test('dashboard root does not contain 旧称 AI事務員', async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/');
    await expect(page.locator('body')).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('AI事務員');
    // URL も確認
    expect(page.url()).toContain(DASHBOARD_URL.origin);
  });
});
