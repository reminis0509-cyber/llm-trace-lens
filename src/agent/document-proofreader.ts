/**
 * agent/document-proofreader.ts — AI 社員 v2.1 Japanese document proofreader.
 *
 * Two-stage design:
 *   1. Rule-based pre-pass: regex catches the long tail of common Japanese
 *      business-writing mistakes (二重敬語, 冗長表現, 代表的な誤字). These
 *      findings are returned even if the LLM call fails, which makes the
 *      tool useful offline and easy to unit-test.
 *   2. LLM pass: Claude-compatible prompt via the existing `callLlmViaProxy`
 *      helper. The LLM is asked to return a strict JSON shape with
 *      diff-style corrections. We always merge the two passes and
 *      de-duplicate overlapping before/after pairs.
 */
import type { FastifyInstance } from 'fastify';
import { callLlmViaProxy, parseLlmJson, type LlmMessage } from '../routes/tools/_shared.js';

export type ProofStyle = 'business' | 'casual' | 'formal';
export type ProofLevel = 'light' | 'strict';

export interface DocumentProofreaderInput {
  text: string;
  style: ProofStyle;
  checkLevel: ProofLevel;
}

export interface Correction {
  before: string;
  after: string;
  reason: string;
  /** Character offset within the original text; -1 if not localisable. */
  position: number;
  source: 'rule' | 'llm';
}

export interface DocumentProofreaderOutput {
  corrections: Correction[];
  corrected: string;
  summary: string;
}

/**
 * Rule table. Every rule has a regex, a replacement, and a human-readable
 * reason. `strictOnly=true` means the rule is only applied when checkLevel
 * is 'strict' (avoids nagging users about stylistic choices in light mode).
 */
interface ProofRule {
  pattern: RegExp;
  replacement: string;
  reason: string;
  strictOnly?: boolean;
}

const PROOF_RULES: ProofRule[] = [
  // --- 代表的な誤字 (always on) --------------------------------------
  { pattern: /可塑性/g, replacement: '可否性', reason: '「可塑性」は誤字の可能性。「可否性」を想定。' },
  { pattern: /出張日(?=(費|手当))/g, replacement: '出張', reason: '「出張日費」は誤字。「出張費」に修正。' },
  // --- 二重敬語 (always on) -------------------------------------------
  // We map each inflection tail explicitly rather than using a back-reference
  // to guarantee natural Japanese output (the naive `伺$1` yields `伺き`).
  {
    pattern: /お伺いさせていただきます/g,
    replacement: '伺います',
    reason: '二重敬語「お伺いさせていただきます」→「伺います」',
  },
  {
    pattern: /お伺いさせていただいて/g,
    replacement: '伺って',
    reason: '二重敬語「お伺いさせていただいて」→「伺って」',
  },
  {
    pattern: /お伺いさせていただく/g,
    replacement: '伺う',
    reason: '二重敬語「お伺いさせていただく」→「伺う」',
  },
  {
    pattern: /拝見させていただきます/g,
    replacement: '拝見します',
    reason: '二重敬語「拝見させていただきます」→「拝見します」',
  },
  {
    pattern: /拝見させていただきました/g,
    replacement: '拝見しました',
    reason: '二重敬語「拝見させていただきました」→「拝見しました」',
  },
  {
    pattern: /拝見させていただく/g,
    replacement: '拝見する',
    reason: '二重敬語「拝見させていただく」→「拝見する」',
  },
  {
    pattern: /ご覧になられます/g,
    replacement: 'ご覧になります',
    reason: '二重敬語「ご覧になられます」→「ご覧になります」',
  },
  {
    pattern: /ご覧になられた/g,
    replacement: 'ご覧になった',
    reason: '二重敬語「ご覧になられた」→「ご覧になった」',
  },
  {
    pattern: /ご覧になられる/g,
    replacement: 'ご覧になる',
    reason: '二重敬語「ご覧になられる」→「ご覧になる」',
  },
  // --- 冗長表現 (strict only) ----------------------------------------
  {
    pattern: /することができます/g,
    replacement: 'できます',
    reason: '冗長表現「することができます」→「できます」',
    strictOnly: true,
  },
  {
    pattern: /することが可能です/g,
    replacement: 'できます',
    reason: '冗長表現「することが可能です」→「できます」',
    strictOnly: true,
  },
  {
    pattern: /ということになります/g,
    replacement: 'です',
    reason: '冗長表現「ということになります」→「です」',
    strictOnly: true,
  },
  {
    pattern: /に関しまして/g,
    replacement: 'について',
    reason: '冗長表現「に関しまして」→「について」',
    strictOnly: true,
  },
];

/** Run the rule-based pre-pass. Returns one Correction per match occurrence. */
export function runRulePass(text: string, level: ProofLevel): Correction[] {
  const out: Correction[] = [];
  for (const rule of PROOF_RULES) {
    if (rule.strictOnly && level !== 'strict') continue;
    // we must create a fresh RegExp per call to reset lastIndex safely
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const matched = m[0];
      const replaced = matched.replace(rule.pattern, rule.replacement);
      out.push({
        before: matched,
        after: replaced,
        reason: rule.reason,
        position: m.index,
        source: 'rule',
      });
      // avoid zero-width loop on matches
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return out;
}

/** Apply a set of Corrections to the text in reverse-offset order. */
export function applyCorrections(text: string, corrections: Correction[]): string {
  const positioned = corrections
    .filter((c) => c.position >= 0 && c.before.length > 0)
    .slice()
    .sort((a, b) => b.position - a.position);
  let out = text;
  for (const c of positioned) {
    const end = c.position + c.before.length;
    if (out.slice(c.position, end) === c.before) {
      out = out.slice(0, c.position) + c.after + out.slice(end);
    }
  }
  return out;
}

function styleInstruction(style: ProofStyle): string {
  switch (style) {
    case 'casual':
      return 'カジュアル、過度な敬語は避ける、読み手との距離感を保つ。';
    case 'formal':
      return '最上位のビジネス文書、社外宛てフォーマル、丁寧語を徹底。';
    case 'business':
    default:
      return '標準的なビジネス文書。簡潔、断定調、敬語は最小限。';
  }
}

/**
 * Ask the LLM for additional corrections in a strict JSON shape.
 * The LLM sees the text plus the rules already applied, so it only has to
 * find issues the regex rules missed.
 */
export async function runLlmPass(
  fastify: FastifyInstance,
  text: string,
  style: ProofStyle,
  level: ProofLevel,
  alreadyFound: Correction[],
): Promise<Correction[]> {
  const messages: LlmMessage[] = [
    {
      role: 'system',
      content: [
        'あなたは日本語ビジネス文書の校正者です。',
        'テキストから改善点を抽出し、厳密に次の JSON 形式で返してください:',
        '{"corrections": [{"before":"<対象>","after":"<修正後>","reason":"<理由>"}, ...]}',
        'corrections が 0 件でも JSON オブジェクト自体は必ず返すこと。',
        'before は元テキストに実在する部分文字列のみ、重複不可。',
        '装飾 (Markdown, コードフェンス, 絵文字) は禁止。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `スタイル方針: ${styleInstruction(style)}`,
        `チェックレベル: ${level === 'strict' ? '厳格' : '軽微'}`,
        '',
        'ルールベースで既に検出済みの指摘 (再掲しない):',
        alreadyFound.length === 0
          ? '(なし)'
          : alreadyFound.map((c) => `- ${c.before} → ${c.after} (${c.reason})`).join('\n'),
        '',
        '対象テキスト:',
        '---',
        text.slice(0, 8000),
        '---',
      ].join('\n'),
    },
  ];

  const { content } = await callLlmViaProxy(fastify, messages, {
    model: 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 1500,
  });

  type RawRes = { corrections?: Array<{ before?: unknown; after?: unknown; reason?: unknown }> };
  let raw: RawRes;
  try {
    raw = parseLlmJson<RawRes>(content);
  } catch {
    return [];
  }
  if (!Array.isArray(raw.corrections)) return [];

  const results: Correction[] = [];
  for (const item of raw.corrections) {
    if (!item || typeof item !== 'object') continue;
    const before = typeof item.before === 'string' ? item.before : '';
    const after = typeof item.after === 'string' ? item.after : '';
    const reason = typeof item.reason === 'string' ? item.reason : '';
    if (before.length === 0 || before === after) continue;
    const position = text.indexOf(before);
    results.push({ before, after, reason, position, source: 'llm' });
  }
  return results;
}

/** De-duplicate corrections that have identical before/after text. */
function dedup(corrections: Correction[]): Correction[] {
  const seen = new Set<string>();
  const out: Correction[] = [];
  for (const c of corrections) {
    const key = `${c.position}::${c.before}::${c.after}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** Main entry. Input-size validation is the caller's responsibility. */
export async function proofreadDocument(
  fastify: FastifyInstance,
  input: DocumentProofreaderInput,
): Promise<DocumentProofreaderOutput> {
  if (!input.text || input.text.length === 0) {
    throw new Error('text is required');
  }
  const ruleFindings = runRulePass(input.text, input.checkLevel);

  let llmFindings: Correction[] = [];
  try {
    llmFindings = await runLlmPass(
      fastify,
      input.text,
      input.style,
      input.checkLevel,
      ruleFindings,
    );
  } catch {
    // LLM pass is best-effort; rule pass still produces value alone.
    llmFindings = [];
  }

  const corrections = dedup([...ruleFindings, ...llmFindings]);
  const corrected = applyCorrections(input.text, corrections);
  const summary =
    corrections.length === 0
      ? '校正の指摘はありません。'
      : `${corrections.length} 件の指摘を検出しました (ルール ${ruleFindings.length} 件 / AI ${llmFindings.length} 件)。`;

  return { corrections, corrected, summary };
}
