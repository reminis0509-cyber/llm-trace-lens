/**
 * auth.spec — /dashboard ログイン画面 (Auth) 回帰 pin
 * (AI Employee v1, 2026-04-20)
 *
 * セッションを仕込まずに /dashboard/ を訪問した際に Auth 画面が表示され、
 * Google ログインボタンとメール/パスワードフォームが揃っていることを
 * 確認する。OAuth リダイレクト先の確認は skip (outbound redirect を
 * 許容しない)。
 */

import { test, expect } from '@playwright/test';

const DASHBOARD_URL = 'http://127.0.0.1:5173/dashboard/';

test.describe('Auth page (unauthenticated /dashboard)', () => {
  test.beforeEach(async ({ page }) => {
    // Supabase auth endpoint を握りつぶす。fresh context なので localStorage
    // は空 → supabase.auth.getSession() は session: null を返し、Auth 画面が
    // 描画される想定。もし token refresh 呼び出しが発生しても 200 空 body で
    // 止める。
    await page.route('**/auth/v1/**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: null, user: null }),
      });
    });
    await page.route('**/placeholder.supabase.co/**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      });
    });

    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
  });

  test('renders the auth card with FujiTrace logo and tutorial CTA', async ({ page }) => {
    await expect(page.getByAltText('FujiTrace')).toBeVisible();
    // チュートリアル誘導 (登録不要)
    const tutorialCta = page.getByRole('link', {
      name: /チュートリアルを試す（登録不要）/,
    });
    await expect(tutorialCta).toBeVisible();
    await expect(tutorialCta).toHaveAttribute('href', '/tutorial');
  });

  test('Google login button is present', async ({ page }) => {
    // button text "Googleで続行"
    const googleBtn = page.getByRole('button', { name: /Googleで続行/ });
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).toBeEnabled();
    // クリックすると supabase.auth.signInWithOAuth が走り外部 redirect が
    // 始まるので、ここでは存在確認までに留める (OAuth 到達は E2E 対象外)
  });

  test('email + password form is present', async ({ page }) => {
    const emailInput = page.getByRole('textbox', { name: 'メールアドレス' });
    const pwInput = page.locator('input[type="password"]');
    const submit = page.getByRole('button', { name: /ログイン|アカウント作成/ }).last();

    await expect(emailInput).toBeVisible();
    await expect(pwInput).toBeVisible();
    await expect(submit).toBeVisible();
  });

  test('toggle between ログイン and アカウント作成 mode', async ({ page }) => {
    // 初期は「アカウントにログイン」文面が表示される
    await expect(page.getByText('アカウントにログイン')).toBeVisible();

    // 「アカウント作成」ボタン (toggle) をクリック
    const toggle = page.getByRole('button', { name: 'アカウント作成' }).first();
    await toggle.click();
    await expect(page.getByText('新しいアカウントを作成')).toBeVisible();

    // 逆側 toggle で戻る
    const toggleBack = page.getByRole('button', { name: 'ログイン' }).first();
    await toggleBack.click();
    await expect(page.getByText('アカウントにログイン')).toBeVisible();
  });
});
