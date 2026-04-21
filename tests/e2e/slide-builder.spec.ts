/**
 * slide-builder.spec — /dashboard/tools/slide-builder 回帰 pin
 * (AI Employee v2.1, 2026-04-21)
 *
 * Web App Builder からの pivot。topic / audience / slideCount / style の
 * フォーム入力からスライド (Markdown / プレビュー / PPTX) を生成する β 機能。
 * backend 並行実装中のため、`/api/agent/slide-builder` が 404 の場合は
 * モック fallback で生成結果を描画する。
 *
 * ここで pin する内容:
 *   - β バッジ付き heading
 *   - 4 フォーム項目 (topic textarea + audience / slideCount / style)
 *   - 生成ボタンの disabled / enabled 遷移
 *   - 生成後に Markdown / プレビュー / PPTX の 3 タブが描画されること
 *   - mock fallback badge (サンプル出力を表示中) が表示されること
 *
 * TTS / 実 Marp レンダリングは v2.1 以降の Whisper 実 API 通しと合わせて
 * 追記する。
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

test.describe('SlideBuilder page (/dashboard/tools/slide-builder)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/tools/slide-builder');
  });

  test('heading "スライドビルダー" is visible with β badge', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /スライドビルダー/, level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('β');
  });

  test('topic textarea is visible', async ({ page }) => {
    const topic = page.getByLabel(/トピック|topic/i).first();
    await expect(topic).toBeVisible();
  });

  test('audience / slideCount / style selects are rendered', async ({ page }) => {
    await expect(page.getByLabel(/対象|audience/i).first()).toBeVisible();
    await expect(page.getByLabel(/スライド枚数|slideCount/i).first()).toBeVisible();
    await expect(page.getByLabel(/スタイル|style/i).first()).toBeVisible();
  });

  test('生成 button is disabled when topic is empty', async ({ page }) => {
    const generate = page.getByRole('button', { name: /生成|スライド作成/ }).first();
    await expect(generate).toBeVisible();
    await expect(generate).toBeDisabled();
  });

  test('entering a topic enables the 生成 button', async ({ page }) => {
    const topic = page.getByLabel(/トピック|topic/i).first();
    await topic.fill('2026 年の請求書電子化トレンド');

    const generate = page.getByRole('button', { name: /生成|スライド作成/ }).first();
    await expect(generate).toBeEnabled();
  });

  test('clicking 生成 renders 3 output tabs (Markdown / プレビュー / PPTX)', async ({ page }) => {
    await page.getByLabel(/トピック|topic/i).first().fill('E2E mock topic');
    await page.getByRole('button', { name: /生成|スライド作成/ }).first().click();

    await expect(page.getByRole('tab', { name: /Markdown/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: /プレビュー/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: /PPTX/i })).toBeVisible({ timeout: 10_000 });
  });

  test('mock fallback badge is shown after generation with no backend', async ({ page }) => {
    await page.getByLabel(/トピック|topic/i).first().fill('fallback slide');
    await page.getByRole('button', { name: /生成|スライド作成/ }).first().click();

    await expect(
      page.getByRole('status').filter({ hasText: /サンプル出力|backend.*未接続/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
