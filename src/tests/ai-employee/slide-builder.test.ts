/**
 * slide-builder.test.ts — AI 社員 v2.1 slide builder unit tests.
 *
 * Covers the pure-function core (no network): Marp MD parsing, HTML render,
 * PPTX round-trip (verifies the byte stream starts with the ZIP header that
 * all .pptx files have).
 */
import { describe, it, expect } from 'vitest';
import {
  parseFrontMatter,
  splitSlides,
  parseSlide,
  renderToHtml,
  renderToPptx,
} from '../../lib/slide/marp-render.js';
import {
  buildSlidePrompt,
  normaliseMarpOutput,
} from '../../agent/slide-builder.js';

const SAMPLE_MARP = [
  '---',
  'theme: default',
  'paginate: true',
  '---',
  '',
  '# FujiTrace の強み',
  '',
  '## 日本市場に特化した観測基盤',
  '',
  '- 国内データ滞留',
  '- 日本語 PII 検出',
  '- 請求書自動仕分け',
  '',
  'このスライドは v2.1 の自動生成確認用です。',
  '',
  '---',
  '',
  '# まとめ',
  '',
  '- 責任 AI ツール',
  '- Watch Room',
  '- AI 社員',
].join('\n');

describe('slide-builder: Marp parsing', () => {
  it('parses front matter with theme/paginate', () => {
    const { meta, body } = parseFrontMatter(SAMPLE_MARP);
    expect(meta.theme).toBe('default');
    expect(meta.paginate).toBe(true);
    expect(body).toContain('# FujiTrace の強み');
  });

  it('splits into the right number of slides', () => {
    const { body } = parseFrontMatter(SAMPLE_MARP);
    const slides = splitSlides(body);
    expect(slides.length).toBe(2);
  });

  it('extracts h1 title, h2 subtitle, bullets, and paragraph', () => {
    const { body } = parseFrontMatter(SAMPLE_MARP);
    const [first] = splitSlides(body);
    const parsed = parseSlide(first);
    expect(parsed.title).toBe('FujiTrace の強み');
    expect(parsed.subtitle).toBe('日本市場に特化した観測基盤');
    expect(parsed.bullets).toEqual([
      '国内データ滞留',
      '日本語 PII 検出',
      '請求書自動仕分け',
    ]);
    expect(parsed.paragraphs.some((p) => p.includes('v2.1'))).toBe(true);
  });
});

describe('slide-builder: HTML / PPTX render round-trip', () => {
  it('renders to an HTML5 document string', async () => {
    const html = await renderToHtml(SAMPLE_MARP);
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('FujiTrace');
  });

  it('renders to a .pptx Buffer beginning with the ZIP/OOXML magic', async () => {
    const buf = await renderToPptx(SAMPLE_MARP);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    // PPTX files are ZIP containers — magic bytes are "PK\x03\x04".
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it('handles a minimal (no-front-matter) doc gracefully', async () => {
    const minimal = '# First\n\n- a\n- b\n\n---\n\n# Second';
    const buf = await renderToPptx(minimal);
    expect(buf.length).toBeGreaterThan(1000);
  });
});

describe('slide-builder: prompt + normalisation helpers', () => {
  it('builds a system + user message pair with slide count constraint', () => {
    const msgs = buildSlidePrompt({
      topic: 'B2B SaaS Observability',
      slideCount: 5,
      style: 'pitch',
      audience: 'VC',
    });
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
    const sys = typeof msgs[0].content === 'string' ? msgs[0].content : '';
    expect(sys).toContain('5 枚');
    expect(sys).toContain('投資家向けピッチ');
  });

  it('strips code fences and prepends front matter when missing', () => {
    const raw = '```markdown\n# A\n- x\n```';
    const out = normaliseMarpOutput(raw);
    expect(out.startsWith('---')).toBe(true);
    expect(out).toContain('# A');
    expect(out).not.toContain('```');
  });

  it('keeps already-well-formed Marp markdown unchanged', () => {
    const out = normaliseMarpOutput(SAMPLE_MARP);
    expect(out).toBe(SAMPLE_MARP.trim());
  });
});
