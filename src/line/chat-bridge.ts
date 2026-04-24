/**
 * LINE ↔ Simple chat bridge (Phase A — 2026-04-25 pivot).
 *
 * 当初は Contract-Based Runtime を LINE 経路で直接駆動し、Tool 呼び出しで
 * PDF まで生成するフル自律モードを載せていた。しかし複数レイヤが絡み
 * 合うことで「宛先=自社」ハルシネーション、LIFF 404、コンテキスト引き
 * ずりといったバグが連鎖し、**1 箇所直すと別の箇所が壊れる**状態に陥って
 * いた (Founder判断 2026-04-25: 「最初から一気にしすぎてがんじがらめ」)。
 *
 * Phase A ではスコープを「LINE で AI と会話する」1 点に絞る:
 *   1. webhook から受けたテキストを `callLlmViaProxy` に直接流す。
 *   2. KV に 24h 保存された会話履歴を前置する(マルチターン継続)。
 *   3. 返信は純粋なテキスト 1 通のみ。Flex も LIFF ボタンも発行しない。
 *
 * 意図的に外した機能(コード自体は残置し、Phase C で明示コマンド経由で
 * 再接続する前提):
 *   - Contract Runtime の自動起動 (`executeContractAgent`)
 *   - placeholder 会社情報の検出 → 会話型 onboarding
 *   - tool 結果の構造化データを LIFF PDF ボタンにするフロー
 *
 * 残した機能:
 *   - `resolveLineWorkspace` — workspace 解決は引き続き必要(quota 等)
 *   - `loadConversationHistory` / `appendConversationTurn` — チャット履歴
 *   - reply token でのアック + loading animation — UX 上の基本
 */
import type { FastifyInstance } from 'fastify';
import type { messagingApi } from '@line/bot-sdk';

type FlexContainer = messagingApi.FlexContainer;
import type { AgentAttachment, AgentSseEvent } from '../agent/contract-agent.types.js';
import {
  appendConversationTurn,
  loadConversationHistory,
} from '../agent/conversation-history.js';
import {
  flexMessage,
  pushLineMessage,
  replyLineMessage,
  showLineLoading,
  textMessage,
} from './client.js';
import { resolveLineWorkspace } from './workspace-resolver.js';
import { callLlmViaProxy } from '../routes/tools/_shared.js';
import type { LlmMessage } from '../routes/tools/_shared.js';

/** Internal input shape for the bridge, produced by the event handler. */
export interface ChatBridgeInput {
  lineUserId: string;
  /**
   * Present iff this call originated from a webhook event whose replyToken
   * has not been consumed yet. Optional so the bridge can also be invoked
   * from tests / manual retries.
   */
  replyToken?: string;
  userText: string;
}

/** Model used for all LINE chat replies. Cost-optimised, Japanese-capable. */
const CHAT_MODEL = 'gpt-4o-mini';

/** Maximum reply length LINE accepts in a single text message (LINE cap 5000). */
const MAX_REPLY_CHARS = 4800;

/**
 * The system prompt that defines フジ's persona on LINE. Kept deliberately
 * short so it doesn't drown out the conversation history. Notes:
 *
 *   - We surface the fact that書類作成(estimate / invoice / ...)は準備中 so
 *     users don't ask for PDFs and get disappointed. When Phase C lands the
 *     prompt will be switched based on command detection.
 *   - "フジ" is the mascot persona; matches the dashboard's AI Clerk UI and
 *     keeps branding consistent.
 */
const SYSTEM_PROMPT = [
  'あなたはFujiTraceのAI社員「フジ」です。LINE公式アカウントの会話インターフェースで日本の中小企業・個人事業主のユーザーを助けます。',
  '',
  '行動ガイド:',
  '- 日本語で、丁寧かつフレンドリーに応答する。',
  '- 相手の質問・相談に答える。分からないことは「分からない」と率直に伝える。',
  '- 長文は避け、LINE で読みやすい短めの段落で返す(概ね4〜12行以内)。',
  '- 箇条書きや番号リストは LINE では見づらいので、必要な時だけ最小限に使う。',
  '- 絵文字は原則使わない(日本のビジネスLINEの慣習に合わせる)。',
  '',
  '現時点で「準備中」の機能(聞かれたら正直に伝える):',
  '- 見積書・請求書・納品書・発注書・送付状の作成/PDF出力',
  '- 画像からの請求書OCR、入金管理などの業務自動化',
  '',
  '上記の自動化機能は順次追加していきますが、今は「AIと相談して考えを整理する」ことに特化しています。ビジネス全般の相談、メール文案の下書き、アイデア出し、業務の進め方相談などに気軽にお使いいただけます。',
].join('\n');

/** Tidy the LLM reply for LINE — strip stray whitespace and truncate. */
function normaliseReply(raw: string | null | undefined): string {
  const text = (raw ?? '').trim();
  if (!text) {
    return '申し訳ありません、うまく返答が作れませんでした。もう一度教えていただけますか。';
  }
  if (text.length <= MAX_REPLY_CHARS) return text;
  return `${text.slice(0, MAX_REPLY_CHARS)}…`;
}

/**
 * Guess a sensible LINE file name from the user's prompt.
 * Retained because `composeFinalMessages` still uses it and the bridge
 * tests exercise both. Phase C will reconnect this when document tools
 * are surfaced via explicit commands.
 */
export function inferFileName(userText: string): string {
  const today = new Date();
  const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const keywords: Array<{ keyword: string; label: string }> = [
    { keyword: '見積', label: '見積書' },
    { keyword: '請求', label: '請求書' },
    { keyword: '納品', label: '納品書' },
    { keyword: '発注', label: '発注書' },
    { keyword: '送付状', label: '送付状' },
    { keyword: '議事録', label: '議事録' },
    { keyword: '提案', label: '提案書' },
    { keyword: '報告', label: '報告書' },
  ];
  for (const { keyword, label } of keywords) {
    if (userText.includes(keyword)) {
      return `${label}_${yyyymmdd}.pdf`;
    }
  }
  return `書類_${yyyymmdd}.pdf`;
}

/**
 * Build a Flex bubble with a URI-action button that opens the PDF in the
 * user's browser. Kept as a utility for Phase C — the current simple-chat
 * flow never emits Flex bubbles.
 */
function buildPdfFlex(fileName: string, pdfUrl: string): FlexContainer {
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'text',
          text: fileName,
          weight: 'bold',
          wrap: true,
        },
        {
          type: 'text',
          text: 'ボタンをタップしてPDFを開いてください。',
          wrap: true,
          size: 'xs',
          color: '#999999',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#2563eb',
          action: {
            type: 'uri',
            label: 'PDFを開く',
            uri: pdfUrl,
          },
        },
      ],
    },
  };
}

/**
 * Pick the first PDF attachment, if any. Exported for Phase C reuse and
 * to keep the existing chat-bridge test suite passing without churn.
 */
export function firstPdfAttachment(
  attachments: AgentAttachment[] | undefined,
): { url: string } | null {
  if (!attachments) return null;
  for (const a of attachments) {
    if (a.kind === 'pdf' && typeof a.url === 'string' && a.url.length > 0) {
      return { url: a.url };
    }
  }
  return null;
}

/**
 * Pure compose helper retained for tests and for Phase C when the Runtime
 * returns PDF attachments again. The Phase A bridge never calls this with
 * an attachment — only plain text — but the existing test suite asserts
 * both branches still work.
 */
export function composeFinalMessages(
  userText: string,
  finalEvent: Extract<AgentSseEvent, { type: 'final' }>,
  liffDocUrl?: string,
): ReturnType<typeof textMessage>[] | Array<ReturnType<typeof textMessage> | ReturnType<typeof flexMessage>> {
  const pdf = firstPdfAttachment(finalEvent.attachments);
  const replyText = finalEvent.reply || '処理が完了しました。';
  const fileName = inferFileName(userText);
  if (liffDocUrl) {
    return [
      textMessage(replyText),
      flexMessage(fileName, buildPdfFlex(fileName, liffDocUrl)),
    ];
  }
  if (pdf) {
    return [
      textMessage(replyText),
      flexMessage(fileName, buildPdfFlex(fileName, pdf.url)),
    ];
  }
  return [textMessage(replyText)];
}

/**
 * Phase A simple-chat pipeline.
 *
 *   1. Resolve / lazily-create the LINE user's workspace.
 *   2. Ack within the 1-minute replyToken window (`承りました`) and start
 *      the LINE typing animation.
 *   3. Load past turns from KV, build a standard `[system, ...history,
 *      user]` message array and call `callLlmViaProxy`.
 *   4. Persist both user + assistant turns into history.
 *   5. Push the assistant reply as a single text message.
 *
 * All failure modes fall back to a friendly `申し訳ありません` reply so the
 * user never sees a stack trace. Errors are logged with enough detail
 * (`lineUserId`, `workspaceId`, `userText`) to grep Vercel logs.
 */
export async function runChatBridge(
  fastify: FastifyInstance,
  input: ChatBridgeInput,
): Promise<void> {
  const resolved = await resolveLineWorkspace(input.lineUserId);
  if (!resolved) {
    if (input.replyToken) {
      await replyLineMessage(input.replyToken, [
        textMessage('LINE連携の初期化に失敗しました。しばらくしてから再度お試しください。'),
      ]);
    }
    return;
  }

  // Ack within the reply-token window so the user sees progress. Typing
  // animation is best-effort — never block on it.
  if (input.replyToken) {
    await replyLineMessage(input.replyToken, [
      textMessage('承りました、考え中です…'),
    ]);
  }
  void showLineLoading(input.lineUserId, 20);

  const history = await loadConversationHistory(input.lineUserId);
  const messages: LlmMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: input.userText },
  ];

  let reply: string;
  try {
    const { content } = await callLlmViaProxy(fastify, messages, {
      model: CHAT_MODEL,
      temperature: 0.6,
      maxTokens: 1200,
    });
    reply = normaliseReply(typeof content === 'string' ? content : null);
  } catch (err) {
    const errObj = err instanceof Error ? err : new Error(String(err));
    fastify.log.error(
      {
        err: errObj,
        errName: errObj.name,
        errMessage: errObj.message,
        errStack: errObj.stack,
        workspaceId: resolved.workspaceId,
        lineUserId: input.lineUserId,
        userText: input.userText,
      },
      '[LINE] simple-chat LLM call failed',
    );
    await pushLineMessage(input.lineUserId, [
      textMessage(
        '申し訳ありません、AIの応答を取得できませんでした。少し時間をおいてもう一度お試しください。',
      ),
    ]);
    return;
  }

  // Persist both turns so the NEXT message sees the full context.
  await appendConversationTurn(input.lineUserId, 'user', input.userText);
  await appendConversationTurn(input.lineUserId, 'assistant', reply);

  await pushLineMessage(input.lineUserId, [textMessage(reply)]);
}
