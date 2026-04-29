/**
 * Client-side PDF generation for cover letters (送付状).
 * Unlike other document types, this is a letter format — no items table
 * or totals block.
 * Built on the shared pdf/base primitives for consistent look and feel.
 * Lazy-loaded to keep initial bundle small.
 *
 * NOTE (Phase B duplication, 2026-04-29):
 *   Mirror of packages/dashboard/src/lib/pdf/cover-letter.tsx for the
 *   unauthenticated /tools/soufu freemium tool. See ./base.tsx header.
 */
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import {
  registerJapaneseFonts,
  sharedStyles,
  PdfPageFooter,
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

const COLOR_INK = '#1a1a1a';
const COLOR_BORDER = '#1a1a1a';
const COLOR_BORDER_THIN = '#333333';
const COLOR_LABEL = '#444444';

const letterStyles = StyleSheet.create({
  date: {
    textAlign: 'right',
    fontSize: 10,
    marginBottom: 18,
    color: COLOR_INK,
  },
  clientBlock: {
    marginBottom: 20,
  },
  clientName: {
    fontSize: 14,
    marginBottom: 4,
    paddingBottom: 4,
    borderBottom: `0.5pt solid ${COLOR_BORDER_THIN}`,
    color: COLOR_INK,
  },
  contactPerson: {
    fontSize: 10,
    marginTop: 4,
    color: COLOR_INK,
  },
  issuerBlock: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  issuerCompany: {
    fontSize: 12,
    marginBottom: 4,
    color: COLOR_INK,
  },
  issuerLine: {
    fontSize: 10,
    color: COLOR_INK,
    marginBottom: 2,
  },
  // Seal box on the issuer side.
  sealRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  sealBox: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: COLOR_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealLabel: {
    fontSize: 9,
    color: COLOR_LABEL,
  },
  // Subject — formal centered, top/bottom borders, no gray.
  subjectBlock: {
    textAlign: 'center',
    fontSize: 14,
    marginVertical: 18,
    paddingVertical: 8,
    borderTop: `1pt solid ${COLOR_BORDER}`,
    borderBottom: `1pt solid ${COLOR_BORDER}`,
    color: COLOR_INK,
  },
  greeting: {
    fontSize: 10,
    lineHeight: 1.8,
    marginBottom: 12,
    color: COLOR_INK,
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.8,
    marginBottom: 16,
    color: COLOR_INK,
  },
  closing: {
    fontSize: 10,
    textAlign: 'right',
    marginBottom: 24,
    color: COLOR_INK,
  },
  // Enclosure section — centered "記" then bordered list, traditional layout.
  enclosureCenter: {
    textAlign: 'center',
    fontSize: 11,
    marginBottom: 8,
    color: COLOR_INK,
  },
  enclosureSection: {
    marginTop: 4,
    padding: 12,
    borderWidth: 0.5,
    borderColor: COLOR_BORDER_THIN,
  },
  enclosureTitle: {
    fontSize: 10,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: `0.5pt solid ${COLOR_BORDER_THIN}`,
    color: COLOR_INK,
  },
  enclosureItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  enclosureMarker: {
    width: 18,
    fontSize: 10,
    color: COLOR_LABEL,
  },
  enclosureText: {
    flex: 1,
    fontSize: 10,
    color: COLOR_INK,
  },
  enclosureClose: {
    textAlign: 'right',
    fontSize: 10,
    marginTop: 8,
    color: COLOR_INK,
  },
  notesBlock: {
    marginTop: 16,
    paddingTop: 8,
    borderTop: `0.5pt solid ${COLOR_BORDER_THIN}`,
    fontSize: 9,
    color: COLOR_LABEL,
  },
});

interface CoverLetterPdfProps {
  data: CoverLetterPdfData;
  issuer: IssuerInfo;
}

/**
 * Page content for cover letter — exported separately so bundle.tsx can
 * compose multiple documents into one PDF.
 */
export function CoverLetterPages({ data, issuer }: CoverLetterPdfProps): React.ReactNode {
  const clientName = data.client?.company_name ?? '';
  const honorific = data.client?.honorific ?? '御中';

  return (
    <Page size="A4" style={sharedStyles.page}>
      <Text style={sharedStyles.title}>送　付　状</Text>

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

      {/* Sender info — right-aligned with seal box */}
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
        <View style={letterStyles.sealRow}>
          <View style={letterStyles.sealBox}>
            <Text style={letterStyles.sealLabel}>印</Text>
          </View>
        </View>
      </View>

      {/* Subject */}
      {data.subject && <Text style={letterStyles.subjectBlock}>{data.subject}</Text>}

      {/* Greeting */}
      <Text style={letterStyles.greeting}>
        拝啓 時下ますますご清祥のこととお慶び申し上げます。
        平素は格別のお引き立てを賜り、厚く御礼申し上げます。
      </Text>

      {/* Body */}
      {data.body && <Text style={letterStyles.bodyText}>{data.body}</Text>}

      {/* Closing */}
      <Text style={letterStyles.closing}>敬具</Text>

      {/* Enclosures list — traditional 「記」 / 「以上」 layout */}
      {data.enclosures && data.enclosures.length > 0 && (
        <>
          <Text style={letterStyles.enclosureCenter}>記</Text>
          <View style={letterStyles.enclosureSection}>
            <Text style={letterStyles.enclosureTitle}>同封書類</Text>
            {data.enclosures.map((item, i) => (
              <View key={i} style={letterStyles.enclosureItem}>
                <Text style={letterStyles.enclosureMarker}>{i + 1}.</Text>
                <Text style={letterStyles.enclosureText}>{item}</Text>
              </View>
            ))}
          </View>
          <Text style={letterStyles.enclosureClose}>以上</Text>
        </>
      )}

      {/* Notes */}
      {data.notes && (
        <View style={letterStyles.notesBlock}>
          <Text>備考: {data.notes}</Text>
        </View>
      )}

      <PdfPageFooter />
    </Page>
  );
}

export function CoverLetterPdfDocument({ data, issuer }: CoverLetterPdfProps) {
  return (
    <Document>
      <CoverLetterPages data={data} issuer={issuer} />
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
