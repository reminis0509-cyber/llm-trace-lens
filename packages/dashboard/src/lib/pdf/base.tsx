/**
 * Shared PDF building blocks for Japanese business documents
 * (estimates, invoices, delivery notes, purchase orders, cover letters).
 *
 * All modules must use these primitives so that font registration,
 * typography, and layout stay consistent across document types.
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

export const sharedStyles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    padding: 40,
    color: '#1a1a1a',
  },
  title: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flex: 1,
    textAlign: 'right',
  },
  label: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
    marginBottom: 6,
  },
  subject: {
    fontSize: 12,
    marginBottom: 16,
    padding: 8,
    backgroundColor: '#f5f5f5',
  },
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    padding: 6,
  },
  tableHeaderText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottom: '0.5pt solid #e5e7eb',
  },
  colName: { flex: 3 },
  colQty: { width: 50, textAlign: 'right' },
  colUnit: { width: 80, textAlign: 'right' },
  colAmount: { width: 80, textAlign: 'right' },
  totals: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
    width: 200,
  },
  totalLabel: {
    flex: 1,
    textAlign: 'right',
    paddingRight: 10,
    color: '#666',
  },
  totalValue: {
    width: 80,
    textAlign: 'right',
  },
  totalGrand: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    paddingTop: 4,
    borderTop: '1pt solid #1a1a1a',
    width: 200,
  },
  totalGrandLabel: {
    flex: 1,
    textAlign: 'right',
    paddingRight: 10,
    fontSize: 12,
    fontWeight: 'bold',
  },
  totalGrandValue: {
    width: 80,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 10,
    fontSize: 9,
    color: '#666',
  },
  footerItem: {
    marginBottom: 4,
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

export function PdfHeader({ meta, issuer, numberLabel = '番号' }: PdfHeaderProps): ReactNode {
  return (
    <View style={sharedStyles.header}>
      <View style={sharedStyles.headerLeft}>
        <Text style={sharedStyles.label}>宛先</Text>
        <Text style={{ fontSize: 13, marginBottom: 4 }}>
          {meta.clientCompanyName ?? ''} {meta.clientHonorific ?? '御中'}
        </Text>
        <Text style={sharedStyles.label}>{numberLabel}</Text>
        <Text style={sharedStyles.value}>{meta.documentNumber ?? ''}</Text>
        <Text style={sharedStyles.label}>発行日</Text>
        <Text style={sharedStyles.value}>{meta.issueDate ?? ''}</Text>
        {meta.secondaryDateLabel && (
          <>
            <Text style={sharedStyles.label}>{meta.secondaryDateLabel}</Text>
            <Text style={sharedStyles.value}>{meta.secondaryDateValue ?? ''}</Text>
          </>
        )}
      </View>
      <View style={sharedStyles.headerRight}>
        {issuer.companyName && (
          <Text style={{ fontSize: 11, marginBottom: 4 }}>{issuer.companyName}</Text>
        )}
        {issuer.address && <Text style={sharedStyles.value}>{issuer.address}</Text>}
        {issuer.phone && <Text style={sharedStyles.value}>TEL: {issuer.phone}</Text>}
        {issuer.email && <Text style={sharedStyles.value}>{issuer.email}</Text>}
        {issuer.representative && <Text style={sharedStyles.value}>{issuer.representative}</Text>}
        {issuer.invoiceNumber && (
          <Text style={sharedStyles.value}>登録番号: {issuer.invoiceNumber}</Text>
        )}
      </View>
    </View>
  );
}

interface PdfItemsTableProps {
  items: PdfLineItem[];
}

export function PdfItemsTable({ items }: PdfItemsTableProps): ReactNode {
  return (
    <View style={sharedStyles.table}>
      <View style={sharedStyles.tableHeader}>
        <Text style={[sharedStyles.tableHeaderText, sharedStyles.colName]}>品名</Text>
        <Text style={[sharedStyles.tableHeaderText, sharedStyles.colQty]}>数量</Text>
        <Text style={[sharedStyles.tableHeaderText, sharedStyles.colUnit]}>単価</Text>
        <Text style={[sharedStyles.tableHeaderText, sharedStyles.colAmount]}>金額</Text>
      </View>
      {items.map((item, i) => (
        <View key={i} style={sharedStyles.tableRow}>
          <Text style={sharedStyles.colName}>{item.name ?? ''}</Text>
          <Text style={sharedStyles.colQty}>{item.quantity ?? 0}</Text>
          <Text style={sharedStyles.colUnit}>{formatJpy(item.unit_price ?? 0)}</Text>
          <Text style={sharedStyles.colAmount}>{formatJpy(item.subtotal ?? 0)}</Text>
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

export function PdfTotalsBlock({ subtotal, tax, total }: PdfTotalsBlockProps): ReactNode {
  return (
    <View style={sharedStyles.totals}>
      <View style={sharedStyles.totalRow}>
        <Text style={sharedStyles.totalLabel}>小計</Text>
        <Text style={sharedStyles.totalValue}>{formatJpy(subtotal ?? 0)}</Text>
      </View>
      <View style={sharedStyles.totalRow}>
        <Text style={sharedStyles.totalLabel}>消費税</Text>
        <Text style={sharedStyles.totalValue}>{formatJpy(tax ?? 0)}</Text>
      </View>
      <View style={sharedStyles.totalGrand}>
        <Text style={sharedStyles.totalGrandLabel}>合計</Text>
        <Text style={sharedStyles.totalGrandValue}>{formatJpy(total ?? 0)}</Text>
      </View>
    </View>
  );
}

interface PdfFooterProps {
  items: Array<{ label: string; value?: string }>;
}

export function PdfFooter({ items }: PdfFooterProps): ReactNode {
  const visible = items.filter((i) => i.value);
  if (visible.length === 0) return null;
  return (
    <View style={sharedStyles.footer}>
      {visible.map((item, i) => (
        <Text key={i} style={sharedStyles.footerItem}>
          {item.label}: {item.value}
        </Text>
      ))}
    </View>
  );
}
