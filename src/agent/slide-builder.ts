/**
 * agent/slide-builder.ts — AI 社員 v2.1 Slide Builder.
 *
 * Given a topic + audience + slide count + style, the SlideBuilder agent
 * asks an LLM to emit a Marp-formatted Markdown presentation and then
 * renders it to both HTML (for instant preview) and a .pptx Buffer (for
 * download). This module deliberately replaces the earlier Web App Builder
 * β stub — Founder decision 2026-04-21.
 *
 * Contract:
 *   Input:  SlideBuilderInput
 *   Output: SlideBuilderOutput { marp (markdown), html, pptxBase64, warnings }
 *
 * LLM: we reuse the existing OpenAI `callLlmViaProxy` helper. Switching to
 * Claude requires only changing the `model` option — the prompt format is
 * vendor-neutral Markdown.
 */
import type { FastifyInstance } from 'fastify';
import { callLlmViaProxy, type LlmMessage } from '../routes/tools/_shared.js';
import { renderToHtml, renderToPptx } from '../lib/slide/marp-render.js';

export interface SlideBuilderInput {
  topic: string;
  audience?: string;
  slideCount?: number;
  style?: 'business' | 'casual' | 'pitch';
  /** Optional — surfaces the slide-generation LLM call in the trace
   * dashboard (bucket-hole patch 2026-04-25). */
  workspaceId?: string;
}

export interface SlideBuilderOutput {
  marp: string;
  html: string;
  pptxBase64: string;
  slideCount: number;
  warnings: string[];
}

const MIN_SLIDES = 3;
const MAX_SLIDES = 20;

function clampSlideCount(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 8;
  return Math.max(MIN_SLIDES, Math.min(MAX_SLIDES, Math.floor(n)));
}

function styleDirective(style: SlideBuilderInput['style']): string {
  switch (style) {
    case 'casual':
      return 'カジュアルで親しみやすい口調。絵文字は使わない。過度な装飾なし。';
    case 'pitch':
      return '投資家向けピッチ。各スライドは数字・主張・根拠の3要素を必ず含む。';
    case 'business':
    default:
      return 'ビジネスフォーマル。見出しは簡潔、本文は断定調。敬語は最小限。';
  }
}

/**
 * Build the prompt that drives the LLM to emit Marp-formatted Markdown.
 * The prompt pins the output shape (code-fence-free Markdown, slide count,
 * `---` separators, h1 title per slide) to keep downstream parsing robust.
 */
export function buildSlidePrompt(input: SlideBuilderInput): LlmMessage[] {
  const slides = clampSlideCount(input.slideCount);
  const audience = (input.audience ?? '一般ビジネスパーソン').slice(0, 200);
  const topic = input.topic.slice(0, 1000);
  const style = styleDirective(input.style);

  const system = [
    'あなたはプロのプレゼン資料作成者です。',
    'Marp 形式の Markdown 1 本だけを出力してください。コードフェンス、前後の説明文、JSON、Base64 は禁止です。',
    '出力ルール:',
    `- 必ず ${slides} 枚のスライドで構成する`,
    '- 各スライドは `# タイトル` (h1) で始める',
    '- スライド間は独立行の `---` で区切る',
    '- 先頭には `---\\ntheme: default\\npaginate: true\\n---` のフロントマターを置く',
    '- 箇条書きは `-` を使う',
    '- 装飾 HTML、画像参照、外部リンクは使わない',
    `- スタイル方針: ${style}`,
    `- 対象聴衆: ${audience}`,
  ].join('\n');

  const user = [
    `トピック: ${topic}`,
    '',
    `上記トピックで${slides}枚のプレゼンを作成してください。`,
    '1枚目はタイトルスライド、最後は「まとめ」または「次のアクション」にしてください。',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Strip accidental code fences or prose the model sometimes adds despite
 * the system prompt. We keep everything between the first `---` line and
 * the end of content, but if no front matter is emitted we prepend a
 * minimal one so the Marp parser is happy.
 */
export function normaliseMarpOutput(raw: string): string {
  let cleaned = raw.trim();
  // Strip ```markdown ... ``` or ``` ... ``` fences if the LLM added one.
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  if (!cleaned.startsWith('---')) {
    cleaned = ['---', 'theme: default', 'paginate: true', '---', '', cleaned].join('\n');
  }
  return cleaned;
}

/**
 * Build a SlideBuilderOutput from a topic. Calls the LLM once, renders the
 * Marp result to HTML + PPTX, and bundles them for the client. Errors are
 * propagated — the caller (route handler) is responsible for converting them
 * to 4xx/5xx responses.
 */
export async function buildSlidePresentation(
  fastify: FastifyInstance,
  input: SlideBuilderInput,
): Promise<SlideBuilderOutput> {
  const warnings: string[] = [];
  if (!input.topic || input.topic.trim().length < 2) {
    throw new Error('topic is required');
  }

  const messages = buildSlidePrompt(input);
  const { content } = await callLlmViaProxy(fastify, messages, {
    model: 'gpt-4o',
    temperature: 0.3,
    maxTokens: 3000,
    workspaceId: input.workspaceId,
    traceType: 'agent',
  });

  const marp = normaliseMarpOutput(content);
  if (marp.length < 40) {
    warnings.push('LLM output was unexpectedly short; slides may be incomplete.');
  }

  const html = await renderToHtml(marp);
  const pptxBuf = await renderToPptx(marp);
  const pptxBase64 = pptxBuf.toString('base64');

  // Count h1 occurrences as a rough slide count — less strict than parsing
  // but good enough for the client-facing summary.
  const slideCount = (marp.match(/^#\s+/gm) ?? []).length;

  return {
    marp,
    html,
    pptxBase64,
    slideCount,
    warnings,
  };
}
