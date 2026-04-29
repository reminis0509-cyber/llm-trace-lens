/**
 * Shared PDF building blocks for Japanese business documents
 * (estimates, invoices, delivery notes, purchase orders, cover letters).
 *
 * All modules must use these primitives so that font registration,
 * typography, and layout stay consistent across document types.
 *
 * Style direction: 大企業の正式書類 — 黒系統一、外枠+格子罫線、印鑑欄、
 * No列、ページ番号、二重線の合計欄。Boldフォント未登録のため線・色・サイズで重み出し。
 *
 * NOTE (Phase A duplication, 2026-04-29):
 *   This file is duplicated from packages/dashboard/src/lib/pdf/base.tsx
 *   for the unauthenticated /tools/seikyusho page. Phase A is speed-first;
 *   Phase B (戦略 doc Section 5.6) lifts this to a shared monorepo package
 *   once all 5 document tools are live. Until then, any change here MUST
 *   be mirrored in dashboard/src/lib/pdf/base.tsx.
 */
import { Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { ReactNode } from 'react';

const FONT_FAMILY = 'NotoSansJP';

let fontsRegistered = false;

/**
 * Idempotent Japanese font registration.
 * Safe to call from every document module — only the first call hits Font.register.
 */
export function registerJapaneseFonts(): void {
  if (fontsRegistered) return;
  const base = import.meta.env.BASE_URL ?? '/';
  Font.register({
    family: FONT_FAMILY,
    src: `${base}fonts/NotoSansJP-Regular.ttf`,
  });
  fontsRegistered = true;
}

/**
 * Node-side font registration. Used by scripts that render PDFs with
 * @react-pdf/renderer outside a browser, where import.meta.env.BASE_URL
 * does not point to a real HTTP asset. The absolute filesystem path
 * of NotoSansJP-Regular.ttf must be passed in.
 */
export function registerJapaneseFontsNode(absoluteFontPath: string): void {
  if (fontsRegistered) return;
  Font.register({
    family: FONT_FAMILY,
    src: absoluteFontPath,
  });
  fontsRegistered = true;
}

const COLOR_INK = '#1a1a1a';
const COLOR_BORDER = '#1a1a1a';
const COLOR_BORDER_THIN = '#333333';
const COLOR_LABEL = '#444444';
const COLOR_FOOTER = '#666666';

export const sharedStyles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    paddingTop: 36,
    paddingBottom: 60,
    paddingHorizontal: 36,
    color: COLOR_INK,
  },
  title: {
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 18,
    letterSpacing: 8,
    color: COLOR_INK,
  },
  // Outer frame around the document body — 1.5pt black for the formal feel.
  bodyFrame: {
    borderWidth: 1.5,
    borderColor: COLOR_BORDER,
    padding: 14,
  },
  // Header block — left: client/document meta, right: issuer + seal box.
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1.1,
    paddingRight: 12,
  },
  headerRight: {
    flex: 1,
    paddingLeft: 12,
    borderLeft: `0.5pt solid ${COLOR_BORDER_THIN}`,
  },
  clientNameLine: {
    fontSize: 14,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottom: `1pt solid ${COLOR_BORDER}`,
    color: COLOR_INK,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  metaLabel: {
    width: 64,
    fontSize: 9,
    color: COLOR_LABEL,
  },
  metaValue: {
    flex: 1,
    fontSize: 10,
    color: COLOR_INK,
  },
  issuerHeading: {
    fontSize: 8,
    color: COLOR_LABEL,
    marginBottom: 2,
    letterSpacing: 1,
  },
  issuerCompany: {
    fontSize: 12,
    marginBottom: 4,
    color: COLOR_INK,
  },
  issuerLine: {
    fontSize: 9,
    marginBottom: 2,
    color: COLOR_INK,
  },
  // Seal box — 印鑑欄. 25mm square (~71pt at 1mm=2.83pt).
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
  // Subject — 件名. Bordered top/bottom rather than gray tag background.
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 12,
    borderTop: `0.5pt solid ${COLOR_BORDER_THIN}`,
    borderBottom: `0.5pt solid ${COLOR_BORDER_THIN}`,
  },
  subjectLabel: {
    width: 56,
    fontSize: 10,
    color: COLOR_LABEL,
  },
  subjectText: {
    flex: 1,
    fontSize: 12,
    color: COLOR_INK,
  },
  // Item table — outer 1.5pt frame, inner 0.5pt grid, black header bar.
  table: {
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: COLOR_BORDER,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLOR_INK,
    color: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    color: '#ffffff',
    fontSize: 10,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 22,
    borderBottom: `0.5pt solid ${COLOR_BORDER_THIN}`,
  },
  tableCell: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRight: `0.5pt solid ${COLOR_BORDER_THIN}`,
    fontSize: 10,
    color: COLOR_INK,
  },
  tableCellLast: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 10,
    color: COLOR_INK,
  },
  // Column widths
  colNo: { width: 30, textAlign: 'center' },
  colName: { flex: 3 },
  colQty: { width: 50, textAlign: 'right' },
  colUnit: { width: 80, textAlign: 'right' },
  colAmount: { width: 90, textAlign: 'right' },
  // Totals — bordered box, double line for grand total.
  totalsWrap: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 14,
  },
  totalsBox: {
    width: 240,
    borderWidth: 1,
    borderColor: COLOR_BORDER,
  },
  totalsRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottom: `0.5pt solid ${COLOR_BORDER_THIN}`,
  },
  totalsLabel: {
    flex: 1,
    fontSize: 10,
    color: COLOR_LABEL,
    textAlign: 'right',
    paddingRight: 10,
  },
  totalsValue: {
    width: 100,
    fontSize: 10,
    color: COLOR_INK,
    textAlign: 'right',
  },
  totalsGrandRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#f0f0f0',
    borderTopWidth: 2,
    borderTopColor: COLOR_BORDER,
    borderTopStyle: 'solid',
  },
  totalsGrandLabel: {
    flex: 1,
    fontSize: 12,
    color: COLOR_INK,
    textAlign: 'right',
    paddingRight: 10,
  },
  totalsGrandValue: {
    width: 100,
    fontSize: 13,
    color: COLOR_INK,
    textAlign: 'right',
  },
  // Footer notes block — bordered list of meta info.
  footerBlock: {
    borderTop: `0.5pt solid ${COLOR_BORDER_THIN}`,
    paddingTop: 8,
    marginTop: 4,
  },
  footerRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  footerLabel: {
    width: 70,
    fontSize: 9,
    color: COLOR_LABEL,
  },
  footerValue: {
    flex: 1,
    fontSize: 9,
    color: COLOR_INK,
  },
  // Page number footer — fixed across pages.
  pageFooter: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTop: `0.5pt solid ${COLOR_BORDER_THIN}`,
  },
  pageFooterText: {
    fontSize: 8,
    color: COLOR_FOOTER,
  },
});

export const formatJpy = (n: number): string => `¥${n.toLocaleString()}`;

export interface IssuerInfo {
  companyName?: string;
  address?: string;
  phone?: string;
  email?: string;
  representative?: string;
  invoiceNumber?: string;
}

export interface PdfLineItem {
  name?: string;
  quantity?: number;
  unit_price?: number;
  subtotal?: number;
}

export interface PdfDocumentMeta {
  /** Primary document number (estimate_number, invoice_number, ...). */
  documentNumber?: string;
  /** Primary counterparty. */
  clientCompanyName?: string;
  clientHonorific?: string;
  issueDate?: string;
  /** Optional secondary date: valid_until, due_date, delivery_date, ... */
  secondaryDateLabel?: string;
  secondaryDateValue?: string;
  /** Subject / 件名. */
  subject?: string;
}

interface PdfHeaderProps {
  meta: PdfDocumentMeta;
  issuer: IssuerInfo;
  /** Label for documentNumber (例: 見積番号, 請求書番号). */
  numberLabel?: string;
}

/**
 * Header block — client meta on the left, issuer info + seal box on the right.
 * The seal box (印鑑欄) is always rendered as an empty square; users print and
 * stamp by hand.
 */
export function PdfHeader({ meta, issuer, numberLabel = '番号' }: PdfHeaderProps): ReactNode {
  return (
    <View style={sharedStyles.header}>
      <View style={sharedStyles.headerLeft}>
        <Text style={sharedStyles.clientNameLine}>
          {meta.clientCompanyName ?? ''} {meta.clientHonorific ?? '御中'}
        </Text>
        <View style={sharedStyles.metaRow}>
          <Text style={sharedStyles.metaLabel}>{numberLabel}</Text>
          <Text style={sharedStyles.metaValue}>{meta.documentNumber ?? ''}</Text>
        </View>
        <View style={sharedStyles.metaRow}>
          <Text style={sharedStyles.metaLabel}>発行日</Text>
          <Text style={sharedStyles.metaValue}>{meta.issueDate ?? ''}</Text>
        </View>
        {meta.secondaryDateLabel && (
          <View style={sharedStyles.metaRow}>
            <Text style={sharedStyles.metaLabel}>{meta.secondaryDateLabel}</Text>
            <Text style={sharedStyles.metaValue}>{meta.secondaryDateValue ?? ''}</Text>
          </View>
        )}
      </View>
      <View style={sharedStyles.headerRight}>
        <Text style={sharedStyles.issuerHeading}>発　行　元</Text>
        {issuer.companyName && (
          <Text style={sharedStyles.issuerCompany}>{issuer.companyName}</Text>
        )}
        {issuer.address && <Text style={sharedStyles.issuerLine}>{issuer.address}</Text>}
        {issuer.phone && <Text style={sharedStyles.issuerLine}>TEL: {issuer.phone}</Text>}
        {issuer.email && <Text style={sharedStyles.issuerLine}>{issuer.email}</Text>}
        {issuer.representative && (
          <Text style={sharedStyles.issuerLine}>{issuer.representative}</Text>
        )}
        {issuer.invoiceNumber && (
          <Text style={sharedStyles.issuerLine}>登録番号: {issuer.invoiceNumber}</Text>
        )}
        <View style={sharedStyles.sealRow}>
          <View style={sharedStyles.sealBox}>
            <Text style={sharedStyles.sealLabel}>印</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

interface PdfSubjectProps {
  subject?: string;
}

/**
 * Subject line — formal "件　名：" label with top/bottom borders.
 * Renders nothing when no subject is supplied.
 */
export function PdfSubject({ subject }: PdfSubjectProps): ReactNode {
  if (!subject) return null;
  return (
    <View style={sharedStyles.subjectRow}>
      <Text style={sharedStyles.subjectLabel}>件　名</Text>
      <Text style={sharedStyles.subjectText}>{subject}</Text>
    </View>
  );
}

interface PdfItemsTableProps {
  items: PdfLineItem[];
}

/**
 * Item table with row numbers (No列), grid borders, and a fixed header
 * that repeats on every page when the table spans multiple pages.
 */
export function PdfItemsTable({ items }: PdfItemsTableProps): ReactNode {
  return (
    <View style={sharedStyles.table}>
      <View style={sharedStyles.tableHeader} fixed>
        <Text style={[sharedStyles.tableHeaderText, sharedStyles.colNo]}>No.</Text>
        <Text style={[sharedStyles.tableHeaderText, sharedStyles.colName]}>品　　名</Text>
        <Text style={[sharedStyles.tableHeaderText, sharedStyles.colQty]}>数量</Text>
        <Text style={[sharedStyles.tableHeaderText, sharedStyles.colUnit]}>単　価</Text>
        <Text style={[sharedStyles.tableHeaderText, sharedStyles.colAmount]}>金　額</Text>
      </View>
      {items.map((item, i) => (
        <View key={i} style={sharedStyles.tableRow} wrap={false}>
          <Text style={[sharedStyles.tableCell, sharedStyles.colNo]}>{i + 1}</Text>
          <Text style={[sharedStyles.tableCell, sharedStyles.colName]}>{item.name ?? ''}</Text>
          <Text style={[sharedStyles.tableCell, sharedStyles.colQty]}>{item.quantity ?? 0}</Text>
          <Text style={[sharedStyles.tableCell, sharedStyles.colUnit]}>
            {formatJpy(item.unit_price ?? 0)}
          </Text>
          <Text style={[sharedStyles.tableCellLast, sharedStyles.colAmount]}>
            {formatJpy(item.subtotal ?? 0)}
          </Text>
        </View>
      ))}
    </View>
  );
}

interface PdfTotalsBlockProps {
  subtotal?: number;
  tax?: number;
  total?: number;
}

/**
 * Totals box — subtotal/tax in plain rows, grand total in shaded row with
 * a heavier top border for emphasis (no bold font available).
 */
export function PdfTotalsBlock({ subtotal, tax, total }: PdfTotalsBlockProps): ReactNode {
  return (
    <View style={sharedStyles.totalsWrap} wrap={false}>
      <View style={sharedStyles.totalsBox}>
        <View style={sharedStyles.totalsRow}>
          <Text style={sharedStyles.totalsLabel}>小　計</Text>
          <Text style={sharedStyles.totalsValue}>{formatJpy(subtotal ?? 0)}</Text>
        </View>
        <View style={sharedStyles.totalsRow}>
          <Text style={sharedStyles.totalsLabel}>消費税</Text>
          <Text style={sharedStyles.totalsValue}>{formatJpy(tax ?? 0)}</Text>
        </View>
        <View style={sharedStyles.totalsGrandRow}>
          <Text style={sharedStyles.totalsGrandLabel}>合計金額</Text>
          <Text style={sharedStyles.totalsGrandValue}>{formatJpy(total ?? 0)}</Text>
        </View>
      </View>
    </View>
  );
}

interface PdfFooterProps {
  items: Array<{ label: string; value?: string }>;
}

/**
 * Footer notes — labelled rows for things like 支払条件, 納期, 振込先, 備考.
 * Hidden if no items have values.
 */
export function PdfFooter({ items }: PdfFooterProps): ReactNode {
  const visible = items.filter((i) => i.value);
  if (visible.length === 0) return null;
  return (
    <View style={sharedStyles.footerBlock}>
      {visible.map((item, i) => (
        <View key={i} style={sharedStyles.footerRow}>
          <Text style={sharedStyles.footerLabel}>{item.label}</Text>
          <Text style={sharedStyles.footerValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Page-number footer fixed to every page bottom.
 * Use as the LAST child of <Page> with the `fixed` prop already set internally.
 */
export function PdfPageFooter(): ReactNode {
  return (
    <View style={sharedStyles.pageFooter} fixed>
      <Text style={sharedStyles.pageFooterText}>FujiTrace おしごと AI</Text>
      <Text
        style={sharedStyles.pageFooterText}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}
