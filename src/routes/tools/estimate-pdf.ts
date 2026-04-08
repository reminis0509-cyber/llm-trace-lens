/**
 * POST /api/tools/estimate/pdf
 *
 * Generate a PDF version of the given estimate.
 *
 * Request:
 *   {
 *     estimate: EstimateData,
 *     template?: 'standard' | 'simple' | 'formal'
 *   }
 *
 * Response: application/pdf binary
 *
 * IMPORTANT — Japanese font support:
 * pdf-lib's StandardFonts (Helvetica/Times) only cover Latin characters and
 * cannot render CJK glyphs. Full Japanese rendering requires embedding a TTF
 * via @pdf-lib/fontkit, which is not currently a project dependency.
 *
 * Strategy used here:
 *   1. If a Noto Sans JP font file is present at assets/fonts/NotoSansJP-Regular.ttf
 *      AND @pdf-lib/fontkit is installed, embed it (subset) for full kanji rendering.
 *   2. Otherwise, fall back to a Latin-only layout that still produces a valid
 *      PDF with all numeric/structural information. Japanese strings will be
 *      replaced with `?` characters by the standard font but the PDF will
 *      remain a valid response. The X-PDF-Font-Mode header signals which mode
 *      was used so the frontend can show a notice.
 *
 * Templates `simple` and `formal` are TODO and currently fall back to `standard`.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  resolveWorkspaceId,
  recordUsage,
} from './_shared.js';
import type { EstimateData } from '../../types/ai-tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const estimateItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  quantity: z.number(),
  unit: z.string(),
  unit_price: z.number(),
  tax_rate: z.number(),
  subtotal: z.number(),
});

const estimateSchema = z.object({
  estimate_number: z.string(),
  issue_date: z.string(),
  valid_until: z.string(),
  client: z.object({
    company_name: z.string(),
    contact_person: z.string().optional(),
    honorific: z.string(),
  }),
  subject: z.string(),
  items: z.array(estimateItemSchema).min(1),
  subtotal: z.number(),
  tax_amount: z.number(),
  total: z.number(),
  delivery_date: z.string().optional(),
  payment_terms: z.string().optional(),
  notes: z.string().optional(),
});

const requestSchema = z.object({
  estimate: estimateSchema,
  template: z.enum(['standard', 'simple', 'formal']).optional(),
});

interface FontBundle {
  font: PDFFont;
  bold: PDFFont;
  mode: 'jp' | 'latin';
}

/**
 * Try to embed a Japanese font. Returns null on any failure.
 * Requires @pdf-lib/fontkit to be installed and a font file at the known path.
 */
async function tryEmbedJapaneseFont(doc: PDFDocument): Promise<FontBundle | null> {
  try {
    // Resolve font path. Try multiple candidates because __dirname differs
    // between environments:
    //   - dev (tsx)     : <repo>/src/routes/tools/  -> up 3 = <repo>
    //   - prod (tsc)    : <repo>/dist/src/routes/tools/ -> up 3 = <repo>/dist
    //   - vercel bundle : paths are opaque; fall back to process.cwd()
    // TTF is required: pdf-lib + fontkit subset works correctly with TTF/glyf
    // tables, but historically corrupted CFF (OTF) cmap mappings, causing all
    // Japanese glyphs to render as Latin fallback. With TTF + subset:true the
    // embedded font shrinks from ~5MB → 50–150 KB while preserving CJK output.
    const fontFile = 'NotoSansJP-Regular.ttf';
    const candidates = [
      path.resolve(__dirname, '..', '..', '..', 'assets', 'fonts', fontFile),
      path.resolve(__dirname, '..', '..', '..', '..', 'assets', 'fonts', fontFile),
      path.resolve(process.cwd(), 'assets', 'fonts', fontFile),
    ];
    const fontPath = candidates.find((p) => fs.existsSync(p));
    if (!fontPath) {
      return null;
    }
    // Dynamic import so missing module does not break the route.
    // The module name is hidden behind a variable so TypeScript does not
    // try to resolve it at compile time (it is an optional runtime dep).
    const moduleName = '@pdf-lib/' + 'fontkit';
    const dynImport = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;
    const fontkitMod = await dynImport(moduleName).catch(() => null);
    if (!fontkitMod) {
      return null;
    }
    const fontkit = (fontkitMod as { default?: unknown }).default ?? fontkitMod;
    // pdf-lib's registerFontkit requires a Fontkit instance
    (doc as unknown as { registerFontkit: (fk: unknown) => void }).registerFontkit(fontkit);
    const fontBytes = fs.readFileSync(fontPath);
    const font = await doc.embedFont(fontBytes, { subset: false });
    return { font, bold: font, mode: 'jp' };
  } catch {
    return null;
  }
}

/**
 * Replace characters that the Latin StandardFont cannot render with `?`.
 * Keeps ASCII and common Latin punctuation.
 */
function toLatinSafe(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, '?');
}

function formatYen(n: number): string {
  return n.toLocaleString('en-US') + ' JPY';
}

interface DrawCtx {
  page: PDFPage;
  bundle: FontBundle;
  y: number;
  width: number;
}

function drawText(ctx: DrawCtx, text: string, x: number, size: number, opts?: { bold?: boolean }): void {
  const safe = ctx.bundle.mode === 'jp' ? text : toLatinSafe(text);
  ctx.page.drawText(safe, {
    x,
    y: ctx.y,
    size,
    font: opts?.bold ? ctx.bundle.bold : ctx.bundle.font,
    color: rgb(0.1, 0.1, 0.15),
  });
}

async function buildEstimatePdf(estimate: EstimateData): Promise<{ bytes: Uint8Array; mode: 'jp' | 'latin' }> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  let bundle = await tryEmbedJapaneseFont(doc);
  if (!bundle) {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    bundle = { font, bold, mode: 'latin' };
  }

  const ctx: DrawCtx = { page, bundle, y: height - 60, width };

  // Header
  drawText(ctx, '見積書 / Estimate', 40, 20, { bold: true });
  ctx.y -= 30;
  drawText(ctx, `No. ${estimate.estimate_number}`, 40, 11);
  drawText(ctx, `発行日 / Issue: ${estimate.issue_date}`, 300, 11);
  ctx.y -= 16;
  drawText(ctx, `有効期限 / Valid until: ${estimate.valid_until}`, 300, 11);
  ctx.y -= 30;

  // Client
  drawText(ctx, `${estimate.client.company_name} ${estimate.client.honorific}`, 40, 14, { bold: true });
  if (estimate.client.contact_person) {
    ctx.y -= 16;
    drawText(ctx, `${estimate.client.contact_person} 様`, 40, 11);
  }
  ctx.y -= 30;

  // Subject
  drawText(ctx, `件名 / Subject: ${estimate.subject}`, 40, 12, { bold: true });
  ctx.y -= 30;

  // Items table
  drawText(ctx, '項目 / Item', 40, 11, { bold: true });
  drawText(ctx, '数量', 280, 11, { bold: true });
  drawText(ctx, '単価', 340, 11, { bold: true });
  drawText(ctx, '税率', 420, 11, { bold: true });
  drawText(ctx, '小計', 470, 11, { bold: true });
  ctx.y -= 14;
  page.drawLine({
    start: { x: 40, y: ctx.y + 4 },
    end: { x: width - 40, y: ctx.y + 4 },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.65),
  });
  ctx.y -= 4;

  for (const item of estimate.items) {
    if (ctx.y < 100) break; // single-page limit for now
    drawText(ctx, item.name, 40, 10);
    drawText(ctx, `${item.quantity} ${item.unit}`, 280, 10);
    drawText(ctx, formatYen(item.unit_price), 340, 10);
    drawText(ctx, `${item.tax_rate}%`, 420, 10);
    drawText(ctx, formatYen(item.subtotal), 470, 10);
    ctx.y -= 16;
  }

  ctx.y -= 10;
  page.drawLine({
    start: { x: 40, y: ctx.y + 4 },
    end: { x: width - 40, y: ctx.y + 4 },
    thickness: 0.5,
    color: rgb(0.6, 0.6, 0.65),
  });
  ctx.y -= 6;

  // Totals
  drawText(ctx, `小計 / Subtotal: ${formatYen(estimate.subtotal)}`, 340, 11);
  ctx.y -= 16;
  drawText(ctx, `消費税 / Tax: ${formatYen(estimate.tax_amount)}`, 340, 11);
  ctx.y -= 16;
  drawText(ctx, `合計 / Total: ${formatYen(estimate.total)}`, 340, 13, { bold: true });
  ctx.y -= 30;

  // Footer fields
  if (estimate.delivery_date) {
    drawText(ctx, `納期 / Delivery: ${estimate.delivery_date}`, 40, 10);
    ctx.y -= 14;
  }
  if (estimate.payment_terms) {
    drawText(ctx, `支払条件 / Payment: ${estimate.payment_terms}`, 40, 10);
    ctx.y -= 14;
  }
  if (estimate.notes) {
    drawText(ctx, `備考 / Notes: ${estimate.notes}`, 40, 10);
    ctx.y -= 14;
  }

  if (bundle.mode === 'latin') {
    ctx.y = 50;
    drawText(
      ctx,
      'Notice: Japanese font not installed on server; non-ASCII characters shown as ?.',
      40,
      8,
    );
  }

  const bytes = await doc.save();
  return { bytes, mode: bundle.mode };
}

export default async function estimatePdfRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/tools/estimate/pdf', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 hour',
        keyGenerator: async (request: FastifyRequest) => {
          // Use resolved workspaceId so X-User-Email header cannot be used
          // to bypass the limit (QA H-2).
          const workspaceId = await resolveWorkspaceId(request);
          return workspaceId ? `ws:${workspaceId}` : `ip:${request.ip}`;
        },
        errorResponseBuilder: () => ({
          success: false,
          error: 'リクエスト制限を超えました。しばらくお待ちください。',
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const workspaceId = await resolveWorkspaceId(request);
      if (!workspaceId) {
        return reply.code(401).send({ success: false, error: '認証が必要です' });
      }

      const parsed = requestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: '入力が不正です',
          details: parsed.error.errors,
        });
      }
      const { estimate, template } = parsed.data;

      // NOTE: PDF generation does NOT call an LLM and therefore does NOT
      // consume the Free-plan monthly quota (QA M-1). We still record the
      // usage event below with trace_id=null for analytics.

      // template variants are TODO — fall back to standard for now.
      // 'simple' / 'formal' will be added in a follow-up; we silently use the
      // standard layout instead of returning 500 so the UX is unaffected.
      void template;

      const { bytes, mode } = await buildEstimatePdf(estimate);

      await recordUsage(workspaceId, 'estimate', 'pdf', null);

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="estimate-${estimate.estimate_number}.pdf"`);
      reply.header('X-PDF-Font-Mode', mode);
      return reply.code(200).send(Buffer.from(bytes));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, 'estimate/pdf failed');
      return reply.code(500).send({
        success: false,
        error: 'PDF生成中にエラーが発生しました',
        detail: process.env.NODE_ENV !== 'production' ? message : undefined,
      });
    }
  });
}
