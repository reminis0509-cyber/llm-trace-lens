/**
 * Client-side PDF generation for purchase orders (発注書).
 * Built on the shared pdf/base primitives for consistent look and feel.
 * Lazy-loaded to keep initial bundle small.
 *
 * NOTE (Phase B duplication, 2026-04-29):
 *   Mirror of packages/dashboard/src/lib/pdf/purchase-order.tsx for the
 *   unauthenticated /tools/hatchu freemium tool. See ./base.tsx header.
 */
import { Document, Page, Text, View, pdf } from '@react-pdf/renderer';
import {
  registerJapaneseFonts,
  sharedStyles,
  PdfHeader,
  PdfSubject,
  PdfItemsTable,
  PdfTotalsBlock,
  PdfFooter,
  PdfPageFooter,
  type IssuerInfo,
  type PdfLineItem,
} from './base.js';

registerJapaneseFonts();

export interface PurchaseOrderPdfData {
  order_number?: string;
  issue_date?: string;
  delivery_date?: string;
  client?: { company_name?: string; honorific?: string; contact_person?: string };
  subject?: string;
  items?: PdfLineItem[];
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  delivery_location?: string;
  notes?: string;
}

export type { IssuerInfo };

interface PurchaseOrderPdfProps {
  data: PurchaseOrderPdfData;
  issuer: IssuerInfo;
}

/**
 * Page content for purchase orders — exported separately so bundle.tsx can compose
 * multiple documents into one PDF.
 */
export function PurchaseOrderPages({ data, issuer }: PurchaseOrderPdfProps): React.ReactNode {
  return (
    <Page size="A4" style={sharedStyles.page}>
      <Text style={sharedStyles.title}>発　注　書</Text>

      <View style={sharedStyles.bodyFrame}>
        <PdfHeader
          numberLabel="発注番号"
          meta={{
            documentNumber: data.order_number,
            clientCompanyName: data.client?.company_name,
            clientHonorific: data.client?.honorific,
            issueDate: data.issue_date,
            secondaryDateLabel: '納品希望日',
            secondaryDateValue: data.delivery_date,
          }}
          issuer={issuer}
        />

        <PdfSubject subject={data.subject} />

        <PdfItemsTable items={data.items ?? []} />

        <PdfTotalsBlock
          subtotal={data.subtotal}
          tax={data.tax_amount}
          total={data.total}
        />

        <PdfFooter
          items={[
            { label: '納品場所', value: data.delivery_location },
            { label: '備考', value: data.notes },
            {
              label: 'ご担当',
              value: data.client?.contact_person ? `${data.client.contact_person} 様` : undefined,
            },
          ]}
        />
      </View>

      <PdfPageFooter />
    </Page>
  );
}

export function PurchaseOrderPdfDocument({ data, issuer }: PurchaseOrderPdfProps) {
  return (
    <Document>
      <PurchaseOrderPages data={data} issuer={issuer} />
    </Document>
  );
}

/**
 * Generate a PDF blob from purchase order data.
 * Called lazily (dynamic import) to avoid loading @react-pdf/renderer in initial bundle.
 */
export async function generatePurchaseOrderPdf(
  data: PurchaseOrderPdfData,
  issuer: IssuerInfo,
): Promise<Blob> {
  const doc = <PurchaseOrderPdfDocument data={data} issuer={issuer} />;
  const blob = await pdf(doc).toBlob();
  return blob;
}
