/**
 * nav-v2.spec — Dashboard v2 navigation (main 5 + その他 dropdown + pill subnav)
 * (AI Employee v2, 2026-04-20)
 *
 * v1 の nav.spec は 7 main tabs を前提にしていたが、v2 で構造が変わった:
 *   - Main tabs (5): ブリーフィング / AI社員 / プロジェクト / タスク / トレース
 *   - Secondary dropdown (その他): ツール / 教材 / チーム / 設定
 *   - Subnav pills:
 *       tasks    → ボード / 実行中 / 定期
 *       tools    → ワイド リサーチ / Web App Builder (β)
 *       settings → LLMキー / 一般 / コネクタ / カスタムMCP / APIキー
 *
 * この spec は各ラベルの visibility + 切替時の pageerror 無し + 404 相当
 * にならないことを pin。各画面の中身は個別の spec (projects / schedule /
 * running / research / custom-mcp / api-keys / web-app-builder) が担保。
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

const MAIN_TABS = [
  'ブリーフィング',
  'AI社員',
  'プロジェクト',
  'タスク',
  'トレース',
];

const SECONDARY_TABS = ['ツール', '教材', 'チーム', '設定'];

test.describe('Dashboard v2 top navigation', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/');
  });

  test('all 5 main tabs are visible in header', async ({ page }) => {
    const nav = page.locator('header nav').first();
    await expect(nav).toBeVisible();

    for (const label of MAIN_TABS) {
      const btn = nav.getByRole('button', { name: new RegExp(escapeRegExp(label)) }).first();
      await expect(btn).toBeVisible();
    }
  });

  test('"その他" secondary dropdown opens and lists 4 items', async ({ page }) => {
    const nav = page.locator('header nav').first();
    const dropdown = nav.getByRole('button', { name: /その他/ });
    await dropdown.click();

    for (const label of SECONDARY_TABS) {
      // secondary items render as buttons inside the popover panel
      await expect(
        page.getByRole('button', { name: new RegExp(escapeRegExp(label)) }).first(),
      ).toBeVisible();
    }
  });

  test('each main tab is clickable without pageerror', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const nav = page.locator('header nav').first();
    for (const label of MAIN_TABS) {
      const btn = nav.getByRole('button', { name: new RegExp(escapeRegExp(label)) }).first();
      await btn.click();
      // Header should still be present after switching (no 404 / full crash)
      await expect(page.locator('header nav').first()).toBeVisible();
    }

    expect(errors, `Page errors: ${errors.join('\n')}`).toEqual([]);
  });

  test('タスク tab exposes 3 pill sub-views (ボード / 実行中 / 定期)', async ({ page }) => {
    const nav = page.locator('header nav').first();
    await nav.getByRole('button', { name: /タスク/ }).first().click();

    await expect(page.getByRole('button', { name: 'ボード', pressed: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '実行中' })).toBeVisible();
    await expect(page.getByRole('button', { name: '定期' })).toBeVisible();
  });

  test('ツール tab exposes 2 pill sub-views (ワイド リサーチ / Web App Builder (β))', async ({ page }) => {
    const nav = page.locator('header nav').first();
    await nav.getByRole('button', { name: /その他/ }).click();
    await page.getByRole('button', { name: /ツール/ }).first().click();

    await expect(page.getByRole('button', { name: 'ワイド リサーチ', pressed: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Web App Builder \(β\)/ })).toBeVisible();
  });

  test('設定 tab exposes 5 pill sub-views (LLMキー / 一般 / コネクタ / カスタムMCP / APIキー)', async ({ page }) => {
    const nav = page.locator('header nav').first();
    await nav.getByRole('button', { name: /その他/ }).click();
    await page.getByRole('button', { name: /設定/ }).first().click();

    await expect(page.getByRole('button', { name: 'LLMキー', pressed: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '一般' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'コネクタ' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'カスタムMCP' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'APIキー' })).toBeVisible();
  });

  test('header logo svg is always visible', async ({ page }) => {
    const svg = page.locator('header svg').first();
    await expect(svg).toBeVisible();
  });
});

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
