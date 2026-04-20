/**
 * Bundle multiple business documents into a single PDF.
 *
 * Used when AI社員 generates a document set (e.g. estimate + invoice +
 * delivery note for the same deal) and the user wants one downloadable file
 * instead of clicking download for each card.
 */
import { Document, pdf } from '@react-pdf/renderer';
import {
  registerJapaneseFonts,
  type IssuerInfo,
} from './base.js';
import { EstimatePages, type EstimatePdfData } from './estimate.js';
import { InvoicePages, type InvoicePdfData } from './invoice.js';
import { DeliveryNotePages, type DeliveryNotePdfData } from './delivery-note.js';
import { PurchaseOrderPages, type PurchaseOrderPdfData } from './purchase-order.js';
import { CoverLetterPages, type CoverLetterPdfData } from './cover-letter.js';

registerJapaneseFonts();

export type BundleEntry =
  | { type: 'estimate'; data: EstimatePdfData }
  | { type: 'invoice'; data: InvoicePdfData }
  | { type: 'delivery-note'; data: DeliveryNotePdfData }
  | { type: 'purchase-order'; data: PurchaseOrderPdfData }
  | { type: 'cover-letter'; data: CoverLetterPdfData };

/**
 * Render multiple documents as consecutive Page sequences within a single
 * PDF Document. The shared issuer info is applied to every document.
 *
 * Page numbering resets per <Page>'s `fixed` footer renderer because each
 * sub-document renders its own PdfPageFooter, but `pageNumber` reflects the
 * absolute position in the bundle. That is acceptable: it tells the recipient
 * how far they are through the whole packet.
 */
export function BundlePdfDocument({
  entries,
  issuer,
}: {
  entries: BundleEntry[];
  issuer: IssuerInfo;
}) {
  return (
    <Document>
      {entries.map((entry, i) => {
        switch (entry.type) {
          case 'estimate':
            return <EstimatePages key={i} data={entry.data} issuer={issuer} />;
          case 'invoice':
            return <InvoicePages key={i} data={entry.data} issuer={issuer} />;
          case 'delivery-note':
            return <DeliveryNotePages key={i} data={entry.data} issuer={issuer} />;
          case 'purchase-order':
            return <PurchaseOrderPages key={i} data={entry.data} issuer={issuer} />;
          case 'cover-letter':
            return <CoverLetterPages key={i} data={entry.data} issuer={issuer} />;
        }
      })}
    </Document>
  );
}

/**
 * Generate a single PDF blob containing all entries, in order.
 * Throws if `entries` is empty.
 */
export async function generateBundlePdf(
  entries: BundleEntry[],
  issuer: IssuerInfo,
): Promise<Blob> {
  if (entries.length === 0) {
    throw new Error('generateBundlePdf: entries must contain at least one document');
  }
  const doc = <BundlePdfDocument entries={entries} issuer={issuer} />;
  return await pdf(doc).toBlob();
}
