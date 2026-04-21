/**
 * meeting-transcriber.spec — /dashboard/tools/meeting-transcriber 回帰 pin
 * (AI Employee v2.1, 2026-04-21)
 *
 * 音声ファイルをアップロード → Whisper 系 STT で文字起こし → AI が 6 セクション
 * の議事録 Markdown を生成するツール。backend 並行実装中のため、
 * `/api/agent/meeting-transcriber` が 404 の場合はモック fallback を発火させ、
 * 6 セクション (日時 / 参加者 / 議題 / 決定事項 / ToDo / 次回) の heading を
 * 描画することを pin する。
 *
 * ここで pin する内容:
 *   - β バッジ付き heading
 *   - 音声ファイル upload UI (input[type=file])
 *   - 言語 select (日本語 / 英語 / auto)
 *   - 実行ボタンは upload 前 disabled
 *   - 実行 → loading 表示 ("文字起こし中" or similar)
 *   - モック議事録の 6 セクション heading が描画されること
 */

import { test, expect } from '@playwright/test';
import { gotoAuthedDashboard, stubBackendAsOffline } from './fixtures/dashboard';

/**
 * モック音声: Playwright から setInputFiles で渡すため、実際の wav/mp3
 * バイナリは不要。最小限の buffer で audio/mpeg を偽装。UI 側が mimeType
 * を厳しくチェックするなら spec 側で緩めること。
 */
const MOCK_AUDIO = {
  name: 'meeting.mp3',
  mimeType: 'audio/mpeg',
  buffer: Buffer.from([0xff, 0xfb, 0x90, 0x00]),
};

const MINUTES_SECTIONS = ['日時', '参加者', '議題', '決定事項', 'ToDo', '次回'];

test.describe('MeetingTranscriber page (/dashboard/tools/meeting-transcriber)', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackendAsOffline(page);
    await gotoAuthedDashboard(page, '/dashboard/tools/meeting-transcriber');
  });

  test('heading "音声議事録" is visible with β badge', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /音声議事録|議事録/, level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('β');
  });

  test('audio file upload input is rendered', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();
  });

  test('言語 select has 3 options (日本語 / 英語 / auto)', async ({ page }) => {
    const langSelect = page.getByLabel(/言語|language/i).first();
    await expect(langSelect).toBeVisible();

    // HTML select options — check that all 3 values / labels are present
    await expect(langSelect.locator('option')).toContainText(['日本語']);
    await expect(langSelect.locator('option')).toContainText(['英語']);
    // auto は "auto" もしくは "自動" のいずれかを許容
    const opts = await langSelect.locator('option').allTextContents();
    expect(opts.some((t) => /auto|自動/i.test(t))).toBe(true);
  });

  test('実行 button is disabled before audio upload', async ({ page }) => {
    const run = page.getByRole('button', { name: /文字起こし|議事録生成|実行/ }).first();
    await expect(run).toBeVisible();
    await expect(run).toBeDisabled();
  });

  test('uploading audio enables the 実行 button', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(MOCK_AUDIO);

    const run = page.getByRole('button', { name: /文字起こし|議事録生成|実行/ }).first();
    await expect(run).toBeEnabled();
  });

  test('clicking 実行 shows a loading indicator', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(MOCK_AUDIO);

    await page.getByRole('button', { name: /文字起こし|議事録生成|実行/ }).first().click();

    // Loading state: either a disabled button, a status role, or a "生成中" label
    await expect(
      page.getByRole('status').or(page.getByText(/生成中|文字起こし中|処理中/)),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('mock fallback renders all 6 sections (日時 / 参加者 / 議題 / 決定事項 / ToDo / 次回)', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(MOCK_AUDIO);
    await page.getByRole('button', { name: /文字起こし|議事録生成|実行/ }).first().click();

    for (const label of MINUTES_SECTIONS) {
      await expect(
        page.getByRole('heading', { name: new RegExp(escapeRegExp(label)) }).first(),
      ).toBeVisible({ timeout: 15_000 });
    }
  });
});

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
