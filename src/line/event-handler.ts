/**
 * LINE webhook event dispatch.
 *
 * Each webhook payload can carry multiple events (see
 * https://developers.line.biz/en/reference/messaging-api/#request-body). This
 * module routes each one to its handler while keeping the module decoupled
 * from Fastify — the caller already responded 200 OK by the time we run.
 *
 * Handled events:
 *   - `follow`     — a user adds our Official Account as a friend.
 *   - `message` / text — the core AI 事務員 entrypoint.
 *
 * Everything else (unfollow, sticker / image / audio messages, postback, …)
 * is a no-op for now — the Monday demo only needs follow + text.
 */
import type { FastifyInstance } from 'fastify';
import type { webhook, messagingApi } from '@line/bot-sdk';
import { lineConfig } from '../config.js';
import {
  flexMessage,
  replyLineMessage,
  textMessage,
} from './client.js';
import { runChatBridge } from './chat-bridge.js';
import { downloadLineMessageContent } from './client.js';
import {
  extractMediaText,
  inferMimeFromFilename,
} from './media-extractor.js';

type FlexContainer = messagingApi.FlexContainer;

/**
 * Compose the welcome Flex bubble shown on `follow`. Three action buttons
 * mirror the dashboard onboarding (chat / tutorial / quest).
 */
function buildWelcomeFlex(liffId: string): FlexContainer {
  const tutorialUri = `https://liff.line.me/${liffId}/tutorial`;
  const questUri = `https://liff.line.me/${liffId}/quest`;
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: 'FujiTraceへようこそ',
          weight: 'bold',
          size: 'lg',
        },
        {
          type: 'text',
          text: '見積書・請求書・議事録など、事務作業はAI社員「フジ」にお任せください。',
          wrap: true,
          size: 'sm',
          color: '#555555',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#2563eb',
          action: {
            // `postback` は LINE 側に「このボタンが押された」という
            // イベントだけを送る種別。`type: 'message'` のように
            // 勝手にユーザー発話として送信してしまう事故を防ぐため、
            // 本ボタンは必ず postback で扱う。data は dispatcher が
            // `action=start_chat` を見て Bot 側からの案内返信にルーティングする。
            type: 'postback',
            label: 'チャットで頼む',
            data: 'action=start_chat',
            displayText: 'チャットで頼む',
          },
        },
        {
          type: 'button',
          style: 'secondary',
          action: {
            type: 'uri',
            label: 'チュートリアルで学ぶ',
            uri: tutorialUri,
          },
        },
        {
          type: 'button',
          style: 'secondary',
          action: {
            type: 'uri',
            label: 'クエストに挑戦',
            uri: questUri,
          },
        },
      ],
    },
  };
}

/**
 * Handle a `follow` event — send greeting text + action-button Flex.
 */
async function handleFollow(event: webhook.FollowEvent): Promise<void> {
  if (!event.replyToken) return;
  const liffId = lineConfig.liffId ?? '';
  const greeting = textMessage(
    'フォローありがとうございます。FujiTraceのAI社員です。書類作成もチェックもお任せください。',
  );
  const menu = flexMessage('FujiTraceメニュー', buildWelcomeFlex(liffId));
  await replyLineMessage(event.replyToken, [greeting, menu]);
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
 * Handle a `postback` event — currently only the welcome-flex
 * "チャットで頼む" button. Adding more postback actions later is as simple
 * as extending the `action=...` switch below. All postback payloads use
 * URL-query-style strings so we can grep them in logs.
 */
async function handlePostback(event: webhook.PostbackEvent): Promise<void> {
  if (!event.replyToken) return;
  const data = typeof event.postback?.data === 'string' ? event.postback.data : '';
  const params = new URLSearchParams(data);
  const action = params.get('action');

  if (action === 'start_chat') {
    await replyLineMessage(event.replyToken, [
      textMessage(
        'どんな書類をお作りしますか？\n' +
          '対応: 見積書・請求書・納品書・発注書・送付状\n\n' +
          '例: 「見積書 株式会社テスト宛 コンサルティング料 月額10万円」のように、' +
          '宛先・品目・金額をまとめて書くとそのまま作成できます。',
      ),
    ]);
    return;
  }

  // Rich Menu entries — each delivers a short pre-baked prompt telling the
  // user exactly what to type. All document-creation actions intentionally
  // converge on the same chat input pattern so the Contract Runtime's
  // Planner gets deterministic text to route on.
  if (action === 'start_estimate') {
    await replyLineMessage(event.replyToken, [
      textMessage(
        '見積書を作成します。\n' +
          '宛先(相手先会社名)、品目、金額、必要なら納期・支払条件を1通のメッセージで送ってください。\n\n' +
          '例: 「見積書 株式会社テスト宛 コンサルティング料 月額10万円 納期4/30 支払は月末締翌月末払い」',
      ),
    ]);
    return;
  }
  if (action === 'start_invoice') {
    await replyLineMessage(event.replyToken, [
      textMessage(
        '請求書を作成します。\n' +
          '宛先(相手先会社名)、品目、金額、期日を送ってください。\n\n' +
          '例: 「請求書 株式会社テスト宛 コンサルティング料 10万円 支払期日5/31」',
      ),
    ]);
    return;
  }
  if (action === 'start_delivery_note') {
    await replyLineMessage(event.replyToken, [
      textMessage(
        '納品書を作成します。\n' +
          '宛先(相手先会社名)、納品物、数量、納品日を送ってください。\n\n' +
          '例: 「納品書 株式会社テスト宛 Webデザイン一式 納品日4/25」',
      ),
    ]);
    return;
  }
  if (action === 'start_purchase_order') {
    await replyLineMessage(event.replyToken, [
      textMessage(
        '発注書を作成します。\n' +
          '発注先、品目、数量、金額、希望納期を送ってください。\n\n' +
          '例: 「発注書 株式会社サプライヤー宛 部材A 100個 単価500円 納期5/10」',
      ),
    ]);
    return;
  }
  if (action === 'start_cover_letter') {
    await replyLineMessage(event.replyToken, [
      textMessage(
        '送付状を作成します。\n' +
          '宛先、同封物、簡単な挨拶文の希望を送ってください。\n\n' +
          '例: 「送付状 株式会社テスト宛 見積書1部を送付 平素よりお世話になっております」',
      ),
    ]);
    return;
  }

  // Unknown postback — swallow silently so a stale Flex button never spams
  // the user with an error.
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
