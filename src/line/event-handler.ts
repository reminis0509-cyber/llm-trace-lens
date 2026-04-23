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
            type: 'message',
            label: 'チャットで頼む',
            text: '何をお手伝いしましょうか?',
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
 * Handle a text `message` event by delegating to the chat bridge.
 * Non-text messages (sticker / image / file / …) receive a gentle nudge.
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
  if (message.type !== 'text') {
    if (event.replyToken) {
      await replyLineMessage(event.replyToken, [
        textMessage('テキストでご指示ください（例: 見積書作って 株式会社テスト宛）。'),
      ]);
    }
    return;
  }

  const text = typeof message.text === 'string' ? message.text : '';
  if (!text.trim()) return;

  await runChatBridge(fastify, {
    lineUserId: userId,
    replyToken: event.replyToken,
    userText: text,
  });
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
    // unfollow / sticker / postback / … — no-op.
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
