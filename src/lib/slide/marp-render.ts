/**
 * lib/slide/marp-render.ts — Marp Markdown → HTML / PPTX rendering helpers.
 *
 * Responsibilities:
 *   - `renderToHtml(marpMarkdown)` : render Marp markdown to a standalone HTML
 *     document string, using `@marp-team/marp-core`.
 *   - `renderToPptx(marpMarkdown)` : parse the Marp markdown into logical
 *     slides (splitting on the Marp `---` slide separator) and emit a PowerPoint
 *     file (`Buffer`) using `pptxgenjs`. Each slide extracts an `h1` title,
 *     secondary headings (h2/h3), bullet lists, and free paragraphs — this is
 *     a deliberately simple conversion for v1. Images / speaker notes are out
 *     of scope for v1 and will be added in Phase A1.
 *
 * This module is pure (no network, no DB) and is safe to unit-test.
 */
import { Marp } from '@marp-team/marp-core';
// pptxgenjs ships a CJS default export. Under NodeNext+esModuleInterop the
// `.d.ts` surface exposes the class as the namespace itself, which makes a
// plain `import PptxGenJS from 'pptxgenjs'` non-constructable in TS view.
// We import the namespace and pick the default via require-style interop,
// which Node resolves identically in both dev and build.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import pptxgenjsDefault from 'pptxgenjs';
const PptxGenJS = pptxgenjsDefault as unknown as new () => import('pptxgenjs').default;

/**
 * Parsed Marp front-matter metadata recognised by the SlideBuilder agent.
 * Only a small subset — we intentionally do not try to honour every Marp
 * directive in the PPTX emitter.
 */
export interface MarpFrontMatter {
  theme?: string;
  title?: string;
  paginate?: boolean;
}

/** Single slide body extracted from Marp markdown. */
export interface ParsedSlide {
  /** Top-level h1 if present, otherwise the first non-empty line. */
  title: string;
  /** Optional subtitle captured from an h2/h3 block just after h1. */
  subtitle?: string;
  /** Plain-text paragraphs, in order. Bullets are captured separately. */
  paragraphs: string[];
  /** Bullet items, in order, with leading `- ` / `* ` / `1. ` stripped. */
  bullets: string[];
}

/**
 * Very small Marp front-matter parser. Accepts a document that either starts
 * with `---\n...\n---\n` (YAML-style front matter) or no front matter at all.
 * We don't pull in a full YAML parser for this — we only read the 3 keys we
 * care about and tolerate anything else as string passthrough.
 */
export function parseFrontMatter(markdown: string): { meta: MarpFrontMatter; body: string } {
  const trimmed = markdown.replace(/^\uFEFF/, ''); // strip BOM
  if (!trimmed.startsWith('---')) {
    return { meta: {}, body: trimmed };
  }
  // find closing --- that is on its own line
  const closing = trimmed.indexOf('\n---', 3);
  if (closing === -1) {
    return { meta: {}, body: trimmed };
  }
  const raw = trimmed.slice(3, closing).trim();
  const body = trimmed.slice(closing + 4).replace(/^\s*\n/, '');
  const meta: MarpFrontMatter = {};
  for (const line of raw.split('\n')) {
    const m = /^\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1];
    const value = m[2].replace(/^["']|["']$/g, '');
    if (key === 'theme') meta.theme = value;
    else if (key === 'title') meta.title = value;
    else if (key === 'paginate') meta.paginate = value === 'true';
  }
  return { meta, body };
}

/**
 * Split Marp body into individual slides. Marp slide separators are a line
 * consisting of exactly `---` surrounded by blank lines (or document
 * boundaries). We follow that convention: an inline `---` inside a bullet is
 * not a separator.
 */
export function splitSlides(body: string): string[] {
  // Normalise CRLF for predictable splits, then split on `\n---\n` or
  // leading/trailing variants. Empty leading/trailing slides are discarded.
  const normalised = body.replace(/\r\n/g, '\n').trim();
  if (normalised.length === 0) return [];
  const parts = normalised.split(/\n---\s*\n/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Parse a single slide's markdown body into a structured ParsedSlide. */
export function parseSlide(slideMd: string): ParsedSlide {
  const lines = slideMd.split('\n');
  let title = '';
  let subtitle: string | undefined;
  const paragraphs: string[] = [];
  const bullets: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (line.length === 0) continue;

    if (!title && /^#\s+/.test(line)) {
      title = line.replace(/^#\s+/, '').trim();
      continue;
    }
    if (!subtitle && /^##{1,2}\s+/.test(line)) {
      subtitle = line.replace(/^##{1,2}\s+/, '').trim();
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*]\s+/, '').trim());
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      bullets.push(line.replace(/^\d+\.\s+/, '').trim());
      continue;
    }
    if (line.startsWith('#')) {
      // Extra heading levels we treat as paragraphs to preserve content.
      paragraphs.push(line.replace(/^#+\s*/, '').trim());
      continue;
    }
    paragraphs.push(line);
  }

  // If we still have no title, fall back to the first paragraph / bullet.
  if (!title) {
    title = paragraphs.shift() ?? bullets[0] ?? '(無題スライド)';
  }
  return { title, subtitle, paragraphs, bullets };
}

/**
 * Render a Marp markdown document to standalone HTML using marp-core.
 * The output wraps the rendered slides in a minimal HTML5 document so that
 * the response can be iframed directly by the dashboard preview panel.
 */
export async function renderToHtml(marpMarkdown: string): Promise<string> {
  const marp = new Marp({ html: false });
  const { html, css } = marp.render(marpMarkdown);
  return [
    '<!DOCTYPE html>',
    '<html lang="ja">',
    '<head>',
    '<meta charset="utf-8" />',
    '<title>FujiTrace Slide Preview</title>',
    `<style>${css}</style>`,
    '</head>',
    '<body>',
    html,
    '</body>',
    '</html>',
  ].join('\n');
}

/**
 * Render Marp markdown to a .pptx `Buffer`. This is a coarse conversion —
 * each slide becomes a pptxgenjs slide with a centred title, optional subtitle,
 * a bullet list, and any free paragraphs rendered as body text. Styling is
 * deliberately conservative (no custom fonts) so the emitted .pptx opens
 * cleanly in PowerPoint / Keynote / Google Slides.
 */
export async function renderToPptx(marpMarkdown: string): Promise<Buffer> {
  const { meta, body } = parseFrontMatter(marpMarkdown);
  const slides = splitSlides(body).map(parseSlide);

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = meta.title ?? 'FujiTrace Slide';
  pptx.company = 'FujiTrace';

  if (slides.length === 0) {
    // guarantee at least one slide so the consumer never gets an empty file
    slides.push({ title: meta.title ?? '(空のスライド)', paragraphs: [], bullets: [] });
  }

  for (const slide of slides) {
    const s = pptx.addSlide();
    s.background = { color: 'FFFFFF' };
    s.addText(slide.title, {
      x: 0.5,
      y: 0.4,
      w: 12,
      h: 1,
      fontSize: 32,
      bold: true,
      color: '0F172A',
      fontFace: 'Yu Gothic',
    });
    let cursorY = 1.5;
    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: 0.5,
        y: cursorY,
        w: 12,
        h: 0.6,
        fontSize: 20,
        color: '475569',
        fontFace: 'Yu Gothic',
      });
      cursorY += 0.8;
    }
    if (slide.bullets.length > 0) {
      s.addText(
        slide.bullets.map((t) => ({ text: t, options: { bullet: { code: '25A0' } } })),
        {
          x: 0.7,
          y: cursorY,
          w: 11.5,
          h: 5,
          fontSize: 18,
          color: '0F172A',
          fontFace: 'Yu Gothic',
          paraSpaceAfter: 8,
        },
      );
      cursorY += Math.min(0.5 + 0.4 * slide.bullets.length, 4.5);
    }
    if (slide.paragraphs.length > 0) {
      s.addText(slide.paragraphs.join('\n\n'), {
        x: 0.7,
        y: cursorY,
        w: 11.5,
        h: 5,
        fontSize: 16,
        color: '334155',
        fontFace: 'Yu Gothic',
      });
    }
  }

  // pptxgenjs `write` signature returns Blob | string | Buffer depending on
  // options; `nodebuffer` guarantees a Node Buffer for us.
  const out = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return out;
}
