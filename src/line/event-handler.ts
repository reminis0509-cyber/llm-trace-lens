/**
 * LINE webhook event dispatch.
 *
 * Each webhook payload can carry multiple events (see
 * https://developers.line.biz/en/reference/messaging-api/#request-body). This
 * module routes each one to its handler while keeping the module decoupled
 * from Fastify — the caller already responded 200 OK by the time we run.
 *
 * Handled events:
 *   - `follow`           — start the 3-step Welcome Journey
 *                          (`welcome-journey.ts`).
 *   - `message` / text   — if a journey is active, drive the journey;
 *                          otherwise hand off to the standard chat bridge.
 *   - `message` / image  — same gating as text. Outside the journey, OCR
 *                          via `media-extractor` and feed into the bridge.
 *   - `message` / file   — text/PDF extraction → bridge.
 *   - `postback`         — Rich Menu cheat-sheet text, keyed on `action`.
 *
 * Anything else (unfollow, sticker, audio, video, location, …) is silently
 * ignored.
 */
import type { FastifyInstance } from 'fastify';
import type { webhook } from '@line/bot-sdk';
import {
  replyLineMessage,
  textMessage,
} from './client.js';
import { runChatBridge } from './chat-bridge.js';
import { downloadLineMessageContent } from './client.js';
import {
  extractMediaText,
  inferMimeFromFilename,
} from './media-extractor.js';
import {
  getJourneyState,
  handleJourneyMessage,
  startWelcomeJourney,
} from './welcome-journey.js';

/**
 * Handle a `follow` event — start the Welcome Journey scripted flow.
 *
 * Phase A1 (2026-04-25 pivot) — the previous `flexMessage` welcome with
 * tutorial / quest buttons created decision paralysis ("どれを押せば？")
 * for AI 初体験 users. The new design is a single guided text journey:
 * one CTA at a time, 3 turns total, ending with the fujitrace.jp Web
 * funnel. See `welcome-journey.ts` and the
 * `line_gateway_journey_2026-04-25` memory for the rationale.
 *
 * Idempotency note — LINE may re-deliver `follow` events on transient
 * delivery failures. `startWelcomeJourney` always overwrites the KV state
 * to step 1, so a duplicate follow simply restarts the journey rather
 * than producing two messages.
 */
async function handleFollow(event: webhook.FollowEvent): Promise<void> {
  const source = event.source;
  const userId =
    source && source.type === 'user' && source.userId ? source.userId : null;
  if (!userId) return;
  await startWelcomeJourney(userId, event.replyToken);
}

/**
 * Pull text out of an image / file / text attachment and shape it into a
 * synthetic "user message" that the chat bridge can process exactly like
 * a typed text. Returns null when the attachment is unsupported or the
 * extractor produced nothing.
 *
 * The returned string is deliberately tagged with a `[添付ファイル内容]`
 * header so the Runtime's prompts know this text came from OCR / PDF
 * parsing and should be treated as context rather than as a direct
 * instruction. When a filename is available we also surface it so the
 * user can see which file was processed.
 */
async function mediaMessageToUserText(
  fastify: FastifyInstance,
  messageId: string,
  mimeType: string,
  fileName?: string,
): Promise<string | null> {
  const buffer = await downloadLineMessageContent(messageId);
  if (!buffer) return null;
  const text = await extractMediaText(fastify, buffer, mimeType);
  if (!text) return null;
  const header = fileName
    ? `[添付ファイル「${fileName}」の内容]`
    : '[添付画像の内容]';
  return `${header}\n${text}`;
}

/**
 * Handle a message event — text, image, or file. Stickers / audio / video
 * remain out of scope and receive a gentle nudge.
 *
 * Image / file flow (Phase 2 — 自律AI 同等化):
 *   1. Reply-ack within the 1-minute replyToken window.
 *   2. Download content via `getLineBlobClient` and run through
 *      `extractMediaText` (GPT-4o Vision for images, pdf-parse for PDFs).
 *   3. Synthesise a user text (`[添付ファイル内容]...`) and hand it to the
 *      normal chat bridge, which resumes the Contract Runtime with full
 *      conversation history.
 *   4. Unsupported formats / failed OCR → push a friendly error so the
 *      user knows to retry with a different file.
 */
async function handleMessage(
  fastify: FastifyInstance,
  event: webhook.MessageEvent,
): Promise<void> {
  const source = event.source;
  const userId =
    source && source.type === 'user' && source.userId ? source.userId : null;
  if (!userId) {
    // Group / room — out of scope for demo.
    return;
  }

  const message = event.message;

  // ─── Welcome Journey gate (Phase A1) ─────────────────────────────────
  // If the user is currently in the 3-step journey, the journey owns this
  // turn end-to-end (ack + reply + state advance). Falling through to the
  // chat bridge would double-respond and confuse the scripted flow.
  const journeyState = await getJourneyState(userId);
  if (journeyState) {
    if (message.type === 'text') {
      const text = typeof message.text === 'string' ? message.text : '';
      if (!text.trim()) return;
      await handleJourneyMessage(
        fastify,
        {
          lineUserId: userId,
          replyToken: event.replyToken,
          userText: text,
        },
        journeyState,
      );
      return;
    }
    if (message.type === 'image') {
      const messageId = typeof message.id === 'string' ? message.id : '';
      if (!messageId) return;
      const buffer = await downloadLineMessageContent(messageId);
      await handleJourneyMessage(
        fastify,
        {
          lineUserId: userId,
          replyToken: event.replyToken,
          imageBuffer: buffer ?? undefined,
          imageMimeType: 'image/jpeg',
        },
        journeyState,
      );
      return;
    }
    // Unsupported message type during journey — gentle nudge keeps the
    // user on the rails without aborting the journey.
    if (event.replyToken) {
      await replyLineMessage(event.replyToken, [
        textMessage('テキストか写真でお送りください。'),
      ]);
    }
    return;
  }

  if (message.type === 'text') {
    const text = typeof message.text === 'string' ? message.text : '';
    if (!text.trim()) return;
    await runChatBridge(fastify, {
      lineUserId: userId,
      replyToken: event.replyToken,
      userText: text,
    });
    return;
  }

  if (message.type === 'image' || message.type === 'file') {
    const messageId = typeof message.id === 'string' ? message.id : '';
    if (!messageId) return;

    // Ack so the user sees progress during OCR / PDF parsing.
    if (event.replyToken) {
      await replyLineMessage(event.replyToken, [
        textMessage(
          message.type === 'image'
            ? '画像を受け取りました。内容を読み取ります…'
            : 'ファイルを受け取りました。内容を読み取ります…',
        ),
      ]);
    }

    // Infer MIME. For images LINE does not surface the MIME directly, but
    // the user message type is `image` and the content endpoint always
    // returns JPEG for LINE images. For files the filename tells us.
    let mimeType: string;
    let fileName: string | undefined;
    if (message.type === 'image') {
      mimeType = 'image/jpeg';
    } else {
      // message.type === 'file'
      fileName =
        typeof (message as { fileName?: unknown }).fileName === 'string'
          ? ((message as { fileName?: string }).fileName as string)
          : undefined;
      mimeType = inferMimeFromFilename(fileName);
    }

    const userText = await mediaMessageToUserText(
      fastify,
      messageId,
      mimeType,
      fileName,
    );

    if (!userText) {
      // Extraction failed — tell the user plainly. No replyToken available
      // here (already consumed by ack) so push.
      const { pushLineMessage } = await import('./client.js');
      await pushLineMessage(userId, [
        textMessage(
          message.type === 'image'
            ? '画像の内容を読み取れませんでした。もう一度、鮮明な画像でお送りください。'
            : 'ファイルの内容を読み取れませんでした。対応形式: 画像(jpeg, png) / テキスト(.txt, .md, .csv) (PDFは現在対応検討中です)',
        ),
      ]);
      return;
    }

    // Feed OCR/PDF text to the Contract Runtime. replyToken is already
    // consumed, so `runChatBridge` will push the final response.
    await runChatBridge(fastify, {
      lineUserId: userId,
      userText,
    });
    return;
  }

  // Sticker / audio / video / location / … — gentle nudge.
  if (event.replyToken) {
    await replyLineMessage(event.replyToken, [
      textMessage(
        'テキスト・画像・PDFでご指示ください（例: 見積書作って 株式会社テスト宛）。',
      ),
    ]);
  }
}

/**
 * Postback messages shown on Rich Menu taps (Phase A2 — 2026-04-25).
 *
 * Each entry is a "what to send" cheat sheet rather than a feature
 * trigger — the bot's job at this stage is to TEACH the AI 初体験 user
 * what kind of message will yield a useful reply. The closing line is the
 * actual prompt template they can copy-paste.
 *
 * Keep these texts under ~6 lines each. LINE messages > 8 lines start
 * scrolling and the visual "lift" of the rich menu is lost.
 */
/**
 * 2026-04-27 リブランド(戦略 doc Section 18.2.B2): 「AI社員のフジ」表記を
 * 削除し、商品名「おしごとAI」を主語にしない事実ベースの案内に統一。
 * カピぶちょーは別レイヤーで吹き出すため、本テキスト群には登場させない
 * (1 メッセージ 1 キャラの境界、Section 19.5 口調混在禁止ルール)。
 *
 * 共感絵文字「☺」は AI レイヤーから削除した(温かさはカピぶちょー側で出す)。
 */
const RICH_MENU_POSTBACK_TEXTS: Record<string, string> = {
  // 1段目左 — 写真で聞く
  rm_photo: [
    '写真を1枚送ってみてください。',
    '中身を読み取って、要約や使い方を提案します。',
    '',
    '例: レシート、商品ラベル、取扱説明書、手書きメモ、英文の書類など。',
  ].join('\n'),
  // 1段目中央 — 文案作成
  rm_mail: [
    'メール・連絡文の下書きをお手伝いします。',
    '宛先と用件をひとことで送ってください。',
    '',
    '例:',
    '・「子供の風邪で保育園に欠席連絡」',
    '・「取引先に納期遅れのお詫び」',
    '・「請求書の但し書きを丁寧に」',
  ].join('\n'),
  // 1段目右 — 翻訳
  rm_translate: [
    '翻訳・要約します。',
    '訳したい文章をそのまま送ってください。日本語⇄英語どちらも対応します。',
    '',
    '例:「以下を日本語に訳して: We are pleased to confirm…」',
  ].join('\n'),
  // 2段目左 — アイデア
  rm_idea: [
    'アイデア出し・整理をお手伝いします。',
    'テーマや状況を一行で送ってください。',
    '',
    '例:',
    '・「30代女性向けのギフト案を5つ」',
    '・「来週の会議のアジェンダを整理」',
    '・「予算3万円で社員へのプチプレゼント」',
  ].join('\n'),
  // 2段目中央 — お話しする
  rm_chat: [
    '何でもお話しください。',
    '今日あったこと、ちょっとした愚痴、迷っていること、何でも構いません。',
    '',
    '例:「今日は会議が3つで疲れた」「献立どうしようかな」など、気軽にどうぞ。',
  ].join('\n'),
  // 2段目右 — 本格作業
  rm_web: [
    '見積書・請求書のPDFまで本格的に作りたい時は、Web版をご利用ください。',
    '',
    'https://fujitrace.jp',
    '',
    'PCで書類作成・チェックまでお手伝いします。',
  ].join('\n'),
};

/**
 * Handle a `postback` event. Postback is LINE's "the user tapped a button
 * but didn't actually type anything" event — used by both Rich Menu taps
 * and any future Flex-bubble buttons. We dispatch on the `action=` query
 * parameter so the wire format is greppable in webhook logs.
 *
 * Phase A2 (2026-04-25) — only the Rich Menu's six rm_* actions are live.
 * Older actions (start_chat / start_estimate / …) are intentionally
 * removed; Rich Menus are versioned by name so an old tap firing a stale
 * action is impossible once `setup-line-rich-menu.ts` has run against
 * production.
 */
async function handlePostback(event: webhook.PostbackEvent): Promise<void> {
  if (!event.replyToken) return;
  const data = typeof event.postback?.data === 'string' ? event.postback.data : '';
  const params = new URLSearchParams(data);
  const action = params.get('action') ?? '';

  const text = RICH_MENU_POSTBACK_TEXTS[action];
  if (text) {
    await replyLineMessage(event.replyToken, [textMessage(text)]);
    return;
  }

  // Unknown postback — swallow silently so a stale Rich Menu tap from an
  // older bot version never spams the user with an error.
}

/**
 * Dispatch a single webhook event to the correct handler.
 * Exported for unit tests.
 */
export async function dispatchLineEvent(
  fastify: FastifyInstance,
  event: webhook.Event,
): Promise<void> {
  try {
    if (event.type === 'follow') {
      await handleFollow(event);
      return;
    }
    if (event.type === 'message') {
      await handleMessage(fastify, event);
      return;
    }
    if (event.type === 'postback') {
      await handlePostback(event);
      return;
    }
    // unfollow / sticker / … — no-op.
  } catch (err) {
    fastify.log.error(
      { err, eventType: event.type },
      '[LINE] Event handler failed',
    );
  }
}

/**
 * Dispatch every event in a webhook payload concurrently. Errors in one
 * event MUST NOT affect siblings.
 */
export async function dispatchLineEvents(
  fastify: FastifyInstance,
  events: webhook.Event[],
): Promise<void> {
  await Promise.all(events.map((ev) => dispatchLineEvent(fastify, ev)));
}
