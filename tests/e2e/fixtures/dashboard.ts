/**
 * Dashboard auth fixture — Supabase セッションを偽装して Auth 画面を
 * 回避する helper 群 (AI Employee v1 E2E, 2026-04-20)
 *
 * Dashboard は `!user` のとき <Auth /> を表示するため、MorningBriefing /
 * TaskBoard / ConnectorSettings 等の認証必須ビューへ直接到達するには
 * page.goto() の前に Supabase セッションを page の状態に埋め込む必要が
 * ある。Supabase JS SDK は localStorage キー `sb-<ref>-auth-token` を
 * 読んでセッションを復元するので、ref=placeholder (dummy URL のサブ
 * ドメイン) でキーを合成する。
 *
 * 本番コードは一切 touch しない。あくまでテストランナーが操作する
 * `storageState` 相当の仕込みを spec 側から使うだけ。
 */

import type { Page, Route } from '@playwright/test';

const DASHBOARD_ORIGIN = 'http://127.0.0.1:5173';
const DASHBOARD_PREFIX = `${DASHBOARD_ORIGIN}/dashboard`;

/**
 * Supabase `VITE_SUPABASE_URL` が `https://placeholder.supabase.co` の
 * とき、SDK が参照する localStorage キーは `sb-placeholder-auth-token`。
 * Storage v2 のフォーマットを満たす最低限のペイロードを差し込む。
 */
const SUPABASE_SESSION_KEY = 'sb-placeholder-auth-token';

interface MockSessionPayload {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: {
    id: string;
    aud: string;
    role: string;
    email: string;
    email_confirmed_at: string;
    phone: string;
    confirmed_at: string;
    last_sign_in_at: string;
    app_metadata: Record<string, string>;
    user_metadata: Record<string, string>;
    identities: unknown[];
    created_at: string;
    updated_at: string;
  };
}

function buildMockSession(): MockSessionPayload {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    access_token: 'e2e-mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: nowSec + 3600,
    refresh_token: 'e2e-mock-refresh-token',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'qa@fujitrace.test',
      email_confirmed_at: new Date().toISOString(),
      phone: '',
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider: 'email' },
      user_metadata: {},
      identities: [],
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

/**
 * page.goto() 前に Supabase auth token を Dashboard origin の
 * localStorage に仕込み、Supabase の ネットワーク fetch は全て 200 空
 * レスポンスで intercept する。
 */
export async function installMockDashboardAuth(page: Page): Promise<void> {
  const session = buildMockSession();

  // Supabase SDK は auth/v1/* を叩いてセッションを検証する場合がある。
  // ネットワーク到達を完全にブロックして、SDK が localStorage のキャッシュ
  // のみで user を復元するようにする。
  await page.route('**/auth/v1/**', (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    });
  });

  // その他の Supabase REST 呼び出しも空で握りつぶす
  await page.route('**/placeholder.supabase.co/**', (route: Route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });

  // Dashboard の base URL に空ページをロードしてから localStorage を書き込む
  // (origin が確定しないと localStorage に書けない)
  await page.goto(`${DASHBOARD_PREFIX}/`, { waitUntil: 'domcontentloaded' }).catch(() => {
    // 初回ロードで Supabase エラー画面が出ても OK。localStorage を仕込む
    // ことが目的。
  });

  await page.evaluate(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    { key: SUPABASE_SESSION_KEY, value: JSON.stringify(session) },
  );
}

/**
 * 認証必須ページへ遷移する shortcut。Supabase セッション仕込み + route
 * intercept を適用してから page.goto() する。
 */
export async function gotoAuthedDashboard(
  page: Page,
  path: `/${string}`,
): Promise<void> {
  await installMockDashboardAuth(page);
  await page.goto(`${DASHBOARD_ORIGIN}${path}`, { waitUntil: 'domcontentloaded' });
}

/**
 * Dashboard が backend API にアクセスしたときに 404 を返させる。
 * MorningBriefing / TaskBoard は `/api/workspace/*` を叩くが、backend 不在
 * を擬似する fallback mock を発火させたいので 404 を返すのが正しい。
 */
export async function stubBackendAsOffline(page: Page): Promise<void> {
  await page.route('**/api/**', (route: Route) => {
    const url = route.request().url();
    // OAuth start や chatbot 等は unaffected な path が混ざる可能性があるが、
    // Dashboard v1 ビューからの呼び出しは /api/workspace/* と /api/agent/*
    // なので全部 404 で良い (fallback が発火する)。
    if (url.includes('/api/auth/oauth/')) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'e2e-offline-stub' }),
    });
  });
}

export const DASHBOARD_URL = {
  origin: DASHBOARD_ORIGIN,
  briefing: `${DASHBOARD_PREFIX}/briefing`,
  tasks: `${DASHBOARD_PREFIX}/tasks`,
  connectors: `${DASHBOARD_PREFIX}/settings/connectors`,
  root: `${DASHBOARD_PREFIX}/`,
  auth: `${DASHBOARD_PREFIX}/auth`,
};
