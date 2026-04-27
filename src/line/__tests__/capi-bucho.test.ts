/**
 * Unit tests for the カピぶちょー(関西弁の上司カピバラ)layer.
 *
 * 戦略 doc Section 7.3 / 19.5 で確定した「2 キャラ並走モデル」のうち、
 * カピぶちょー側 LLM 別呼び出しの境界条件を検証する。
 *
 * 検証スコープ:
 *   1. shouldStaySilent — AI 応答が空 / エラー定型文 / 短すぎる時は黙る。
 *   2. hasEmotionTrigger — 感情語の検出が部分一致で動く。
 *   3. shouldComment — journey 中は確率を無視して必ず喋る。
 *                       感情語ありなら必ず喋る。それ以外は確率次第。
 *   4. tidyReply — 過剰行 / 引用符 / 文字数オーバーを整形する。
 *   5. SYSTEM_PROMPT — 標準語禁止 / 業務文章生成禁止が含まれている。
 *   6. EMOTION_KEYWORDS — 主要な感情語が登録されている。
 *
 * 注: `generateCapiBuchoComment` のフルパス(OpenAI fetch)はここでは
 *      テストせず、純関数を `__test__` 経由で個別に検証する。
 *      OpenAI モックは LINE 配信パスの結合テストで担当する想定。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  __test__,
  generateCapiBuchoCommentWithMeta,
} from '../capi-bucho.js';
import type { FastifyInstance } from 'fastify';

const {
  shouldStaySilent,
  hasEmotionTrigger,
  shouldComment,
  tidyReply,
  EMOTION_KEYWORDS,
  AI_ERROR_PREFIXES,
  MIN_AI_RESPONSE_LENGTH,
  CAPI_BUCHO_SYSTEM_PROMPT,
} = __test__;

describe('shouldStaySilent — AI 応答が黙るべき形か判定', () => {
  it('returns true when AI response is empty', () => {
    expect(
      shouldStaySilent({ userMessage: 'こんにちは', aiResponse: '' }),
    ).toBe(true);
  });

  it('returns true when AI response is whitespace-only', () => {
    expect(
      shouldStaySilent({ userMessage: 'こんにちは', aiResponse: '   \n  ' }),
    ).toBe(true);
  });

  it('returns true when AI response starts with the error prefix', () => {
    const error = '申し訳ありません、AIの応答を取得できませんでした。';
    expect(error.startsWith(AI_ERROR_PREFIXES[0])).toBe(true);
    expect(
      shouldStaySilent({ userMessage: 'a', aiResponse: error }),
    ).toBe(true);
  });

  it('returns true when AI response is shorter than MIN length', () => {
    const short = 'はい'.repeat(2); // 4 chars, well below threshold
    expect(short.length).toBeLessThan(MIN_AI_RESPONSE_LENGTH);
    expect(
      shouldStaySilent({ userMessage: 'a', aiResponse: short }),
    ).toBe(true);
  });

  it('returns false for a normal non-error AI response', () => {
    const normal =
      'お役に立てて何よりです。次の作業もぜひお手伝いさせてください。';
    expect(normal.length).toBeGreaterThanOrEqual(MIN_AI_RESPONSE_LENGTH);
    expect(
      shouldStaySilent({ userMessage: 'a', aiResponse: normal }),
    ).toBe(false);
  });
});

describe('hasEmotionTrigger — 感情語の部分一致検出', () => {
  it('detects 疲れ family (疲れた / 疲れる / お疲れ)', () => {
    expect(hasEmotionTrigger('今日は会議が3つで疲れた')).toBe(true);
    expect(hasEmotionTrigger('お疲れさまです')).toBe(true);
  });

  it('detects 困っ / 悩 / しんど', () => {
    expect(hasEmotionTrigger('英文メールで困っています')).toBe(true);
    expect(hasEmotionTrigger('予算で悩んでいる')).toBe(true);
    expect(hasEmotionTrigger('しんどいなあ')).toBe(true);
  });

  it('detects positive emotion (ありがとう / 嬉し / やった)', () => {
    expect(hasEmotionTrigger('ありがとう、助かりました')).toBe(true);
    expect(hasEmotionTrigger('嬉しいです')).toBe(true);
    expect(hasEmotionTrigger('やった、できた!')).toBe(true);
  });

  it('returns false for neutral business prompts', () => {
    expect(hasEmotionTrigger('見積書を作成してください')).toBe(false);
    expect(hasEmotionTrigger('明日の会議のアジェンダ')).toBe(false);
  });

  it('returns false for empty / whitespace input', () => {
    expect(hasEmotionTrigger('')).toBe(false);
    expect(hasEmotionTrigger('   ')).toBe(false);
  });
});

describe('shouldComment — 喋るかの最終判定', () => {
  // Random 抽選を決定論化するためのヘルパー。
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // 確率しきい値 (0.3) を超える
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when AI response is silent-worthy regardless of journey', () => {
    expect(
      shouldComment({
        userMessage: '疲れた',
        aiResponse: '',
        journeyStep: 1,
      }),
    ).toBe(false);
  });

  it('always comments during journey (ignoring random / emotion)', () => {
    expect(
      shouldComment({
        userMessage: '見積書を作成してください',
        aiResponse:
          '承知しました。見積書のチェックは次の3点を確認します。金額・支払条件・押印箇所。',
        journeyStep: 2,
      }),
    ).toBe(true);
  });

  it('always comments when an emotion keyword is present', () => {
    expect(
      shouldComment({
        userMessage: '今日は本当に疲れた',
        aiResponse:
          'お疲れさまです。今日のうちにできるところまでで十分です。明日に回しても大丈夫です。',
      }),
    ).toBe(true);
  });

  it('skips comment by random when no emotion and not journey', () => {
    // Math.random returns 0.99 → above the 0.3 threshold → skip.
    expect(
      shouldComment({
        userMessage: '見積書を作成してください',
        aiResponse:
          '承知しました。見積書のドラフトを作成します。宛先と金額を教えてください。',
      }),
    ).toBe(false);
  });

  it('comments when random falls inside the probability window', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.3
    expect(
      shouldComment({
        userMessage: '見積書を作成してください',
        aiResponse:
          '承知しました。見積書のドラフトを作成します。宛先と金額を教えてください。',
      }),
    ).toBe(true);
  });
});

describe('tidyReply — 出力整形', () => {
  it('returns null for empty / whitespace input', () => {
    expect(tidyReply(null)).toBeNull();
    expect(tidyReply(undefined)).toBeNull();
    expect(tidyReply('')).toBeNull();
    expect(tidyReply('   ')).toBeNull();
  });

  it('strips surrounding 「」quotes', () => {
    expect(tidyReply('「まいど〜、ええ感じやで〜」')).toBe(
      'まいど〜、ええ感じやで〜',
    );
  });

  it('strips surrounding ASCII double quotes', () => {
    expect(tidyReply('"お疲れさん〜"')).toBe('お疲れさん〜');
  });

  it('caps to 3 lines', () => {
    const input = ['1行目', '2行目', '3行目', '4行目', '5行目'].join('\n');
    const out = tidyReply(input);
    expect(out).toBe('1行目\n2行目\n3行目');
  });

  it('returns trimmed text under the char cap as-is', () => {
    expect(tidyReply('  まいど〜、ええ感じやで〜  ')).toBe(
      'まいど〜、ええ感じやで〜',
    );
  });
});

describe('SYSTEM_PROMPT — 規約準拠', () => {
  it('declares 関西弁 as the only allowed style', () => {
    expect(CAPI_BUCHO_SYSTEM_PROMPT).toMatch(/関西弁/);
    expect(CAPI_BUCHO_SYSTEM_PROMPT).toMatch(/うち/);
  });

  it('forbids generating business writing (戦略 Section 19.5 例外条項)', () => {
    expect(CAPI_BUCHO_SYSTEM_PROMPT).toMatch(/メール本文|書類本文/);
    expect(CAPI_BUCHO_SYSTEM_PROMPT).toMatch(/生成しない|書かない/);
  });

  it('explicitly forbids long standard-Japanese output', () => {
    expect(CAPI_BUCHO_SYSTEM_PROMPT).toMatch(/標準語/);
  });

  it('caps reply length to keep AI as the lead', () => {
    expect(CAPI_BUCHO_SYSTEM_PROMPT).toMatch(/1[〜~-]3行|脇役/);
  });
});

describe('EMOTION_KEYWORDS — 必須語彙', () => {
  it.each([
    ['疲れ'],
    ['困っ'],
    ['ありがとう'],
    ['助か'],
    ['嬉し'],
    ['しんど'],
  ])('contains key emotion word: %s', (kw) => {
    expect(EMOTION_KEYWORDS).toContain(kw);
  });
});

// =============================================================================
// generateCapiBuchoCommentWithMeta — Web 用 API のラッパー (Section 18.2.L)
// =============================================================================
//
// `generateCapiBuchoComment` (LINE 既存) と同じ generateCapiBuchoCore を呼ぶ
// が、戻り値が `{ comment, tokensUsed }` 形式になっている点だけ違う。
// fetch をモックして「shouldComment が false → 早期 return」「LLM 失敗 →
// null/null」「LLM 成功 → comment + tokens」の 3 ケースを検証する。

const fakeFastify = {
  log: { warn: () => {}, error: () => {} },
} as unknown as FastifyInstance;

describe('generateCapiBuchoCommentWithMeta — Web 用ラッパー', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test-mock';
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns { comment: null, tokensUsed: null } when shouldComment says no', async () => {
    // Empty AI response → shouldStaySilent=true → shouldComment=false → no LLM call
    const result = await generateCapiBuchoCommentWithMeta(fakeFastify, 'ws-1', {
      userMessage: 'こんにちは',
      aiResponse: '',
    });
    expect(result).toEqual({ comment: null, tokensUsed: null });
  });

  it('returns { comment: null, tokensUsed: null } when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await generateCapiBuchoCommentWithMeta(fakeFastify, 'ws-1', {
      userMessage: '今日は本当に疲れた',
      aiResponse:
        'お疲れさまです。十分頑張ったので、今日のうちにできるところまでで十分です。',
    });
    expect(result).toEqual({ comment: null, tokensUsed: null });
  });

  it('returns { comment, tokensUsed } when the LLM call succeeds', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: 'お疲れさん〜。ええ感じやで〜☺' } },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 24 },
      }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await generateCapiBuchoCommentWithMeta(fakeFastify, 'ws-1', {
      userMessage: '今日は本当に疲れた', // emotion keyword → shouldComment=true
      aiResponse:
        'お疲れさまです。十分頑張ったので、今日のうちにできるところまでで十分です。',
    });

    expect(result.comment).toBe('お疲れさん〜。ええ感じやで〜☺');
    expect(result.tokensUsed).toBe(144); // 120 + 24
    expect(mockFetch).toHaveBeenCalledOnce();
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('returns { comment: null, tokensUsed: null } when LLM responds non-2xx', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'internal server error',
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await generateCapiBuchoCommentWithMeta(fakeFastify, 'ws-1', {
      userMessage: '今日は本当に疲れた',
      aiResponse:
        'お疲れさまです。十分頑張ったので、今日のうちにできるところまでで十分です。',
    });

    expect(result).toEqual({ comment: null, tokensUsed: null });
  });

  it('returns { comment: null, tokensUsed: null } when fetch throws', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network down'));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await generateCapiBuchoCommentWithMeta(fakeFastify, 'ws-1', {
      userMessage: '今日は本当に疲れた',
      aiResponse:
        'お疲れさまです。十分頑張ったので、今日のうちにできるところまでで十分です。',
    });

    expect(result).toEqual({ comment: null, tokensUsed: null });
  });
});
