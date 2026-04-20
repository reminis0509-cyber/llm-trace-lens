/**
 * Client-side PDF generation for delivery notes (納品書).
 * Built on the shared pdf/base primitives for consistent look and feel.
 * Lazy-loaded to keep initial bundle small.
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

export interface DeliveryNotePdfData {
  delivery_number?: string;
  issue_date?: string;
  delivery_date?: string;
  client?: { company_name?: string; honorific?: string; contact_person?: string };
  subject?: string;
  items?: PdfLineItem[];
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  notes?: string;
}

export type { IssuerInfo };

interface DeliveryNotePdfProps {
  data: DeliveryNotePdfData;
  issuer: IssuerInfo;
}

/**
 * Page content for delivery notes — exported separately so bundle.tsx can compose
 * multiple documents into one PDF.
 */
export function DeliveryNotePages({ data, issuer }: DeliveryNotePdfProps): React.ReactNode {
  return (
    <Page size="A4" style={sharedStyles.page}>
      <Text style={sharedStyles.title}>納　品　書</Text>

      <View style={sharedStyles.bodyFrame}>
        <PdfHeader
          numberLabel="納品番号"
          meta={{
            documentNumber: data.delivery_number,
            clientCompanyName: data.client?.company_name,
            clientHonorific: data.client?.honorific,
            issueDate: data.issue_date,
            secondaryDateLabel: '納品日',
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

export function DeliveryNotePdfDocument({ data, issuer }: DeliveryNotePdfProps) {
  return (
    <Document>
      <DeliveryNotePages data={data} issuer={issuer} />
    </Document>
  );
}

/**
 * Generate a PDF blob from delivery note data.
 * Called lazily (dynamic import) to avoid loading @react-pdf/renderer in initial bundle.
 */
export async function generateDeliveryNotePdf(
  data: DeliveryNotePdfData,
  issuer: IssuerInfo,
): Promise<Blob> {
  const doc = <DeliveryNotePdfDocument data={data} issuer={issuer} />;
  const blob = await pdf(doc).toBlob();
  return blob;
}
