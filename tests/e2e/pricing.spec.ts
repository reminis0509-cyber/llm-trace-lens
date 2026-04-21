/**
 * pricing.spec — Landing #pricing 5 プラン表示 pin
 * (AI Employee v1, 2026-04-20)
 *
 * CFO pricing copy (docs/pricing-copy-2026-04-20.md) に準じた 5 プラン
 * 表示を pin する。プラン名・月額・バッジの表記揺れを落とす net。
 *
 * 監視対象:
 *   - Free / Pro / Team / Max / Enterprise の 5 プランが表示される
 *   - Team と Enterprise に「新登場」バッジが付く
 *   - 各プランの月額 (¥0 / ¥3,000 / ¥6,000/seat / ¥15,000 / ¥50,000〜)
 */

import { test, expect } from '@playwright/test';

test.describe('landing pricing section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // #pricing へスクロール (lazy effect 避け)
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await expect(page.locator('#pricing')).toBeVisible();
  });

  test('renders all 5 plans (Free / Pro / Team / Max / Enterprise)', async ({ page }) => {
    const pricing = page.locator('#pricing');

    // 5 プラン名が pricing セクション内に表示される
    for (const planName of ['Free', 'Pro', 'Team', 'Max', 'Enterprise']) {
      await expect(pricing.getByRole('heading', { level: 3, name: planName })).toBeVisible();
    }
  });

  test('Team plan shows the 新登場 badge', async ({ page }) => {
    const pricing = page.locator('#pricing');
    const teamCard = pricing.locator('div', { hasText: 'Team' }).filter({ hasText: '新登場' }).first();
    await expect(teamCard).toBeVisible();
    await expect(teamCard).toContainText('新登場');
  });

  test('Enterprise plan shows the 新登場 badge', async ({ page }) => {
    const pricing = page.locator('#pricing');
    const enterpriseCard = pricing
      .locator('div', { hasText: 'Enterprise' })
      .filter({ hasText: '新登場' })
      .first();
    await expect(enterpriseCard).toBeVisible();
    await expect(enterpriseCard).toContainText('新登場');
  });

  test('displays correct monthly price for each plan', async ({ page }) => {
    const pricing = page.locator('#pricing');

    // 価格は巨大フォント (<span>) に単独で描画されるので、span 単位で
    // 厳密マッチする。innerText 部分一致だと ¥600,000 が ¥6,000 と
    // 誤ヒットするため避ける。
    const priceSpans = pricing.locator('span.text-3xl');
    await expect(priceSpans).toHaveCount(5);

    const prices = await priceSpans.allInnerTexts();
    const normalized = prices.map((p) => p.trim());
    expect(normalized).toEqual([
      '\u00A50',
      '\u00A53,000',
      '\u00A56,000',
      '\u00A515,000',
      '\u00A550,000\u301C', // 〜 (U+301C)
    ]);
  });

  test('Team plan note includes /席/月 pricing unit', async ({ page }) => {
    const pricing = page.locator('#pricing');
    const teamCard = pricing.locator('div').filter({ hasText: 'Team' }).filter({ hasText: '席' }).first();
    await expect(teamCard).toContainText('席');
  });

  test('Enterprise plan shows 年次契約 subnote on its card', async ({ page }) => {
    const pricing = page.locator('#pricing');
    // priceSubnote は p.text-xs で描画される。Enterprise card 内の
    // 「個別見積／年次契約」を厳密に pin する。
    const enterpriseSubnote = pricing
      .locator('div.surface-card')
      .filter({ hasText: 'Enterprise' })
      .locator('p', { hasText: '年次契約' })
      .first();
    await expect(enterpriseSubnote).toBeVisible();
    await expect(enterpriseSubnote).toContainText('個別見積');
  });

  test('Pro plan CTA links to /dashboard', async ({ page }) => {
    const pricing = page.locator('#pricing');
    // Pro は 'highlighted' かつ CTA テキスト「Pro にアップグレード」
    const proCta = pricing.getByRole('link', { name: /Pro にアップグレード/ });
    await expect(proCta).toBeVisible();
    await expect(proCta).toHaveAttribute('href', '/dashboard');
  });
});
