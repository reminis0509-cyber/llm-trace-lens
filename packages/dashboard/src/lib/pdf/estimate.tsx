/**
 * Client-side PDF generation for estimates (見積書).
 * Built on the shared pdf/base primitives so invoice/delivery/order/cover-letter
 * modules can reuse the same look and feel.
 * Lazy-loaded to keep initial bundle small.
 */
import { Document, Page, Text, pdf } from '@react-pdf/renderer';
import {
  registerJapaneseFonts,
  sharedStyles,
  PdfHeader,
  PdfItemsTable,
  PdfTotalsBlock,
  PdfFooter,
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

export function EstimatePdfDocument({ data, issuer }: EstimatePdfProps) {
  return (
    <Document>
      <Page size="A4" style={sharedStyles.page}>
        <Text style={sharedStyles.title}>見 積 書</Text>

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

        {data.subject && <Text style={sharedStyles.subject}>件名: {data.subject}</Text>}

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
      </Page>
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
