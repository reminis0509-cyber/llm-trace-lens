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
import { webSearch } from '../agent/web-search.js';

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

/** Model used for all LINE chat replies. Mini supports tool calling and
 * handles Japanese reliably at a fraction of gpt-4o's cost. */
const CHAT_TOOL_MODEL = 'gpt-4o-mini';

/** Max iterations through the web-search tool loop. 1 search per turn is
 * usually enough; the loop cap guards against a runaway LLM. */
const MAX_TOOL_ITERS = 2;

/** How many DuckDuckGo results to feed back to the LLM per search call. */
const WEB_SEARCH_RESULTS = 5;

/** Maximum reply length LINE accepts in a single text message (LINE cap 5000). */
const MAX_REPLY_CHARS = 4800;

/**
 * OpenAI function-calling tool declaration for web search. Kept extremely
 * narrow on purpose — the LLM should only invoke it when the user wants
 * current/external info, and the description says so.
 */
const WEB_SEARCH_TOOL = {
  type: 'function' as const,
  function: {
    name: 'web_search',
    description:
      '最新のニュース・会社情報・製品情報・一般的なウェブ情報を検索します。ユーザーが「調べて」「最新の」「今の」などリアルタイムの情報を求めている時だけ使用。一般知識で答えられる時は使わない。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '検索クエリ(日本語可)。短く具体的に。',
        },
      },
      required: ['query'],
    },
  },
};

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
  '使えるツール:',
  '- `web_search` — 最新のニュース・会社情報・製品情報などを調べたい時に使う。ユーザーが「調べて」「最新の」などリアルタイム情報を求める時だけ。',
  '',
  '現時点で「準備中」の機能(聞かれたら正直に伝える):',
  '- 見積書・請求書・納品書・発注書・送付状の作成/PDF出力',
  '- 画像からの請求書OCR、入金管理などの業務自動化',
  '',
  '上記の自動化機能は順次追加していきますが、今は「AIと相談して考えを整理する」「ネット情報を調べて要約する」ことに特化しています。ビジネス全般の相談、メール文案の下書き、アイデア出し、業務の進め方相談などに気軽にお使いいただけます。',
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
 * Serialise search results into a compact Japanese text block the LLM can
 * cite. Truncated aggressively — 5 results × ~300 chars = ~1500 chars is
 * plenty for a LINE-sized reply and keeps the follow-up tokens cheap.
 */
function formatSearchResults(
  query: string,
  results: Array<{ title: string; url: string; snippet: string }>,
): string {
  if (results.length === 0) {
    return `検索クエリ「${query}」の結果は見つかりませんでした。`;
  }
  const lines = [`検索クエリ: ${query}`, '検索結果:'];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const snip = r.snippet.length > 220 ? `${r.snippet.slice(0, 220)}…` : r.snippet;
    lines.push(`[${i + 1}] ${r.title}`);
    lines.push(`URL: ${r.url}`);
    lines.push(`概要: ${snip}`);
  }
  return lines.join('\n');
}

/**
 * Direct OpenAI call with function-calling + web_search tool loop.
 *
 * Why a bespoke helper (instead of the shared `callLlmWithTools`):
 *   - We need multi-iteration — the user might ask "最新のX" and the
 *     model should: (1) call web_search, (2) read results, (3) answer.
 *     `callLlmWithTools` is a single shot.
 *   - We want to carry `tool` / `assistant-with-tool_calls` messages back
 *     into the next iteration, which means mutating the message list in
 *     a way the shared `LlmMessage` type doesn't model.
 *
 * Intentionally narrow — only `web_search` is known. Any other tool the
 * LLM invents is ignored (treated as no-op and the loop continues).
 *
 * Returns the final assistant text. Throws on OpenAI API errors so the
 * caller can log + surface a friendly error.
 */
async function runChatWithSearch(
  systemPrompt: string,
  priorHistory: LlmMessage[],
  userText: string,
  logger: { info: (obj: unknown, msg: string) => void; warn: (obj: unknown, msg: string) => void },
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  // OpenAI's chat/completions message type is broader than our LlmMessage;
  // we use a local structural type here so tool-call round trips work.
  type OaMessage =
    | { role: 'system' | 'user'; content: string }
    | { role: 'assistant'; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
    | { role: 'tool'; tool_call_id: string; content: string };

  const messages: OaMessage[] = [
    { role: 'system', content: systemPrompt },
    ...priorHistory.map((m): OaMessage => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
    { role: 'user', content: userText },
  ];

  for (let iter = 0; iter < MAX_TOOL_ITERS + 1; iter++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CHAT_TOOL_MODEL,
        messages,
        tools: [WEB_SEARCH_TOOL],
        tool_choice: 'auto',
        temperature: 0.5,
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
          tool_calls?: Array<{
            id: string;
            type: 'function';
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };
    const msg = parsed.choices?.[0]?.message;
    const toolCalls = msg?.tool_calls ?? [];
    const content = msg?.content ?? '';

    // No tool call → final answer.
    if (toolCalls.length === 0) {
      return content;
    }

    // Loop budget exhausted → give up on more searches and synthesise
    // whatever content the model already produced.
    if (iter >= MAX_TOOL_ITERS) {
      logger.warn({ iter, toolCalls: toolCalls.length }, '[LINE chat] tool-loop cap hit — returning partial');
      return content || '申し訳ありません、検索結果をまとめられませんでした。もう一度お試しください。';
    }

    // Push the assistant message (with tool_calls) into the history so
    // OpenAI's subsequent call knows what we asked.
    messages.push({
      role: 'assistant',
      content,
      tool_calls: toolCalls,
    });

    // Execute each tool call. Currently only `web_search` is known.
    for (const tc of toolCalls) {
      if (tc.function.name !== 'web_search') {
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ error: `unknown tool ${tc.function.name}` }),
        });
        continue;
      }
      let query = '';
      try {
        const args = JSON.parse(tc.function.arguments) as { query?: unknown };
        query = typeof args.query === 'string' ? args.query.trim() : '';
      } catch {
        // malformed args — give the model a chance to try again
      }
      if (!query) {
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: 'エラー: 検索クエリが空でした。',
        });
        continue;
      }
      logger.info({ query }, '[LINE chat] web_search');
      let blob: string;
      try {
        const results = await webSearch(query, WEB_SEARCH_RESULTS);
        blob = formatSearchResults(query, results);
      } catch (err) {
        blob = `検索に失敗しました: ${err instanceof Error ? err.message : 'unknown'}`;
      }
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: blob,
      });
    }
  }

  return '申し訳ありません、想定外のループ状態になりました。もう一度お試しください。';
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
