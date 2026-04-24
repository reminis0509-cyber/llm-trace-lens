/**
 * LINE ↔ Contract-Based AI Clerk Runtime bridge.
 *
 * Core responsibilities:
 *   1. Resolve the incoming LINE user to a workspace (creating one if
 *      necessary — first-time lead follows trigger this).
 *   2. Immediately reply (via `replyToken`) so the Monday demo visitor sees
 *      an acknowledgement within LINE's 1-minute reply-token window, plus
 *      request the typing indicator.
 *   3. Run `executeContractAgent` to completion, capturing the final event
 *      and any `pdf_url` attachments.
 *   4. Push the resulting artefacts back via `pushMessage`. PDF URLs are
 *      surfaced as a Flex bubble with a URI action (LINE does not support a
 *      native "file" send-message type; URI buttons are the canonical
 *      pattern — see Implementation Notes in the summary report).
 */
import type { FastifyInstance } from 'fastify';
import type { messagingApi } from '@line/bot-sdk';
import { getKnex } from '../storage/knex-client.js';

type FlexContainer = messagingApi.FlexContainer;
import { executeContractAgent } from '../agent/contract-agent.js';
import type {
  AgentAttachment,
  AgentSseEvent,
} from '../agent/contract-agent.types.js';
import {
  appendConversationTurn,
  loadConversationHistory,
} from '../agent/conversation-history.js';
import {
  extractCompanyFields,
  finishOnboarding,
  isOnboarding,
  isPlaceholderCompany,
  ONBOARDING_PROMPT_TEXT,
  ONBOARDING_RETRY_TEXT,
  saveCompanyInfo,
  startOnboarding,
} from './onboarding.js';
import {
  flexMessage,
  pushLineMessage,
  replyLineMessage,
  showLineLoading,
  textMessage,
} from './client.js';
import { resolveLineWorkspace } from './workspace-resolver.js';

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

/** Type-guard helpers for the union-shaped AgentSseEvent. */
function isFinalEvent(
  e: AgentSseEvent,
): e is Extract<AgentSseEvent, { type: 'final' }> {
  return e.type === 'final';
}
function isErrorEvent(
  e: AgentSseEvent,
): e is Extract<AgentSseEvent, { type: 'error' }> {
  return e.type === 'error';
}

/**
 * Pull the latest persisted `user_business_info` for the workspace, as the
 * HTTP route does. Failures return `undefined` — the agent works without it.
 */
async function loadCompanyInfo(
  workspaceId: string,
): Promise<Record<string, unknown> | undefined> {
  try {
    const db = getKnex();
    const row = await db('user_business_info')
      .where({ workspace_id: workspaceId })
      .orderBy('created_at', 'asc')
      .first();
    return row ? (row as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Guess a sensible LINE file name from the user's prompt.
 * Kept heuristic — the reviewer reply already states what was produced; the
 * filename is just the label on the Flex button.
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
 * user's browser. LINE Messaging API does not support a native "file" send
 * type; this is the canonical pattern documented by LINE for downloads.
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
 * Pick the first PDF attachment, if any. The SSE runtime occasionally emits
 * multiple attachments (e.g. estimate + invoice pair) but for the Monday
 * demo one is enough and keeps the LINE flow snappy.
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
 * Decide the final push-message payload given the reviewer reply and the
 * attachments the runtime surfaced. Exported for unit tests.
 */
export function composeFinalMessages(
  userText: string,
  finalEvent: Extract<AgentSseEvent, { type: 'final' }>,
): ReturnType<typeof textMessage>[] | Array<ReturnType<typeof textMessage> | ReturnType<typeof flexMessage>> {
  const pdf = firstPdfAttachment(finalEvent.attachments);
  const replyText = finalEvent.reply || '処理が完了しました。';
  if (pdf) {
    const fileName = inferFileName(userText);
    return [
      textMessage(replyText),
      flexMessage(fileName, buildPdfFlex(fileName, pdf.url)),
    ];
  }
  return [textMessage(replyText)];
}

/**
 * End-to-end pipeline: workspace resolve → ack reply → agent run → push.
 */
export async function runChatBridge(
  fastify: FastifyInstance,
  input: ChatBridgeInput,
): Promise<void> {
  const resolved = await resolveLineWorkspace(input.lineUserId);
  if (!resolved) {
    // KV not configured / unavailable — surface a friendly message so the
    // Founder can debug on-stage rather than see radio silence.
    if (input.replyToken) {
      await replyLineMessage(input.replyToken, [
        textMessage('LINE連携の初期化に失敗しました。しばらくしてから再度お試しください。'),
      ]);
    }
    return;
  }

  const companyInfo = await loadCompanyInfo(resolved.workspaceId);

  // ── Company-info onboarding detour ────────────────────────────────────
  //
  // When the persisted company info is still the "デモユーザー" placeholder
  // seeded for new LINE workspaces, we take the conversation out of the
  // Runtime path and collect real values before the LLM gets a chance to
  // hallucinate plausible-looking details. See `src/line/onboarding.ts`
  // for the full rationale and state machine.
  if (isPlaceholderCompany(companyInfo)) {
    const collecting = await isOnboarding(resolved.workspaceId);
    if (collecting) {
      // User is replying to our onboarding ask — try to extract fields.
      const extracted = await extractCompanyFields(fastify, input.userText);
      if (extracted && extracted.company_name) {
        await saveCompanyInfo(resolved.workspaceId, extracted);
        await finishOnboarding(resolved.workspaceId);
        const successText =
          `「${extracted.company_name}」様として会社情報を登録しました。\n` +
          'ご依頼をどうぞ。例: 「見積書 A社 品目 月額10万円」';
        if (input.replyToken) {
          await replyLineMessage(input.replyToken, [textMessage(successText)]);
        } else {
          await pushLineMessage(input.lineUserId, [textMessage(successText)]);
        }
        // Persist onboarding exchange so Runtime sees it on the NEXT turn.
        await appendConversationTurn(input.lineUserId, 'user', input.userText);
        await appendConversationTurn(input.lineUserId, 'assistant', successText);
        return;
      }
      // Extraction failed — ask again. Keep the onboarding flag set so the
      // next reply is tried the same way.
      if (input.replyToken) {
        await replyLineMessage(input.replyToken, [textMessage(ONBOARDING_RETRY_TEXT)]);
      } else {
        await pushLineMessage(input.lineUserId, [textMessage(ONBOARDING_RETRY_TEXT)]);
      }
      return;
    }
    // Not yet onboarding — start now and ask.
    await startOnboarding(resolved.workspaceId);
    if (input.replyToken) {
      await replyLineMessage(input.replyToken, [textMessage(ONBOARDING_PROMPT_TEXT)]);
    } else {
      await pushLineMessage(input.lineUserId, [textMessage(ONBOARDING_PROMPT_TEXT)]);
    }
    // We intentionally do NOT persist `input.userText` to history here —
    // that message (e.g. "見積書作って") should be repeated by the user
    // AFTER onboarding so the Runtime gets a clean, unambiguous request.
    await appendConversationTurn(input.lineUserId, 'assistant', ONBOARDING_PROMPT_TEXT);
    return;
  }

  // ── Normal path: ack + Contract Runtime ───────────────────────────────

  // Ack within 1 minute (LINE reply_token rule). We intentionally do NOT
  // await showLineLoading here — it is best-effort and must not gate the
  // real reply.
  if (input.replyToken) {
    await replyLineMessage(input.replyToken, [
      textMessage('承りました、作業中です…'),
    ]);
  }
  void showLineLoading(input.lineUserId, 30);
  // Load PAST turns only — the current `input.userText` is passed as
  // `message` and the runtime appends it internally as the last user
  // message. After the run completes we persist both user + assistant
  // turns so the next request sees full context.
  const conversationHistory = await loadConversationHistory(input.lineUserId);

  // Drive the Contract Runtime. We capture the final / error event; all
  // other events (plan, step_start, step_result, review) are observability
  // only and would overwhelm the LINE chat if pushed one-by-one.
  let finalEvent:
    | Extract<AgentSseEvent, { type: 'final' }>
    | null = null;
  let errorEvent:
    | Extract<AgentSseEvent, { type: 'error' }>
    | null = null;

  try {
    for await (const event of executeContractAgent(fastify, {
      message: input.userText,
      conversationId: input.lineUserId,
      workspaceId: resolved.workspaceId,
      companyInfo,
      conversationHistory,
    })) {
      if (isFinalEvent(event)) {
        finalEvent = event;
      } else if (isErrorEvent(event)) {
        errorEvent = event;
      }
    }
  } catch (err) {
    // Surface as much detail as Vercel's log viewer can ingest — error
    // name / message / stack are pulled onto individual fields so the
    // Founder can filter on them without enabling verbose JSON output.
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
      '[LINE] Contract agent crashed',
    );
    await pushLineMessage(input.lineUserId, [
      textMessage(
        '申し訳ありません、処理中にエラーが発生しました。管理者に調査を依頼しました。',
      ),
    ]);
    return;
  }

  if (finalEvent) {
    // Persist both turns so the next user message sees full context. Order
    // matters: user first (chronological), then assistant. Failures are
    // swallowed inside the helper — history is nice-to-have, not critical.
    await appendConversationTurn(input.lineUserId, 'user', input.userText);
    if (finalEvent.reply) {
      await appendConversationTurn(
        input.lineUserId,
        'assistant',
        finalEvent.reply,
      );
    }
    await pushLineMessage(
      input.lineUserId,
      composeFinalMessages(input.userText, finalEvent),
    );
    return;
  }

  if (errorEvent) {
    fastify.log.warn(
      {
        code: errorEvent.code,
        message: errorEvent.message,
        stepIndex: errorEvent.stepIndex,
        workspaceId: resolved.workspaceId,
        lineUserId: input.lineUserId,
        userText: input.userText,
      },
      '[LINE] Contract agent reported error',
    );
    await pushLineMessage(input.lineUserId, [
      textMessage(
        '申し訳ありません、処理中にエラーが発生しました。管理者に調査を依頼しました。',
      ),
    ]);
    return;
  }

  // Neither final nor error — runtime ended without yielding a result.
  fastify.log.warn(
    {
      workspaceId: resolved.workspaceId,
      lineUserId: input.lineUserId,
      userText: input.userText,
    },
    '[LINE] Contract agent ended without final/error event',
  );
  await pushLineMessage(input.lineUserId, [
    textMessage('処理を完了できませんでした。もう一度お試しください。'),
  ]);
}
