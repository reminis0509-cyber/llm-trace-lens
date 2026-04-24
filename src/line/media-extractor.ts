/**
 * Extract text from LINE image / file / video attachments.
 *
 * Strategy:
 *   - image/jpeg, image/png  → GPT-4o Vision (multimodal LLM OCR)
 *   - application/pdf        → `pdf-parse`
 *   - text/*                 → UTF-8 decode
 *   - everything else        → return null (caller falls back to a friendly
 *     "この形式には対応していません" reply)
 *
 * All failures resolve to null rather than throwing — the LINE bridge must
 * stay resilient to malformed attachments, and the fallback reply is far
 * better UX than surfacing a stack trace.
 *
 * Upstream size cap — LINE content endpoint allows up to ~300 MB but the
 * Contract Runtime's prompt budget (and Vercel serverless memory) makes
 * anything over a few MB impractical. We silently truncate extracted text
 * at {@link MAX_EXTRACTED_CHARS}.
 */
import type { FastifyInstance } from 'fastify';
import { callLlmViaProxy } from '../routes/tools/_shared.js';
import type { LlmMessage } from '../routes/tools/_shared.js';

// NOTE: `pdf-parse` is deliberately NOT imported at module scope. The v2
// package relies on `pdfjs-dist`, which in turn references `DOMMatrix`
// and `@napi-rs/canvas` during module init — both of which are absent
// in Vercel's Node.js serverless runtime. A static `import { PDFParse }
// from 'pdf-parse'` caused the entire `/webhook/line` function to 500
// on every request, including text messages, because event-handler.ts
// imports this module. Load pdf-parse lazily inside `extractPdfText` —
// and treat any failure as "unsupported format" so a broken PDF path
// never takes down the LINE bridge again.

/** Hard cap on extracted text fed back into the Runtime. ≈ 10 k tokens for JA text. */
const MAX_EXTRACTED_CHARS = 8000;

/** GPT-4o Vision is overkill cost-wise but reliable for JA handwriting / forms. */
const VISION_MODEL = 'gpt-4o';

/** Accepted image MIME types. */
const IMAGE_MIME_PREFIXES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Narrow the LINE webhook message type (always lowercase) to one our
 * extractor knows how to handle. Callers pass the `message.type` field
 * verbatim.
 */
export type SupportedLineMediaType = 'image' | 'file';

/**
 * Infer a MIME type from a LINE file-message's `fileName`. LINE gives us
 * the original name including extension; extension-based detection is
 * fine for the small set of formats we actually handle.
 */
export function inferMimeFromFilename(fileName: string | undefined): string {
  const name = (fileName ?? '').toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.txt')) return 'text/plain';
  if (name.endsWith('.md')) return 'text/markdown';
  if (name.endsWith('.csv')) return 'text/csv';
  return 'application/octet-stream';
}

function truncate(text: string): string {
  return text.length > MAX_EXTRACTED_CHARS
    ? `${text.slice(0, MAX_EXTRACTED_CHARS)}\n…(以降は文字数超過のため省略)`
    : text;
}

/**
 * OCR / describe a bitmap image via GPT-4o Vision.
 *
 * The prompt asks for a structured Japanese transcription — readable
 * prose plus any tabular data. Returning structured text (rather than
 * raw recognised glyphs) makes the downstream Planner / ToolInputBuilder
 * significantly more reliable.
 */
export async function extractImageText(
  fastify: FastifyInstance,
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  if (!IMAGE_MIME_PREFIXES.includes(mimeType.toLowerCase())) return null;
  try {
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const messages: LlmMessage[] = [
      {
        role: 'system',
        content:
          'あなたは日本語文書のOCRアシスタントです。与えられた画像から、以下の方針でテキストを抽出してください。\n' +
          '1. すべての文字を忠実に書き起こす(手書き含む)。\n' +
          '2. 表形式のデータがあれば、列見出しと各行の値を `項目: 値` 形式で列挙する。\n' +
          '3. 画像が書類(見積書・請求書・名刺など)の場合は冒頭に「[画像: 書類種別]」と書く。\n' +
          '4. 画像が読み取れない・文字が無い場合は「[画像: 内容不明]」とだけ返す。\n' +
          '出力はプレーンテキストのみ。前置き・後置き文字列やコードフェンス禁止。',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'この画像の内容を日本語で書き起こしてください。' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ];
    const { content } = await callLlmViaProxy(fastify, messages, {
      model: VISION_MODEL,
      temperature: 0.1,
      maxTokens: 2048,
    });
    const text = (content ?? '').trim();
    if (!text) return null;
    return truncate(text);
  } catch {
    return null;
  }
}

/**
 * Extract text from a PDF attachment.
 *
 * CURRENTLY DISABLED on Vercel serverless (see module-level NOTE): the
 * `pdf-parse` / `pdfjs-dist` stack requires `DOMMatrix` and
 * `@napi-rs/canvas` which are not present in the runtime. Until we move
 * to a polyfilled approach or a different parser, return null so the
 * caller shows "対応していない形式" rather than crashing the webhook.
 *
 * Tracking: Phase 3 polish — evaluate `pdfjs-serverless` or call an
 * external parsing service.
 */
export async function extractPdfText(_buffer: Buffer): Promise<string | null> {
  return null;
}

/** Extract text from UTF-8 / ASCII text files (.txt / .md / .csv). */
export function extractPlainText(buffer: Buffer): string | null {
  try {
    const text = buffer.toString('utf-8').trim();
    if (!text) return null;
    return truncate(text);
  } catch {
    return null;
  }
}

/**
 * High-level dispatch: given a raw buffer + MIME type, return a plain-text
 * representation suitable to inject into the Contract Runtime as if the
 * user had typed it. Returns null when the format is unsupported or the
 * extractor produced nothing useful.
 */
export async function extractMediaText(
  fastify: FastifyInstance,
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  const mt = mimeType.toLowerCase();
  if (IMAGE_MIME_PREFIXES.includes(mt)) {
    return extractImageText(fastify, buffer, mt);
  }
  if (mt === 'application/pdf') {
    return extractPdfText(buffer);
  }
  if (mt.startsWith('text/')) {
    return extractPlainText(buffer);
  }
  return null;
}
