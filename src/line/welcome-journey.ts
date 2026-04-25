/**
 * Welcome Journey — 初回 3 ステップ オンレール導線 (Phase A1, 2026-04-25)
 *
 * AI を初めて触る LINE ユーザーに「3 メッセージ以内で『便利』と感じて
 * もらう」ことを成功条件とする Gateway AI 戦略の中核 UX。Friend 追加
 * 直後に固定スクリプトで 3 つの体験(画像→説明 / 困りごと相談 / 雑談)
 * を順番に通させ、最後に Web 版 fujitrace.jp に自然誘導する。
 *
 * 状態:
 *   - KV キー: `line:journey:{lineUserId}` →
 *               { step: 1 | 2 | 3, startedAt: epoch_ms }
 *   - TTL    : 24 時間 (深夜 Friend 追加 → 翌朝続きを許容)
 *   - KV 不在: 全関数が no-op に倒れ、event-handler 側の journey 判定は
 *              常に「inactive」になり通常チャットへ素通し。デモ環境で
 *              Welcome Journey 機能が無効になるだけで他は壊れない設計。
 *
 * フロー:
 *   - follow              → startWelcomeJourney() → step=1, 案内テキスト
 *   - text/image (step=1) → OCR or テキスト応答 + step2 プロンプト
 *   - text       (step=2) → 困りごとに対する短い助言 + step3 プロンプト
 *   - text       (step=3) → 共感応答 + 完了文 + fujitrace.jp 誘導 → clear
 *
 * 完了 or KV TTL 切れ後は handleJourneyMessage が呼ばれず、event-handler
 * は通常の chat-bridge にフォールスルーする。
 */
import { kv } from '@vercel/kv';
import type { FastifyInstance } from 'fastify';
import {
  pushLineMessage,
  replyLineMessage,
  showLineLoading,
  textMessage,
} from './client.js';
import { extractMediaText } from './media-extractor.js';
import { appendConversationTurn } from '../agent/conversation-history.js';
import { recordLlmTrace } from '../agent/trace-recorder.js';
import { resolveLineWorkspace } from './workspace-resolver.js';

/** 24h — long enough that Friend 追加→翌朝再開が成立する。 */
const JOURNEY_TTL_SECONDS = 60 * 60 * 24;

/** Journey ステップは 3 つだけ。`number` ではなく Union にしておくことで
 * `state.step === 4` のような将来の typo を型で弾く。 */
export type JourneyStep = 1 | 2 | 3;

/** KV に格納する journey の進行状態。`startedAt` は分析・タイムアウト判定の
 * 余地として残しておく(現状は読まない)。 */
export interface JourneyState {
  step: JourneyStep;
  startedAt: number;
}

function key(userId: string): string {
  return `line:journey:${userId}`;
}

/** KV available の判定 — `conversation-history.ts` 等と同じロジックを duplicate。
 * モジュール循環を避けるためあえて共有していない。 */
function isKvAvailable(): boolean {
  const hasUrl = Boolean(process.env.KV_REST_API_URL || process.env.KV_URL);
  const hasToken = Boolean(process.env.KV_REST_API_TOKEN);
  return hasUrl && hasToken;
}

/**
 * Read the persisted journey state. Returns null when KV is missing, the
 * key is absent, or the stored value is malformed (defensive: a corrupt
 * row should never trap the user in journey mode forever).
 */
export async function getJourneyState(
  userId: string,
): Promise<JourneyState | null> {
  if (!isKvAvailable() || !userId) return null;
  try {
    const raw = await kv.get<JourneyState>(key(userId));
    if (!raw || typeof raw !== 'object') return null;
    if (raw.step !== 1 && raw.step !== 2 && raw.step !== 3) return null;
    if (typeof raw.startedAt !== 'number') return null;
    return raw;
  } catch {
    return null;
  }
}

async function setJourneyStep(
  userId: string,
  step: JourneyStep,
  startedAt: number,
): Promise<void> {
  if (!isKvAvailable() || !userId) return;
  try {
    await kv.set(
      key(userId),
      { step, startedAt } satisfies JourneyState,
      { ex: JOURNEY_TTL_SECONDS },
    );
  } catch {
    // Non-fatal — the journey just won't progress this turn.
  }
}

/** Forget the journey. Called on completion (step 3 終端) or when the user
 * explicitly opts out (e.g. command "やめる" — Phase B). */
export async function clearJourney(userId: string): Promise<void> {
  if (!isKvAvailable() || !userId) return;
  try {
    await kv.del(key(userId));
  } catch {
    // Non-fatal.
  }
}

// ────────────────────────────── テキスト定数 ──────────────────────────────

/** Welcome + step 1 prompt は 1 通にまとめる。LINE は 1 通の方がメンタル
 * ブロックが軽く、初回離脱を最小化する。 */
export const WELCOME_AND_STEP1_TEXT = [
  'はじめまして、AI社員のフジです☺',
  '',
  'これからLINEで、ちょっとした相談相手になります。',
  '1分だけ、AIにできることを3つお見せしますね。',
  '',
  '【1つ目】写真を1枚送ってみてください。',
  'レシート、商品、手書きメモ、何でもOKです。私が中身を読み取ります。',
].join('\n');

const STEP2_PROMPT_TEXT = [
  '',
  '──────────',
  '【2つ目】今、ちょっと困っていることを一言だけ送ってみてください。',
  '例:「月末までに請求書10件作らないと」「英文メールの書き出しが分からない」など、何でも構いません。',
].join('\n');

const STEP3_PROMPT_TEXT = [
  '',
  '──────────',
  '【3つ目】雑談もできますよ。',
  '試しに「お疲れ」とだけ送ってみてください。',
].join('\n');

const COMPLETION_TEXT = [
  '',
  '──────────',
  'これがAIとの会話の基本です。',
  '困ったとき、迷ったとき、いつでも気軽に話しかけてくださいね。',
  '',
  '※ 見積書や請求書のPDFまで作りたい時は、Web版の https://fujitrace.jp で本格的な書類作成までできます。',
].join('\n');

// ───────────────────────── 送信エントリポイント ─────────────────────────

/**
 * Push the welcome + step-1 prompt and persist `step=1`.
 *
 * Uses `replyToken` if provided (best UX — message arrives instantly with
 * no delay) and falls back to push when reply fails or no token is given.
 */
export async function startWelcomeJourney(
  userId: string,
  replyToken?: string,
): Promise<void> {
  await setJourneyStep(userId, 1, Date.now());
  const msg = textMessage(WELCOME_AND_STEP1_TEXT);
  if (replyToken) {
    const ok = await replyLineMessage(replyToken, [msg]);
    if (ok) return;
  }
  await pushLineMessage(userId, [msg]);
}

/** Mutually-exclusive input: either text OR image. Caller picks one. */
export interface JourneyMessageInput {
  lineUserId: string;
  /** When present, the bridge will use it for ack within the 1-min window. */
  replyToken?: string;
  /** Set on text messages. */
  userText?: string;
  /** Set on image messages — already downloaded by the event-handler. */
  imageBuffer?: Buffer;
  /** MIME type for `imageBuffer`; ignored when imageBuffer is missing. */
  imageMimeType?: string;
}

/**
 * Drive one turn of the journey. Caller MUST have already verified that
 * a journey is active (via `getJourneyState`). Errors are logged and the
 * caller will see no exception — the user simply sees no reply, which is
 * far better than the journey getting permanently stuck on a transient
 * OpenAI 5xx.
 */
export async function handleJourneyMessage(
  fastify: FastifyInstance,
  input: JourneyMessageInput,
  state: JourneyState,
): Promise<void> {
  // Acknowledge the user's message immediately so they see "読んでいます…"
  // while OCR / OpenAI calls run. The replyToken expires in ~1 minute.
  if (input.replyToken) {
    await replyLineMessage(input.replyToken, [textMessage('読んでいます…')]);
  }
  void showLineLoading(input.lineUserId, 15);

  // Resolve the workspace once for the whole turn — every step needs it
  // for trace persistence (bucket-hole patch, 2026-04-25). null is
  // returned only when KV / DB is down; we still drive the journey but
  // skip trace recording for that turn.
  const resolved = await resolveLineWorkspace(input.lineUserId);
  const workspaceId = resolved?.workspaceId ?? null;

  try {
    if (state.step === 1) {
      await runStep1(fastify, input, workspaceId);
      return;
    }
    if (state.step === 2) {
      await runStep2(fastify, input, workspaceId);
      return;
    }
    if (state.step === 3) {
      await runStep3(fastify, input, workspaceId);
      return;
    }
  } catch (err) {
    fastify.log.error(
      { err, step: state.step, lineUserId: input.lineUserId },
      '[LINE journey] step handler failed',
    );
    // Best-effort fallback so the user is not abandoned mid-flow.
    await pushLineMessage(input.lineUserId, [
      textMessage(
        '申し訳ありません、少しの間うまく応答できませんでした。もう一度お試しください。',
      ),
    ]);
  }
}

// ───────────────────────────── ステップ実装 ─────────────────────────────

/**
 * Step 1 — image expected (text accepted as a polite alternative).
 *
 * Image branch: run OCR via `extractMediaText` and reply with a short
 * confirmation ("読み取った内容はこんな感じです: …") so the user sees that
 * the photo really was understood. The OCR text is appended to history so
 * the chat resumes with full context after the journey.
 *
 * Text branch: thank the user, gently note that photos work too, then
 * advance — never block the flow on missing input.
 */
async function runStep1(
  fastify: FastifyInstance,
  input: JourneyMessageInput,
  workspaceId: string | null,
): Promise<void> {
  let body: string;
  if (input.imageBuffer && input.imageMimeType) {
    const ocr = await extractMediaText(
      fastify,
      input.imageBuffer,
      input.imageMimeType,
      workspaceId ?? undefined,
    );
    if (ocr) {
      const preview = ocr.length > 500 ? `${ocr.slice(0, 500)}…` : ocr;
      body = [
        '写真、確かに受け取りました☺',
        '読み取った内容はこんな感じです:',
        '',
        preview,
        '',
        'こうして写真を見せていただければ、内容の要約や、メール文への引用、書類への転記までお手伝いできます。',
      ].join('\n');
      // Persist the OCR'd content so step-2's LLM (and post-journey chat)
      // can refer back to it when the user follows up.
      await appendConversationTurn(
        input.lineUserId,
        'user',
        `[添付画像の内容]\n${ocr}`,
      );
    } else {
      body = [
        '写真ありがとうございます。',
        'ただ、今回は中身をうまく読み取れませんでした。明るい場所で撮り直していただけると、より正確に読めますよ。',
      ].join('\n');
    }
  } else {
    const userText = input.userText?.trim() ?? '';
    body = [
      'メッセージありがとうございます。',
      '写真もいつでも送っていただいて大丈夫ですよ。次のメッセージで試してみてくださいね。',
    ].join('\n');
    if (userText) {
      await appendConversationTurn(input.lineUserId, 'user', userText);
    }
  }

  const replyText = body + STEP2_PROMPT_TEXT;
  await appendConversationTurn(input.lineUserId, 'assistant', replyText);
  await pushLineMessage(input.lineUserId, [textMessage(replyText)]);
  await setJourneyStep(input.lineUserId, 2, Date.now());
}

/**
 * Step 2 — substantive reply to a 困りごと, then prompt for step 3.
 *
 * We deliberately use a fresh single-shot OpenAI call (not `runChatWithSearch`
 * from chat-bridge) for two reasons:
 *   1. Determinism — the journey has fixed beats; we don't want the model
 *      hijacking its own turn order with web search.
 *   2. Cost — the journey is the most-replayed scripted path; using mini
 *      with a tight max_tokens keeps per-user onboarding cost <¥1.
 */
async function runStep2(
  fastify: FastifyInstance,
  input: JourneyMessageInput,
  workspaceId: string | null,
): Promise<void> {
  const userText = input.userText?.trim() ?? '';
  const reply = await runJourneyMiniChat(
    fastify,
    workspaceId,
    userText,
    'ユーザーが困っていることを一言で送ってきます。まず一行で共感を示してから、2〜4行で具体的な解決策のヒントや次の一歩を提案してください。書類作成(見積書/請求書/納品書/発注書/送付状)の話題が出たら、LINEでは書き方相談まで対応で、PDF生成はWeb版 fujitrace.jp という事実を1行だけ自然に添えてください。',
  );
  const replyText = reply + STEP3_PROMPT_TEXT;
  if (userText) await appendConversationTurn(input.lineUserId, 'user', userText);
  await appendConversationTurn(input.lineUserId, 'assistant', replyText);
  await pushLineMessage(input.lineUserId, [textMessage(replyText)]);
  await setJourneyStep(input.lineUserId, 3, Date.now());
}

/**
 * Step 3 — warm chit-chat reply, then completion text + Web funnel.
 *
 * Always clears the journey state on exit, even on LLM failure (the
 * fallback reply is generic but the journey is still considered "done"
 * so the user immediately gets full chat capabilities on the next turn).
 */
async function runStep3(
  fastify: FastifyInstance,
  input: JourneyMessageInput,
  workspaceId: string | null,
): Promise<void> {
  const userText = input.userText?.trim() ?? '';
  const reply = await runJourneyMiniChat(
    fastify,
    workspaceId,
    userText,
    'ユーザーがリラックスした雑談(「お疲れ」「ただいま」など)を送ってきます。労いと共感を込めて2〜3行で温かく応答してください。最後に「☺」を1つだけ添えても構いません(他の絵文字は禁止)。',
  );
  const replyText = reply + COMPLETION_TEXT;
  if (userText) await appendConversationTurn(input.lineUserId, 'user', userText);
  await appendConversationTurn(input.lineUserId, 'assistant', replyText);
  await pushLineMessage(input.lineUserId, [textMessage(replyText)]);
  await clearJourney(input.lineUserId);
}

/**
 * Single-shot mini chat used by step 2 / 3. Uses gpt-4o-mini directly so
 * the journey doesn't accidentally invoke web search (which would derail
 * the scripted beat). Falls back to a generic acknowledgement if the call
 * fails — never throws.
 */
async function runJourneyMiniChat(
  fastify: FastifyInstance,
  workspaceId: string | null,
  userText: string,
  stepInstruction: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !userText) {
    return 'お話しありがとうございます。';
  }
  const startTime = Date.now();
  const model = 'gpt-4o-mini';
  const messages = [
    {
      role: 'system',
      content:
        'あなたはFujiTraceのAI社員「フジ」です。LINEで日本のユーザーと話しています。\n' +
        '敬語ベースで気さくな口調、命令形ではなく提案形を使います。\n' +
        '絵文字は原則使いません(共感を示したい時だけ「☺」一文字のみ許容)。\n' +
        '回答は短く、5行以内。\n\n' +
        stepInstruction,
    },
    { role: 'user', content: userText },
  ];
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_tokens: 400,
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    }
    const parsed = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = parsed.choices?.[0]?.message?.content?.trim() ?? '';

    // Record this LLM call as a FujiTrace trace (bucket-hole patch).
    if (workspaceId) {
      const rawUsage = parsed.usage;
      const usage =
        rawUsage &&
        typeof rawUsage.prompt_tokens === 'number' &&
        typeof rawUsage.completion_tokens === 'number'
          ? {
              promptTokens: rawUsage.prompt_tokens,
              completionTokens: rawUsage.completion_tokens,
            }
          : undefined;
      recordLlmTrace({
        workspaceId,
        startTime,
        provider: 'openai',
        model,
        messages,
        responseText: content,
        usage,
        traceType: 'standard',
      });
    }

    return content || 'お話しありがとうございます。';
  } catch (err) {
    fastify.log.warn(
      { err: String(err) },
      '[LINE journey] mini-chat failed',
    );
    return 'お話しありがとうございます。';
  }
}
