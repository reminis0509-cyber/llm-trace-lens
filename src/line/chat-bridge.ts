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
import type { LlmMessage } from '../routes/tools/_shared.js';
// `webSearch` (DuckDuckGo HTML scraping) は 2026-04-25 に dead code 化した。
// Vercel Serverless から DDG への HTTP リクエストが空ボディで返却されるため
// LINE 経由では実効しなかった。代替として OpenAI 内蔵 Web 検索モデル
// (`gpt-4o-mini-search-preview`) に切り替え、手動 tool loop も廃止している。
// 2026-04-25 時点ではまだ非 LINE のサーフェス(Contract Runtime)が使う可能性
// を残しているため import 自体は削除しない。LINE では参照しない。
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 段階的撤去のため意図的に残す
import { webSearch as _legacyDdgWebSearch } from '../agent/web-search.js';

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

/**
 * Model used for all LINE chat replies.
 *
 * `gpt-4o-mini-search-preview` is OpenAI's mini variant with built-in web
 * search — Chat Completions accepts a `web_search_options` object and the
 * model decides per turn whether to invoke search. Citations come back as
 * `message.annotations[]` of type `url_citation`.
 *
 * Why this over gpt-4o-mini + a custom DDG tool loop (the previous design):
 *   - DuckDuckGo HTML scraping returns empty/blocked responses from Vercel
 *     Serverless edges (verified 2026-04-25). The same problem hits any
 *     custom backend that scrapes a public SERP.
 *   - Built-in search uses OpenAI's own retrieval pipeline so we don't
 *     fight bot-detection. ChatGPT-quality results out of the box.
 *   - Cost is ~2-3× of plain gpt-4o-mini per 1k tokens, but LINE traffic
 *     volume keeps the absolute monthly bill in the hundreds-of-yen range
 *     even with daily Founder dogfooding.
 *
 * Note: this preview model does NOT accept `temperature` or `top_p` — both
 * are silently ignored. We omit them in the request body to avoid noise.
 */
const CHAT_MODEL = 'gpt-4o-mini-search-preview';

/** Maximum reply length LINE accepts in a single text message (LINE cap 5000). */
const MAX_REPLY_CHARS = 4800;

/**
 * The system prompt that defines フジ's persona on LINE. Phase A の Gateway AI
 * 戦略では「AI を初めて触る人が 3 メッセージ以内で『便利』と感じる」のが成功
 * 条件であり、ChatGPT のような賢い道具ではなく **身近な相談相手** に寄せる
 * のが差別化軸になる(memory: line_gateway_journey_2026-04-25)。
 *
 * 設計ポイント:
 *   - 自己紹介は「AI社員のフジ」で統一(キャラ性ブランドの土台)。
 *   - 敬語ベースの気さくな口調。命令形ではなく提案形(「〜してみますか？」)。
 *   - 絵文字は原則使わない。共感が必要な場面に限り「☺」のみ許容(ビジネス
 *     LINEで馴染む唯一の絵文字)。
 *   - 励まし・労いの語彙を能動的に使い、相談相手としての温度感を出す。
 *   - 書類生成(見積/請求/納品/発注/送付状)は LINE では「書き方相談」まで。
 *     PDF 生成は fujitrace.jp に自然誘導する(出口を 1 本に絞ってブランディング
 *     上のミスマッチを避ける)。
 */
const SYSTEM_PROMPT = [
  'あなたはFujiTraceのAI社員「フジ」です。LINEで日本の中小企業や個人事業主の方の身近な相談相手として会話します。',
  '',
  '【口調・キャラ性】',
  '- 一人称は「私」。自己紹介は「AI社員のフジです」で統一する。',
  '- 敬語ベースだが硬くしすぎない、気さくな口調。命令形ではなく提案形を選ぶ(例: 「〜してみますか？」「〜するのもいいかもしれません」)。',
  '- 励まし・労いを自然に織り込む(例: 「お疲れさまです」「無理のない範囲で大丈夫ですよ」)。',
  '- 絵文字は原則使わない。共感を伝えたい場面に限り「☺」一文字だけ使ってよい(他の絵文字や顔文字は禁止)。',
  '- LINEで読みやすい短めの段落(概ね4〜10行)。箇条書きは必要最小限に。',
  '- 分からないことは正直に「分からない」と伝え、代わりにできることを提案する。',
  '',
  '【できること】',
  '- 日常の相談・愚痴・雑談への応答(疲れた、献立どうしよう、など)。',
  '- メール・文案の下書き(欠席連絡、お詫び、お礼、依頼、催促など)。',
  '- 翻訳・要約(英文メール、ニュース記事、契約書の要点抜き出しなど)。',
  '- アイデア出し・情報整理・計算サポート。',
  '- 画像から読み取った内容の説明や用途の提案。',
  '- 最新情報の検索(モデル内蔵のWeb検索で対応)。「調べて」「最新の」などの指示があれば自動で検索する。',
  '',
  '【書類作成について — 重要】',
  '- 見積書・請求書・納品書・発注書・送付状の「書き方相談」「文案の下書き」「項目の確認」はLINE上で対応する。',
  '- ただし PDF の自動生成・正式な書類出力は LINE では行わない。「本格的な書類作成は fujitrace.jp の AI 社員(Web版)で対応しています」と自然に案内し、誘導する。',
  '- 誘導する時は押し売り感を出さず、「もしPDFまで必要でしたら fujitrace.jp で続きができます」程度の柔らかさで。',
  '',
  '【NG】',
  '- 過剰な絵文字、顔文字、ビックリマーク連発。',
  '- 「承知いたしました」連呼の機械的な応答。',
  '- できないことを曖昧にぼかす。素直に「今のLINEではここまでです」と伝える。',
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
 * Single-shot OpenAI call against the built-in-search model.
 *
 * Replaces the previous tool-loop helper that drove a manual DuckDuckGo
 * round trip. With `gpt-4o-mini-search-preview` + `web_search_options: {}`
 * the model invokes its own retrieval when the user's intent calls for it
 * and returns the final assistant text in one call. No iteration needed.
 *
 * Returns the assistant text. Throws on OpenAI API errors so the caller
 * can log + surface a friendly error.
 *
 * Implementation notes:
 *   - `web_search_options: {}` is the minimal opt-in. We could pass
 *     `search_context_size: 'low' | 'medium' | 'high'` to trade cost for
 *     thoroughness. `medium` is the API default and matches our LINE
 *     reply-length budget, so we leave it implicit.
 *   - The preview model rejects `temperature` and `top_p` (returns 400 if
 *     either is non-default). We omit both.
 */
async function runChatWithSearch(
  systemPrompt: string,
  priorHistory: LlmMessage[],
  userText: string,
  logger: { info: (obj: unknown, msg: string) => void; warn: (obj: unknown, msg: string) => void },
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  type OaMessage = { role: 'system' | 'user' | 'assistant'; content: string };

  const messages: OaMessage[] = [
    { role: 'system', content: systemPrompt },
    ...priorHistory.map((m): OaMessage => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
    { role: 'user', content: userText },
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      web_search_options: {},
      max_tokens: 1200,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
  }
  const parsed = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        annotations?: Array<{
          type?: string;
          url_citation?: { url?: string; title?: string };
        }>;
      };
    }>;
  };
  const msg = parsed.choices?.[0]?.message;
  const content = msg?.content ?? '';
  const citationCount = (msg?.annotations ?? []).filter(
    (a) => a.type === 'url_citation',
  ).length;
  if (citationCount > 0) {
    logger.info(
      { citationCount },
      '[LINE chat] built-in search produced citations',
    );
  }
  return content;
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

  let reply: string;
  try {
    const raw = await runChatWithSearch(SYSTEM_PROMPT, history, input.userText, {
      info: (obj, msg) => fastify.log.info(obj, msg),
      warn: (obj, msg) => fastify.log.warn(obj, msg),
    });
    reply = normaliseReply(raw);
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
