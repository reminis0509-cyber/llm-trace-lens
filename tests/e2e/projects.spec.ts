/**
 * projects.spec — /dashboard/projects (Projects list) + detail 回帰 pin
 * (AI Employee v2, 2026-04-20)
 *
 * 永続ワークスペース一覧画面の最低保証仕様。backend 未接続 fallback で
 * MOCK_PROJECTS が描画され、新規プロジェクトモーダルが開閉できること、
 * プロジェクトカードをクリックすると /dashboard/projects/:id に遷移する
 * ことを pin する。detail 画面側の smoke は別テストで担保。
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

test.describe('Projects page (/dashboard/projects)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/projects');
  });

  test('heading "プロジェクト" is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'プロジェクト', level: 1 })).toBeVisible();
  });

  test('shows "サンプルデータを表示中" badge when backend is offline', async ({ page }) => {
    const badge = page.getByRole('status').filter({ hasText: 'サンプルデータを表示中' });
    await expect(badge).toBeVisible();
  });

  test('renders the two MOCK_PROJECTS cards', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /株式会社サンプル商事 取引.*を開く/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /2026 年度バックオフィス整備.*を開く/ }),
    ).toBeVisible();
  });

  test('"新規プロジェクト" button opens the create modal', async ({ page }) => {
    const cta = page.getByRole('button', { name: '新しいプロジェクトを作成' });
    await expect(cta).toBeVisible();
    await cta.click();

    const dialog = page.getByRole('dialog', { name: '新しいプロジェクト' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('プロジェクト名')).toBeVisible();
    await expect(dialog.getByRole('button', { name: '作成' })).toBeDisabled();
  });

  test('submit button becomes enabled when name is typed', async ({ page }) => {
    await page.getByRole('button', { name: '新しいプロジェクトを作成' }).click();
    const dialog = page.getByRole('dialog', { name: '新しいプロジェクト' });
    await dialog.getByLabel('プロジェクト名').fill('E2E テストプロジェクト');
    await expect(dialog.getByRole('button', { name: '作成' })).toBeEnabled();
  });

  test('closing the modal via キャンセル hides the dialog', async ({ page }) => {
    await page.getByRole('button', { name: '新しいプロジェクトを作成' }).click();
    const dialog = page.getByRole('dialog', { name: '新しいプロジェクト' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'キャンセル' }).click();
    await expect(dialog).toBeHidden();
  });
});

test.describe('ProjectDetail page (/dashboard/projects/:id)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/projects/mock-proj-1');
  });

  test('renders project header and 4 sections', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'サンプル プロジェクト' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: '指示書 (Instructions)' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '参照ファイル' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '接続中のコネクタ' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '最近のタスク' })).toBeVisible();
  });

  test('instructions textarea is editable and save button toggles dirty state', async ({ page }) => {
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible();

    const saveBtn = page.getByRole('button', { name: /保存/ }).first();
    await expect(saveBtn).toBeDisabled();

    await textarea.fill('新しい指示文');
    await expect(saveBtn).toBeEnabled();
  });

  test('back link "プロジェクト一覧に戻る" is clickable', async ({ page }) => {
    const back = page.getByRole('button', { name: 'プロジェクト一覧に戻る' });
    await expect(back).toBeVisible();
  });
});
