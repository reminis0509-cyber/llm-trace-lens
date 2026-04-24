/**
 * LiffDoc — LIFF-hosted PDF preview page.
 *
 * Phase 3 of the LINE integration. When the LINE chat-bridge finishes an
 * office-task run that produced a structured document (estimate / invoice /
 * …), it stashes the structured data in KV and sends the user a Flex
 * button pointing at `/liff/doc/:shortId`. Tapping the button opens this
 * page inside the LINE in-app browser:
 *
 *   1. Parse `shortId` from the current URL path.
 *   2. Fetch `{ type, data, issuer, createdAt }` from
 *      `GET /api/line/liff-doc/:shortId`.
 *   3. Render the PDF with the existing `packages/dashboard/src/lib/pdf/`
 *      modules — exactly the same client-side code path the Web dashboard
 *      uses.
 *   4. Expose a prominent "PDFを保存する" download button and a
 *      secondary "LINEに戻る" button that closes the LIFF window.
 *
 * Intentionally self-contained — types, helpers, and rendering all live in
 * this file so that the LIFF surface doesn't depend on AiClerkChat's
 * internal data-extraction pipeline. The `data` payload coming out of the
 * API is already shaped for the PDF modules (saveDocForLiff is called with
 * the structured payload directly), so we only need light coercion for
 * safety.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, Loader2, X } from 'lucide-react';
import type { EstimatePdfData } from '../lib/pdf/estimate';
import type { InvoicePdfData } from '../lib/pdf/invoice';
import type { PurchaseOrderPdfData } from '../lib/pdf/purchase-order';
import type { DeliveryNotePdfData } from '../lib/pdf/delivery-note';
import type { CoverLetterPdfData } from '../lib/pdf/cover-letter';
import type { IssuerInfo, PdfLineItem } from '../lib/pdf/base';
import { closeLiffWindow } from '../lib/liff-detect';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DocumentType =
  | 'estimate'
  | 'invoice'
  | 'purchase-order'
  | 'delivery-note'
  | 'cover-letter';

type DocumentData =
  | EstimatePdfData
  | InvoicePdfData
  | PurchaseOrderPdfData
  | DeliveryNotePdfData
  | CoverLetterPdfData;

interface LiffDocResponse {
  type: DocumentType;
  data: Record<string, unknown>;
  issuer: Record<string, unknown>;
  createdAt: number;
}

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  'estimate': '見積書',
  'invoice': '請求書',
  'purchase-order': '発注書',
  'delivery-note': '納品書',
  'cover-letter': '送付状',
};

/* ------------------------------------------------------------------ */
/*  URL parsing                                                        */
/* ------------------------------------------------------------------ */

/** Extract the shortId segment from `/liff/doc/:shortId` (with an optional
 *  `/dashboard` prefix for local dev parity). Returns null when the URL
 *  doesn't match the expected shape. */
function parseShortIdFromPath(path: string): string | null {
  const match = path.match(/\/liff\/doc\/([^/?#]+)/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  // Defensive: match the backend regex so malformed ids never hit the API.
  if (!/^[A-Za-z0-9_-]{20,32}$/.test(id)) return null;
  return id;
}

/* ------------------------------------------------------------------ */
/*  Issuer + data mapping                                              */
/* ------------------------------------------------------------------ */

/**
 * Map the snake_case DB row coming out of `user_business_info` into the
 * camelCase `IssuerInfo` shape the PDF modules expect.
 *
 * The mapping is defensive — any field may be missing, `null`, or an empty
 * string, all of which are normalised to `undefined` so the PDF header
 * layout hides empty lines instead of rendering blanks.
 */
function mapIssuer(raw: Record<string, unknown> | null | undefined): IssuerInfo {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const trimmed = v.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };
  return {
    companyName: str(r.company_name) ?? str(r.companyName),
    address: str(r.address),
    phone: str(r.phone),
    email: str(r.email),
    representative: str(r.representative),
    invoiceNumber: str(r.invoice_number) ?? str(r.invoiceNumber),
  };
}

/** Items normaliser — mirrors AiClerkChat's `normalizeItems` so legacy
 *  payloads coming from older tool versions still render correctly. */
function normalizeItems(items: unknown[]): PdfLineItem[] {
  return items.map((item: unknown) => {
    const it = (item ?? {}) as Record<string, unknown>;
    const qty = Number(it.quantity) || 1;
    const unit = Number(it.unit_price) || 0;
    return {
      name: String(it.name ?? it.description ?? ''),
      quantity: qty,
      unit_price: unit,
      subtotal: Number(it.subtotal) || qty * unit,
    };
  });
}

/**
 * Coerce whatever loose shape we got from KV into the document-specific
 * type. The server-side `saveDocForLiff()` is already called with
 * well-formed data, but we perform the same light normalisations the Web
 * dashboard does so the two code paths stay behaviour-equivalent.
 *
 * The `type` parameter is intentionally unused today — it's here so that
 * future per-type fixes (e.g. cover-letter enclosures normalisation) can
 * be added without changing call sites.
 */
function coerceDocumentData(
  _type: DocumentType,
  raw: Record<string, unknown>,
): DocumentData {
  const r: Record<string, unknown> = { ...raw };
  // Recipient → client alias (matches AiClerkChat.coerceToDocumentData).
  if (!r.client && r.recipient && typeof r.recipient === 'object') {
    r.client = r.recipient;
  }
  if (Array.isArray(r.items)) {
    r.items = normalizeItems(r.items as unknown[]);
  }
  return r as DocumentData;
}

/* ------------------------------------------------------------------ */
/*  PDF generation dispatcher                                          */
/* ------------------------------------------------------------------ */

/**
 * Generate a PDF blob for any document type via lazy imports. Mirrors
 * `generateDocumentPdf` in AiClerkChat — kept local so the LIFF bundle
 * doesn't have to pull in the whole chat module.
 */
async function generateDocumentPdf(
  docType: DocumentType,
  data: DocumentData,
  issuer: IssuerInfo,
): Promise<Blob> {
  switch (docType) {
    case 'estimate': {
      const { generateEstimatePdf } = await import('../lib/pdf/estimate');
      return generateEstimatePdf(data as EstimatePdfData, issuer);
    }
    case 'invoice': {
      const { generateInvoicePdf } = await import('../lib/pdf/invoice');
      return generateInvoicePdf(data as InvoicePdfData, issuer);
    }
    case 'purchase-order': {
      const { generatePurchaseOrderPdf } = await import('../lib/pdf/purchase-order');
      return generatePurchaseOrderPdf(data as PurchaseOrderPdfData, issuer);
    }
    case 'delivery-note': {
      const { generateDeliveryNotePdf } = await import('../lib/pdf/delivery-note');
      return generateDeliveryNotePdf(data as DeliveryNotePdfData, issuer);
    }
    case 'cover-letter': {
      const { generateCoverLetterPdf } = await import('../lib/pdf/cover-letter');
      return generateCoverLetterPdf(data as CoverLetterPdfData, issuer);
    }
  }
}

/** Pick a suitable filename suffix from the document number field. */
function getDocumentNumber(docType: DocumentType, data: DocumentData): string {
  const d = data as Record<string, unknown>;
  switch (docType) {
    case 'estimate': return String(d.estimate_number ?? '');
    case 'invoice': return String(d.invoice_number ?? '');
    case 'purchase-order': return String(d.order_number ?? '');
    case 'delivery-note': return String(d.delivery_number ?? '');
    case 'cover-letter': return '';
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type FetchState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; record: LiffDocResponse };

const GENERIC_ERROR_MESSAGE =
  '書類が見つかりません。期限切れの可能性があります(最大1時間)。';
const BAD_URL_MESSAGE = 'URLが正しくありません。LINEのメッセージから開き直してください。';

export function LiffDoc() {
  const shortId = useMemo(
    () => parseShortIdFromPath(window.location.pathname),
    [],
  );

  const [fetchState, setFetchState] = useState<FetchState>(
    shortId ? { kind: 'loading' } : { kind: 'error', message: BAD_URL_MESSAGE },
  );

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  /* --- Fetch the KV-stored record ---------------------------------- */
  useEffect(() => {
    if (!shortId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/line/liff-doc/${encodeURIComponent(shortId)}`,
          { headers: { Accept: 'application/json' } },
        );
        if (cancelled) return;
        if (!res.ok) {
          setFetchState({ kind: 'error', message: GENERIC_ERROR_MESSAGE });
          return;
        }
        const body = (await res.json()) as {
          success?: boolean;
          data?: LiffDocResponse;
          error?: string;
        };
        if (cancelled) return;
        if (!body.success || !body.data || !body.data.type) {
          setFetchState({ kind: 'error', message: GENERIC_ERROR_MESSAGE });
          return;
        }
        setFetchState({ kind: 'ready', record: body.data });
      } catch {
        if (!cancelled) {
          setFetchState({ kind: 'error', message: GENERIC_ERROR_MESSAGE });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shortId]);

  /* --- Generate the PDF once the record is loaded ------------------ */
  useEffect(() => {
    if (fetchState.kind !== 'ready') return;
    let cancelled = false;
    let createdUrl: string | null = null;

    (async () => {
      try {
        const issuer = mapIssuer(fetchState.record.issuer);
        const data = coerceDocumentData(
          fetchState.record.type,
          fetchState.record.data ?? {},
        );
        const generated = await generateDocumentPdf(
          fetchState.record.type,
          data,
          issuer,
        );
        if (cancelled) return;
        createdUrl = URL.createObjectURL(generated);
        setBlob(generated);
        setBlobUrl(createdUrl);
      } catch {
        if (!cancelled) {
          setPdfError('PDFの生成に失敗しました。時間をおいて再度お試しください。');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [fetchState]);

  /* --- Download handler -------------------------------------------- */
  const handleDownload = useCallback(() => {
    if (!blob || fetchState.kind !== 'ready') return;
    const label = DOCUMENT_LABELS[fetchState.record.type];
    const docNum = getDocumentNumber(
      fetchState.record.type,
      fetchState.record.data as DocumentData,
    );
    const suffix = docNum || new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${label}_${suffix}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [blob, fetchState]);

  /* --- Close / back handler ---------------------------------------- */
  const handleClose = useCallback(() => {
    try {
      closeLiffWindow();
    } catch {
      // noop — fall through to history.back below.
    }
    // In a regular browser, closeLiffWindow() is a noop, so give the user
    // something useful: step back in history (typically the LINE chat
    // referrer doesn't exist, but this at least avoids leaving them
    // stranded on a blank tab).
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  // Error state (including invalid URL and 404 from API)
  if (fetchState.kind === 'error') {
    return (
      <ErrorView message={fetchState.message} onClose={handleClose} />
    );
  }

  // Loading state — network fetch OR PDF generation still running.
  if (fetchState.kind === 'loading' || (!blobUrl && !pdfError)) {
    return <LoadingView />;
  }

  // PDF generation failed after successful fetch
  if (pdfError || !blobUrl) {
    return (
      <ErrorView message={pdfError ?? GENERIC_ERROR_MESSAGE} onClose={handleClose} />
    );
  }

  const docLabel = DOCUMENT_LABELS[fetchState.record.type];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Compact header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <h1 className="text-base font-semibold text-slate-900">{docLabel}</h1>
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          aria-label="LINEに戻る"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
          <span>閉じる</span>
        </button>
      </header>

      {/* PDF preview — fills all available vertical space above the
          sticky bottom bar. Bottom padding matches the sticky bar height
          (approx 88px with safe-area). */}
      <main className="flex-1 flex flex-col p-3 pb-[96px]">
        <iframe
          src={blobUrl}
          title={`${docLabel}プレビュー`}
          className="flex-1 w-full rounded-lg border border-slate-200 bg-white"
          style={{ minHeight: '60vh' }}
        />
      </main>

      {/* Sticky action bar — primary Save + secondary Back */}
      <div
        className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 py-3"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <button
            type="button"
            onClick={handleDownload}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 active:bg-slate-700 transition-colors"
            aria-label={`${docLabel}のPDFを保存する`}
          >
            <Download className="w-4 h-4" strokeWidth={1.75} />
            PDFを保存する
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition-colors"
            aria-label="LINEに戻る"
          >
            LINEに戻る
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-views                                                          */
/* ------------------------------------------------------------------ */

function LoadingView() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6"
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="w-6 h-6 text-slate-500 animate-spin mb-3"
        strokeWidth={1.75}
      />
      <p className="text-sm text-slate-600">PDFを生成しています…</p>
    </div>
  );
}

interface ErrorViewProps {
  message: string;
  onClose: () => void;
}

function ErrorView({ message, onClose }: ErrorViewProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
        <AlertTriangle
          className="w-6 h-6 text-amber-600"
          strokeWidth={1.75}
        />
      </div>
      <h1 className="text-base font-semibold text-slate-900 mb-2">
        書類を表示できません
      </h1>
      <p className="text-sm text-slate-600 max-w-sm mb-6">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
        aria-label="LINEに戻る"
      >
        LINEに戻る
      </button>
    </div>
  );
}

export default LiffDoc;
