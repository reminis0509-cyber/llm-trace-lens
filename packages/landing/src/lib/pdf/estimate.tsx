/**
 * Client-side PDF generation for estimates (見積書).
 * Built on the shared pdf/base primitives so invoice/delivery/order/cover-letter
 * modules can reuse the same look and feel.
 * Lazy-loaded to keep initial bundle small.
 *
 * NOTE (Phase B duplication, 2026-04-29):
 *   Mirror of packages/dashboard/src/lib/pdf/estimate.tsx for the
 *   unauthenticated /tools/mitsumori freemium tool. See ./base.tsx header.
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

export interface EstimatePdfData {
  estimate_number?: string;
  issue_date?: string;
  valid_until?: string;
  client?: { company_name?: string; honorific?: string };
  subject?: string;
  items?: PdfLineItem[];
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  payment_terms?: string;
  delivery_date?: string;
  notes?: string;
}

export type { IssuerInfo };

interface EstimatePdfProps {
  data: EstimatePdfData;
  issuer: IssuerInfo;
}

/**
 * Page content for estimates — exported separately so bundle.tsx can compose
 * multiple documents into one PDF.
 */
export function EstimatePages({ data, issuer }: EstimatePdfProps): React.ReactNode {
  return (
    <Page size="A4" style={sharedStyles.page}>
      <Text style={sharedStyles.title}>見　積　書</Text>

      <View style={sharedStyles.bodyFrame}>
        <PdfHeader
          numberLabel="見積番号"
          meta={{
            documentNumber: data.estimate_number,
            clientCompanyName: data.client?.company_name,
            clientHonorific: data.client?.honorific,
            issueDate: data.issue_date,
            secondaryDateLabel: '有効期限',
            secondaryDateValue: data.valid_until,
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
            { label: '支払条件', value: data.payment_terms },
            { label: '納期', value: data.delivery_date },
            { label: '備考', value: data.notes },
          ]}
        />
      </View>

      <PdfPageFooter />
    </Page>
  );
}

export function EstimatePdfDocument({ data, issuer }: EstimatePdfProps) {
  return (
    <Document>
      <EstimatePages data={data} issuer={issuer} />
    </Document>
  );
}

/**
 * Generate a PDF blob from estimate data.
 * Called lazily (dynamic import) to avoid loading @react-pdf/renderer in initial bundle.
 */
export async function generateEstimatePdf(
  data: EstimatePdfData,
  issuer: IssuerInfo,
): Promise<Blob> {
  const doc = <EstimatePdfDocument data={data} issuer={issuer} />;
  const blob = await pdf(doc).toBlob();
  return blob;
}
