/**
 * Client-side PDF generation for cover letters (送付状).
 * Unlike other document types, this is a letter format — no items table
 * or totals block.
 * Built on the shared pdf/base primitives for consistent look and feel.
 * Lazy-loaded to keep initial bundle small.
 */
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import {
  registerJapaneseFonts,
  sharedStyles,
  type IssuerInfo,
} from './base.js';

registerJapaneseFonts();

export interface CoverLetterPdfData {
  issue_date?: string;
  client?: { company_name?: string; honorific?: string; contact_person?: string };
  subject?: string;
  enclosures?: string[];
  body?: string;
  notes?: string;
}

export type { IssuerInfo };

const letterStyles = StyleSheet.create({
  date: {
    textAlign: 'right',
    fontSize: 10,
    marginBottom: 20,
    color: '#1a1a1a',
  },
  clientBlock: {
    marginBottom: 20,
  },
  clientName: {
    fontSize: 13,
    marginBottom: 4,
    color: '#1a1a1a',
  },
  contactPerson: {
    fontSize: 10,
    color: '#1a1a1a',
  },
  issuerBlock: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  issuerLine: {
    fontSize: 10,
    color: '#1a1a1a',
    marginBottom: 2,
  },
  issuerCompany: {
    fontSize: 11,
    marginBottom: 4,
    color: '#1a1a1a',
  },
  subjectBlock: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 20,
    paddingBottom: 8,
    borderBottom: '0.5pt solid #e5e7eb',
    color: '#1a1a1a',
  },
  greeting: {
    fontSize: 10,
    lineHeight: 1.8,
    marginBottom: 12,
    color: '#1a1a1a',
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.8,
    marginBottom: 16,
    color: '#1a1a1a',
  },
  closing: {
    fontSize: 10,
    textAlign: 'right',
    marginBottom: 24,
    color: '#1a1a1a',
  },
  enclosureSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  enclosureTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  enclosureItem: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  enclosureMarker: {
    width: 14,
    fontSize: 10,
    color: '#6b7280',
  },
  enclosureText: {
    flex: 1,
    fontSize: 10,
    color: '#1a1a1a',
  },
  notesBlock: {
    marginTop: 16,
    fontSize: 9,
    color: '#666',
  },
});

interface CoverLetterPdfProps {
  data: CoverLetterPdfData;
  issuer: IssuerInfo;
}

export function CoverLetterPdfDocument({ data, issuer }: CoverLetterPdfProps) {
  const clientName = data.client?.company_name ?? '';
  const honorific = data.client?.honorific ?? '御中';

  return (
    <Document>
      <Page size="A4" style={sharedStyles.page}>
        <Text style={sharedStyles.title}>送 付 状</Text>

        {/* Date — right-aligned */}
        <Text style={letterStyles.date}>{data.issue_date ?? ''}</Text>

        {/* Client address */}
        <View style={letterStyles.clientBlock}>
          <Text style={letterStyles.clientName}>
            {clientName} {honorific}
          </Text>
          {data.client?.contact_person && (
            <Text style={letterStyles.contactPerson}>
              {data.client.contact_person} 様
            </Text>
          )}
        </View>

        {/* Sender info — right-aligned */}
        <View style={letterStyles.issuerBlock}>
          {issuer.companyName && (
            <Text style={letterStyles.issuerCompany}>{issuer.companyName}</Text>
          )}
          {issuer.address && <Text style={letterStyles.issuerLine}>{issuer.address}</Text>}
          {issuer.phone && <Text style={letterStyles.issuerLine}>TEL: {issuer.phone}</Text>}
          {issuer.email && <Text style={letterStyles.issuerLine}>{issuer.email}</Text>}
          {issuer.representative && (
            <Text style={letterStyles.issuerLine}>{issuer.representative}</Text>
          )}
        </View>

        {/* Subject */}
        {data.subject && (
          <Text style={letterStyles.subjectBlock}>{data.subject}</Text>
        )}

        {/* Greeting */}
        <Text style={letterStyles.greeting}>
          拝啓 時下ますますご清祥のこととお慶び申し上げます。
          平素は格別のお引き立てを賜り、厚く御礼申し上げます。
        </Text>

        {/* Body */}
        {data.body && (
          <Text style={letterStyles.bodyText}>{data.body}</Text>
        )}

        {/* Closing */}
        <Text style={letterStyles.closing}>敬具</Text>

        {/* Enclosures list */}
        {data.enclosures && data.enclosures.length > 0 && (
          <View style={letterStyles.enclosureSection}>
            <Text style={letterStyles.enclosureTitle}>同封書類</Text>
            {data.enclosures.map((item, i) => (
              <View key={i} style={letterStyles.enclosureItem}>
                <Text style={letterStyles.enclosureMarker}>・</Text>
                <Text style={letterStyles.enclosureText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        {data.notes && (
          <View style={letterStyles.notesBlock}>
            <Text>備考: {data.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

/**
 * Generate a PDF blob from cover letter data.
 * Called lazily (dynamic import) to avoid loading @react-pdf/renderer in initial bundle.
 */
export async function generateCoverLetterPdf(
  data: CoverLetterPdfData,
  issuer: IssuerInfo,
): Promise<Blob> {
  const doc = <CoverLetterPdfDocument data={data} issuer={issuer} />;
  const blob = await pdf(doc).toBlob();
  return blob;
}
