import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { EstimateData, EstimateItem } from '../EstimateToolPage';

/* ------------------------------------------------------------------ */
/*  Font registration                                                  */
/* ------------------------------------------------------------------ */

// Local TTF served from packages/landing/public/fonts/.
// We deliberately use a local file (not a CDN) to avoid:
//   - CORS issues with @react-pdf/renderer's font loader
//   - Build-time external network dependency
//   - The CJK subset bug we hit on the Vercel server side
//
// The font is downloaded lazily on first PDF generation because this entire
// module is dynamically imported from the page component.
Font.register({
  family: 'NotoSansJP',
  fonts: [
    {
      src: '/fonts/NotoSansJP-Regular.ttf',
      fontWeight: 'normal',
    },
  ],
});

// Disable hyphenation — Japanese text should never be hyphenated.
Font.registerHyphenationCallback((word) => [word]);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatYen(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `\u00A5${value.toLocaleString('ja-JP')}`;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const COLOR_TEXT = '#1e293b';
const COLOR_MUTED = '#64748b';
const COLOR_BORDER = '#cbd5e1';
const COLOR_BORDER_LIGHT = '#e2e8f0';
const COLOR_ACCENT = '#1d4ed8';
const COLOR_BG_HEAD = '#f1f5f9';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    color: COLOR_TEXT,
    lineHeight: 1.5,
  },
  // Title row
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 2,
    borderBottomColor: COLOR_TEXT,
    paddingBottom: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    letterSpacing: 4,
  },
  metaBlock: {
    fontSize: 9,
    textAlign: 'right',
    color: COLOR_MUTED,
  },
  metaValue: {
    color: COLOR_TEXT,
    fontSize: 10,
  },
  // Two-column header (client / issuer)
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  clientCol: {
    width: '55%',
  },
  issuerCol: {
    width: '42%',
    fontSize: 9,
  },
  clientName: {
    fontSize: 14,
    marginTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLOR_TEXT,
    paddingBottom: 4,
  },
  clientContact: {
    fontSize: 10,
    marginTop: 4,
    color: COLOR_TEXT,
  },
  labelMuted: {
    fontSize: 8,
    color: COLOR_MUTED,
  },
  issuerLine: {
    marginTop: 2,
  },
  // Subject
  subjectBlock: {
    marginBottom: 14,
  },
  subjectText: {
    fontSize: 12,
    marginTop: 2,
  },
  // Total band (prominent)
  totalBand: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLOR_BG_HEAD,
    borderLeftWidth: 4,
    borderLeftColor: COLOR_ACCENT,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 11,
    color: COLOR_MUTED,
    width: 90,
  },
  totalValue: {
    fontSize: 18,
    color: COLOR_ACCENT,
    flex: 1,
    textAlign: 'right',
  },
  // Items table
  table: {
    borderTopWidth: 1,
    borderTopColor: COLOR_BORDER,
    borderLeftWidth: 1,
    borderLeftColor: COLOR_BORDER,
    borderRightWidth: 1,
    borderRightColor: COLOR_BORDER,
    marginBottom: 10,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: COLOR_BG_HEAD,
    borderBottomWidth: 1,
    borderBottomColor: COLOR_BORDER,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLOR_BORDER_LIGHT,
  },
  th: {
    fontSize: 9,
    color: COLOR_MUTED,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  td: {
    fontSize: 10,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tdMuted: {
    fontSize: 8,
    color: COLOR_MUTED,
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  colName: { width: '40%' },
  colQty: { width: '10%', textAlign: 'right' },
  colUnit: { width: '10%' },
  colPrice: { width: '15%', textAlign: 'right' },
  colTax: { width: '10%', textAlign: 'right' },
  colSubtotal: { width: '15%', textAlign: 'right' },
  // Totals area (right-aligned summary)
  totalsBox: {
    alignSelf: 'flex-end',
    width: 220,
    marginTop: 4,
    marginBottom: 16,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalsRowEmphasis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: COLOR_BORDER,
    marginTop: 4,
  },
  totalsLabel: {
    fontSize: 10,
    color: COLOR_MUTED,
  },
  totalsValue: {
    fontSize: 10,
  },
  totalsValueBold: {
    fontSize: 13,
    color: COLOR_ACCENT,
  },
  // Footer fields (delivery / payment / notes)
  footerSection: {
    borderTopWidth: 1,
    borderTopColor: COLOR_BORDER_LIGHT,
    paddingTop: 10,
  },
  footerRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  footerLabel: {
    width: 70,
    fontSize: 9,
    color: COLOR_MUTED,
  },
  footerValue: {
    flex: 1,
    fontSize: 10,
  },
  notesValue: {
    flex: 1,
    fontSize: 9,
    color: COLOR_TEXT,
  },
  // Page footer
  pageFooter: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 7,
    color: COLOR_MUTED,
    textAlign: 'center',
  },
});

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export interface EstimatePdfDocumentProps {
  estimate: EstimateData;
  issuerName?: string;
  issuerAddress?: string | null;
  issuerInvoiceNumber?: string | null;
  issuerPhone?: string | null;
  issuerEmail?: string | null;
}

function ItemRow({ item, index }: { item: EstimateItem; index: number }) {
  return (
    <View style={styles.tableRow} wrap={false} key={index}>
      <View style={styles.colName}>
        <Text style={styles.td}>{item.name || '-'}</Text>
        {item.description ? (
          <Text style={styles.tdMuted}>{item.description}</Text>
        ) : null}
      </View>
      <Text style={[styles.td, styles.colQty]}>{item.quantity}</Text>
      <Text style={[styles.td, styles.colUnit]}>{item.unit || ''}</Text>
      <Text style={[styles.td, styles.colPrice]}>{formatYen(item.unit_price)}</Text>
      <Text style={[styles.td, styles.colTax]}>{item.tax_rate}%</Text>
      <Text style={[styles.td, styles.colSubtotal]}>{formatYen(item.subtotal)}</Text>
    </View>
  );
}

export function EstimatePdfDocument({
  estimate,
  issuerName,
  issuerAddress,
  issuerInvoiceNumber,
  issuerPhone,
  issuerEmail,
}: EstimatePdfDocumentProps) {
  const items = estimate.items ?? [];

  return (
    <Document
      title={`見積書 ${estimate.estimate_number ?? ''}`.trim()}
      author={issuerName ?? 'FujiTrace'}
      creator="FujiTrace AI Tools"
      producer="FujiTrace AI Tools"
    >
      <Page size="A4" style={styles.page}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>御 見 積 書</Text>
          <View style={styles.metaBlock}>
            <Text>見積番号</Text>
            <Text style={styles.metaValue}>{estimate.estimate_number || '-'}</Text>
            <Text style={{ marginTop: 4 }}>発行日</Text>
            <Text style={styles.metaValue}>{estimate.issue_date || '-'}</Text>
            <Text style={{ marginTop: 4 }}>有効期限</Text>
            <Text style={styles.metaValue}>{estimate.valid_until || '-'}</Text>
          </View>
        </View>

        {/* Client + Issuer */}
        <View style={styles.headerRow}>
          <View style={styles.clientCol}>
            <Text style={styles.labelMuted}>宛先</Text>
            <Text style={styles.clientName}>
              {(estimate.client?.company_name || '-') +
                ' ' +
                (estimate.client?.honorific || '')}
            </Text>
            {estimate.client?.contact_person ? (
              <Text style={styles.clientContact}>
                {estimate.client.contact_person} 様
              </Text>
            ) : null}
          </View>
          <View style={styles.issuerCol}>
            <Text style={styles.labelMuted}>発行元</Text>
            <Text style={[styles.issuerLine, { fontSize: 11 }]}>
              {issuerName || '-'}
            </Text>
            {issuerAddress ? (
              <Text style={styles.issuerLine}>{issuerAddress}</Text>
            ) : null}
            {issuerPhone ? (
              <Text style={styles.issuerLine}>TEL: {issuerPhone}</Text>
            ) : null}
            {issuerEmail ? (
              <Text style={styles.issuerLine}>{issuerEmail}</Text>
            ) : null}
            {issuerInvoiceNumber ? (
              <Text style={styles.issuerLine}>
                インボイス番号: {issuerInvoiceNumber}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Subject */}
        <View style={styles.subjectBlock}>
          <Text style={styles.labelMuted}>件名</Text>
          <Text style={styles.subjectText}>{estimate.subject || '-'}</Text>
        </View>

        {/* Total band */}
        <View style={styles.totalBand}>
          <Text style={styles.totalLabel}>御見積金額</Text>
          <Text style={styles.totalValue}>{formatYen(estimate.total)}（税込）</Text>
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.tableHead} fixed>
            <Text style={[styles.th, styles.colName]}>品名</Text>
            <Text style={[styles.th, styles.colQty]}>数量</Text>
            <Text style={[styles.th, styles.colUnit]}>単位</Text>
            <Text style={[styles.th, styles.colPrice]}>単価</Text>
            <Text style={[styles.th, styles.colTax]}>税率</Text>
            <Text style={[styles.th, styles.colSubtotal]}>小計</Text>
          </View>
          {items.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.td, { width: '100%', textAlign: 'center', color: COLOR_MUTED }]}>
                （明細未入力）
              </Text>
            </View>
          ) : (
            items.map((item, idx) => <ItemRow item={item} index={idx} key={idx} />)
          )}
        </View>

        {/* Totals summary */}
        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>小計</Text>
            <Text style={styles.totalsValue}>{formatYen(estimate.subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>消費税</Text>
            <Text style={styles.totalsValue}>{formatYen(estimate.tax_amount)}</Text>
          </View>
          <View style={styles.totalsRowEmphasis}>
            <Text style={styles.totalsLabel}>合計</Text>
            <Text style={styles.totalsValueBold}>{formatYen(estimate.total)}</Text>
          </View>
        </View>

        {/* Footer fields */}
        <View style={styles.footerSection}>
          {estimate.delivery_date ? (
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>納期</Text>
              <Text style={styles.footerValue}>{estimate.delivery_date}</Text>
            </View>
          ) : null}
          {estimate.payment_terms ? (
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>支払条件</Text>
              <Text style={styles.footerValue}>{estimate.payment_terms}</Text>
            </View>
          ) : null}
          {estimate.notes ? (
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>備考</Text>
              <Text style={styles.notesValue}>{estimate.notes}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.pageFooter} fixed>
          Generated by FujiTrace AI Tools  -  https://www.fujitrace.jp
        </Text>
      </Page>
    </Document>
  );
}
