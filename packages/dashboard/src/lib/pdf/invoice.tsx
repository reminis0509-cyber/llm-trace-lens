/**
 * Client-side PDF generation for invoices (請求書).
 * Built on the shared pdf/base primitives for consistent look and feel.
 * Lazy-loaded to keep initial bundle small.
 */
import { Document, Page, Text, View, pdf } from '@react-pdf/renderer';
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

export interface InvoicePdfData {
  invoice_number?: string;
  issue_date?: string;
  due_date?: string;
  client?: { company_name?: string; honorific?: string; contact_person?: string };
  subject?: string;
  items?: PdfLineItem[];
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  payment_terms?: string;
  bank_info?: string;
  notes?: string;
}

export type { IssuerInfo };

interface InvoicePdfProps {
  data: InvoicePdfData;
  issuer: IssuerInfo;
}

export function InvoicePdfDocument({ data, issuer }: InvoicePdfProps) {
  return (
    <Document>
      <Page size="A4" style={sharedStyles.page}>
        <Text style={sharedStyles.title}>請 求 書</Text>

        <PdfHeader
          numberLabel="請求番号"
          meta={{
            documentNumber: data.invoice_number,
            clientCompanyName: data.client?.company_name,
            clientHonorific: data.client?.honorific,
            issueDate: data.issue_date,
            secondaryDateLabel: '支払期限',
            secondaryDateValue: data.due_date,
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
            { label: '振込先', value: data.bank_info },
            { label: '備考', value: data.notes },
          ]}
        />

        {data.client?.contact_person && (
          <View style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 8, color: '#666' }}>
              ご担当: {data.client.contact_person} 様
            </Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

/**
 * Generate a PDF blob from invoice data.
 * Called lazily (dynamic import) to avoid loading @react-pdf/renderer in initial bundle.
 */
export async function generateInvoicePdf(
  data: InvoicePdfData,
  issuer: IssuerInfo,
): Promise<Blob> {
  const doc = <InvoicePdfDocument data={data} issuer={issuer} />;
  const blob = await pdf(doc).toBlob();
  return blob;
}
