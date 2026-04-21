/**
 * Playwright config — FujiTrace E2E harness (2026-04-20)
 *
 * 初期スコープは v1 機能 (AI Employee v1) の回帰防止 pin。backend server
 * とDBは起動しない。Dashboard / Landing の Vite dev server のみ起動して
 * UI表面をテストする。認証や backend API は page.route() で mock する方針
 * (tests/e2e/fixtures 参照)。
 *
 * 注意:
 * - Dashboard は Vite base '/dashboard/' で配信されるため base URL は
 *   Landing 側 (http://127.0.0.1:5174) を採用。Dashboard 画面への遷移は
 *   絶対パス http://127.0.0.1:5173/dashboard/... を spec 側で指定する。
 * - webServer は localhost ではなく 127.0.0.1 バインドを明示。CLAUDE.md
 *   project memo に記載の Chrome MCP tips と整合。
 * - env.VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY は Supabase 初期化を
 *   成立させる dummy 値。ネットワーク層は page.route で stub される。
 */

import { defineConfig, devices } from '@playwright/test';

const DASHBOARD_PORT = 5173;
const LANDING_PORT = 5174;

/** Dummy Supabase credentials — placeholder.supabase.co は page.route で intercept */
const DUMMY_SUPABASE_ENV = {
  VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'placeholder-anon-key',
};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://127.0.0.1:${LANDING_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm --prefix packages/dashboard run dev -- --host 127.0.0.1',
      url: `http://127.0.0.1:${DASHBOARD_PORT}/dashboard/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: { ...DUMMY_SUPABASE_ENV },
    },
    {
      command: 'npm --prefix packages/landing run dev -- --host 127.0.0.1',
      url: `http://127.0.0.1:${LANDING_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
