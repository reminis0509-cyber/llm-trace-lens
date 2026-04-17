/**
 * Client-side PDF generation for purchase orders (発注書).
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

export function PurchaseOrderPdfDocument({ data, issuer }: PurchaseOrderPdfProps) {
  return (
    <Document>
      <Page size="A4" style={sharedStyles.page}>
        <Text style={sharedStyles.title}>発 注 書</Text>

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

        {data.subject && <Text style={sharedStyles.subject}>件名: {data.subject}</Text>}

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
