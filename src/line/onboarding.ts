/**
 * LINE-first conversational onboarding for `user_business_info`.
 *
 * Background — LINE bypasses the dashboard's first-login modal that forces
 * every Web user to fill out company info. Until this module, LINE workspaces
 * sat on the placeholder row `ensureDefaultBusinessInfo()` seeds (company
 * name = "デモユーザー"). When the Contract Runtime ran with that placeholder
 * the tool-input-builder LLM often hallucinated plausible-looking company
 * details into the resulting estimate / invoice.
 *
 * Approach ("a 方針" — collect via conversation, per Founder decision
 * 2026-04-24):
 *   1. Before running the Runtime, check if the row is still the placeholder.
 *   2. If yes and we are NOT already collecting, push an instruction message
 *      asking for 会社名 / 住所 / 電話 / メール and set a KV flag.
 *   3. On the next user message (flag is set), run an extractor LLM over the
 *      free text. If we get at least a company name, UPSERT the row and
 *      clear the flag. Otherwise push a retry instruction.
 *   4. When the flag is cleared the normal Runtime path resumes on the
 *      NEXT turn — we intentionally don't try to infer "and now please make
 *      the estimate" from the onboarding message.
 *
 * KV availability — every call silently no-ops when KV is unavailable
 * (matches the rest of `src/line/`). Without KV we can't track onboarding
 * state anyway, so treating it as "not onboarding" is the least surprising
 * fallback.
 */
import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { kv } from '@vercel/kv';
import { getKnex } from '../storage/knex-client.js';
import { ensureAiToolsTables } from '../routes/tools/_shared.js';
import {
  callLlmViaProxy,
  parseLlmJson,
} from '../routes/tools/_shared.js';
import type { LlmMessage } from '../routes/tools/_shared.js';

/** KV key for the onboarding-in-progress flag. */
function onboardingKey(workspaceId: string): string {
  return `line:onboarding:${workspaceId}`;
}

/** TTL — 30 minutes. Long enough for a real conversation, short enough that
 * an abandoned flow doesn't trap the user in onboarding forever. */
const ONBOARDING_TTL_SECONDS = 60 * 30;

/** The placeholder company name seeded by `ensureDefaultBusinessInfo`. */
const PLACEHOLDER_COMPANY_NAME = 'デモユーザー';

/** Cheapest model — extraction is pattern-matching-heavy, not reasoning. */
const EXTRACTION_MODEL = 'gpt-4o-mini';

/** Message pushed to the user when we first detect the placeholder. */
export const ONBOARDING_PROMPT_TEXT =
  'はじめまして、AI事務員のフジです。\n' +
  '書類作成を始める前に、お客様の会社情報を教えてください。\n\n' +
  '例:\n' +
  '会社名: 株式会社サンプル\n' +
  '住所: 東京都千代田区1-1-1\n' +
  '電話: 03-1234-5678\n' +
  'メール: info@sample.co.jp\n\n' +
  '会社名だけ先にお送りいただくことも可能です(住所・電話・メールは後から追加できます)。';

/** Pushed when extraction returns no company name. */
export const ONBOARDING_RETRY_TEXT =
  '会社名が読み取れませんでした。お手数ですが、次の形式でもう一度お送りください:\n\n' +
  '会社名: (必須)\n' +
  '住所: (任意)\n' +
  '電話: (任意)\n' +
  'メール: (任意)';

/** KV availability probe — duplicated here to avoid a circular import. */
function isKvAvailable(): boolean {
  const hasUrl = Boolean(process.env.KV_REST_API_URL || process.env.KV_URL);
  const hasToken = Boolean(process.env.KV_REST_API_TOKEN);
  return hasUrl && hasToken;
}

/**
 * Return true when the persisted business info is still the placeholder
 * row that `ensureDefaultBusinessInfo()` seeds for new LINE workspaces.
 *
 * Check is tolerant — missing row or row with empty/undefined company_name
 * are also treated as "placeholder" so any workspace lacking real data
 * gets onboarded.
 */
export function isPlaceholderCompany(
  companyInfo: Record<string, unknown> | undefined,
): boolean {
  if (!companyInfo) return true;
  const name = companyInfo['company_name'];
  if (typeof name !== 'string' || name.trim().length === 0) return true;
  return name.trim() === PLACEHOLDER_COMPANY_NAME;
}

/** Return true if we are currently waiting for the user to send company info. */
export async function isOnboarding(workspaceId: string): Promise<boolean> {
  if (!isKvAvailable() || !workspaceId) return false;
  try {
    const v = await kv.get<string>(onboardingKey(workspaceId));
    return v === 'collecting';
  } catch {
    return false;
  }
}

/** Mark the workspace as actively collecting company info (with TTL). */
export async function startOnboarding(workspaceId: string): Promise<void> {
  if (!isKvAvailable() || !workspaceId) return;
  try {
    await kv.set(onboardingKey(workspaceId), 'collecting', {
      ex: ONBOARDING_TTL_SECONDS,
    });
  } catch {
    // Non-fatal — onboarding just won't self-track this time.
  }
}

/** Clear the onboarding flag (company info successfully saved, or aborted). */
export async function finishOnboarding(workspaceId: string): Promise<void> {
  if (!isKvAvailable() || !workspaceId) return;
  try {
    await kv.del(onboardingKey(workspaceId));
  } catch {
    // Non-fatal.
  }
}

/** Fields the extractor LLM is asked to return. Matches the
 * `user_business_info` schema used by the dashboard form. */
export interface ExtractedCompanyFields {
  company_name?: string;
  address?: string;
  phone?: string;
  email?: string;
}

/**
 * Ask the LLM to pull company fields out of a free-text user reply.
 *
 * Returns `null` when the reply contains no parseable company name —
 * the caller uses that signal to push the retry message.
 */
export async function extractCompanyFields(
  fastify: FastifyInstance,
  userText: string,
  /** Optional — surfaces the extraction call in the workspace's trace
   * dashboard. Kept optional for backward compat (onboarding is currently
   * dormant in Phase A but will be re-enabled in Phase C). */
  workspaceId?: string,
): Promise<ExtractedCompanyFields | null> {
  const trimmed = userText.trim();
  if (!trimmed) return null;

  const systemPrompt =
    'あなたは日本の会社情報を抽出するパーサーです。入力文から ' +
    'company_name / address / phone / email を JSON で返してください。\n' +
    '- 見つからないフィールドは含めない(null や空文字は禁止、keyごと省略)。\n' +
    '- company_name が推定できない場合は空のオブジェクト {} を返す。\n' +
    '- 出力は JSON のみ(コードフェンス禁止、前置き・後置き文字列禁止)。\n\n' +
    '例1 入力: 「会社名: 株式会社テスト / 住所: 東京都新宿区 / 電話: 03-1234-5678」\n' +
    '例1 出力: {"company_name":"株式会社テスト","address":"東京都新宿区","phone":"03-1234-5678"}\n\n' +
    '例2 入力: 「テスト合同会社です」\n' +
    '例2 出力: {"company_name":"テスト合同会社"}\n\n' +
    '例3 入力: 「見積書作って」\n' +
    '例3 出力: {}';

  const messages: LlmMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: trimmed },
  ];

  try {
    const { content } = await callLlmViaProxy(fastify, messages, {
      model: EXTRACTION_MODEL,
      temperature: 0.1,
      maxTokens: 256,
      workspaceId,
    });
    const parsed = parseLlmJson<ExtractedCompanyFields>(content);
    if (!parsed || typeof parsed !== 'object') return null;
    const companyName =
      typeof parsed.company_name === 'string' && parsed.company_name.trim().length > 0
        ? parsed.company_name.trim()
        : null;
    if (!companyName) return null;
    const out: ExtractedCompanyFields = { company_name: companyName };
    if (typeof parsed.address === 'string' && parsed.address.trim().length > 0) {
      out.address = parsed.address.trim();
    }
    if (typeof parsed.phone === 'string' && parsed.phone.trim().length > 0) {
      out.phone = parsed.phone.trim();
    }
    if (typeof parsed.email === 'string' && parsed.email.trim().length > 0) {
      out.email = parsed.email.trim();
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Replace the placeholder row with real values. Uses the oldest row for the
 * workspace (the one `ensureDefaultBusinessInfo()` seeds — the dashboard
 * already picks by `created_at asc` so late edits win uniformly).
 *
 * If somehow there's no row at all we insert one. Errors are swallowed —
 * onboarding should degrade gracefully rather than loop forever on a DB
 * hiccup.
 */
export async function saveCompanyInfo(
  workspaceId: string,
  fields: ExtractedCompanyFields,
): Promise<void> {
  try {
    await ensureAiToolsTables();
    const db = getKnex();
    const existing = await db('user_business_info')
      .where({ workspace_id: workspaceId })
      .orderBy('created_at', 'asc')
      .first();
    const now = new Date();
    if (existing && existing.id) {
      await db('user_business_info')
        .where({ id: existing.id })
        .update({
          company_name: fields.company_name ?? existing.company_name,
          address: fields.address ?? existing.address ?? '',
          phone: fields.phone ?? existing.phone ?? '',
          email: fields.email ?? existing.email ?? '',
          updated_at: now,
        });
      return;
    }
    await db('user_business_info').insert({
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      company_name: fields.company_name ?? PLACEHOLDER_COMPANY_NAME,
      address: fields.address ?? '',
      phone: fields.phone ?? '',
      email: fields.email ?? '',
      invoice_number: null,
      bank_name: null,
      bank_branch: null,
      account_type: null,
      account_number: null,
      account_holder: null,
      created_at: now,
      updated_at: now,
    });
  } catch {
    // Non-fatal — see function JSDoc.
  }
}
