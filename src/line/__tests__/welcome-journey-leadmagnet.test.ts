/**
 * Unit tests for the Welcome Journey lead magnet message builder.
 *
 * 戦略 doc Section 18.2.K で定義された「LINE 友達追加時に PDF を自動送付」
 * 機能の本体は `buildLeadMagnetMessages` という純関数。実際の `pushLineMessage`
 * は `client.ts` 経由で副作用を持つため、ここでは構造だけを検証する。
 *
 * 検証スコープ:
 *   1. メッセージが 2 通(導入テキスト + Flex bubble)になっている
 *   2. テキスト本文にカピぶちょー関西弁が混入していない
 *      (Section 19.5 口調混在禁止ルール — Welcome 直後は AI レイヤーのみ)
 *   3. Flex bubble の URI Action のリンクが LEAD_MAGNET_PDF_URL を指している
 *   4. `buildLeadMagnetMessages(customUrl)` で URL を上書きできる
 *      (テスト容易性 + プレビュー環境対応)
 *   5. デフォルト URL がリポジトリ規約 (`/leadmagnet/oshigoto-ai-guide.pdf`) で
 *      終端する
 */
import { describe, it, expect } from 'vitest';
import {
  buildLeadMagnetMessages,
  LEAD_MAGNET_PDF_URL,
} from '../welcome-journey.js';

describe('buildLeadMagnetMessages — リード磁石 PDF 案内メッセージ構築', () => {
  it('returns exactly 2 messages: intro text + flex bubble', () => {
    const messages = buildLeadMagnetMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0].type).toBe('text');
    expect(messages[1].type).toBe('flex');
  });

  it('uses LEAD_MAGNET_PDF_URL as the default uri action target', () => {
    const messages = buildLeadMagnetMessages();
    const flex = messages[1] as Extract<typeof messages[1], { type: 'flex' }>;
    // Walk the flex container down to the button uri action.
    const bubble = flex.contents as {
      footer?: {
        contents?: Array<{
          action?: { type: string; uri?: string };
        }>;
      };
    };
    const action = bubble.footer?.contents?.[0]?.action;
    expect(action?.type).toBe('uri');
    expect(action?.uri).toBe(LEAD_MAGNET_PDF_URL);
  });

  it('honours a custom pdf url override', () => {
    const customUrl = 'https://preview.fujitrace.jp/leadmagnet/oshigoto-ai-guide.pdf';
    const messages = buildLeadMagnetMessages(customUrl);
    const flex = messages[1] as Extract<typeof messages[1], { type: 'flex' }>;
    const bubble = flex.contents as {
      footer?: {
        contents?: Array<{ action?: { type: string; uri?: string } }>;
      };
    };
    expect(bubble.footer?.contents?.[0]?.action?.uri).toBe(customUrl);
  });

  it('intro text contains no Kansai-dialect tokens (Section 19.5 口調混在禁止)', () => {
    const messages = buildLeadMagnetMessages();
    const intro = messages[0] as Extract<typeof messages[0], { type: 'text' }>;
    // Welcome step 1 直後の AI レイヤー側メッセージなので関西弁は禁止。
    // カピぶちょー一言は別の push (`generateCapiBuchoComment`) かフキダシで
    // 補う設計だが、`startWelcomeJourney` 経由では PDF メッセージに混入させない。
    expect(intro.text).not.toMatch(/まいど〜?|ええやんか|せやな|お疲れさん〜|ちゃうちゃう/);
  });

  it('intro text mentions the PDF download CTA explicitly', () => {
    const messages = buildLeadMagnetMessages();
    const intro = messages[0] as Extract<typeof messages[0], { type: 'text' }>;
    expect(intro.text).toMatch(/PDF/);
    expect(intro.text).toMatch(/ボタン/);
  });

  it('flex bubble has a primary CTA button labelled "ガイドを開く"', () => {
    const messages = buildLeadMagnetMessages();
    const flex = messages[1] as Extract<typeof messages[1], { type: 'flex' }>;
    const bubble = flex.contents as {
      footer?: {
        contents?: Array<{
          style?: string;
          action?: { type: string; label?: string };
        }>;
      };
    };
    const btn = bubble.footer?.contents?.[0];
    expect(btn?.style).toBe('primary');
    expect(btn?.action?.label).toBe('ガイドを開く');
  });

  it('flex altText conveys what the bubble is (notification panel + chat list)', () => {
    const messages = buildLeadMagnetMessages();
    const flex = messages[1] as Extract<typeof messages[1], { type: 'flex' }>;
    expect(flex.altText).toContain('AI活用ガイド');
  });
});

describe('LEAD_MAGNET_PDF_URL — デフォルト URL の規約準拠', () => {
  it('ends with /leadmagnet/oshigoto-ai-guide.pdf', () => {
    expect(LEAD_MAGNET_PDF_URL.endsWith('/leadmagnet/oshigoto-ai-guide.pdf')).toBe(
      true,
    );
  });

  it('is an absolute https URL even when BASE_URL is "/" (vitest internal default)', () => {
    // Vite/vitest sets process.env.BASE_URL = '/' as part of its build base
    // resolution. The implementation MUST ignore that and fall back to the
    // production default so LINE Flex bubbles always link to a real domain.
    expect(LEAD_MAGNET_PDF_URL).toMatch(/^https:\/\//);
  });
});
