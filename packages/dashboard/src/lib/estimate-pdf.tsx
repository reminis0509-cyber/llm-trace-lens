/**
 * Client-side PDF generation for estimates using @react-pdf/renderer.
 * Uses Noto Sans JP for Japanese text rendering.
 * Lazy-loaded to keep initial bundle small.
 */
import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';

// Register Noto Sans JP font
Font.register({
  family: 'NotoSansJP',
  src: '/dashboard/fonts/NotoSansJP-Regular.ttf',
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
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

interface EstimatePdfData {
  estimate_number?: string;
  issue_date?: string;
  valid_until?: string;
  client?: { company_name?: string; honorific?: string };
  subject?: string;
  items?: Array<{ name?: string; quantity?: number; unit_price?: number; subtotal?: number }>;
  subtotal?: number;
  tax_amount?: number;
  total?: number;
  payment_terms?: string;
  delivery_date?: string;
  notes?: string;
}

interface IssuerInfo {
  companyName?: string;
  address?: string;
  phone?: string;
  email?: string;
  representative?: string;
  invoiceNumber?: string;
}

const fmt = (n: number) => `¥${n.toLocaleString()}`;

function EstimatePdfDocument({ data, issuer }: { data: EstimatePdfData; issuer: IssuerInfo }) {
  const items = data.items ?? [];
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>見 積 書</Text>

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.label}>宛先</Text>
            <Text style={{ fontSize: 13, marginBottom: 4 }}>
              {data.client?.company_name ?? ''} {data.client?.honorific ?? '御中'}
            </Text>
            <Text style={styles.label}>見積番号</Text>
            <Text style={styles.value}>{data.estimate_number ?? ''}</Text>
            <Text style={styles.label}>発行日</Text>
            <Text style={styles.value}>{data.issue_date ?? ''}</Text>
            <Text style={styles.label}>有効期限</Text>
            <Text style={styles.value}>{data.valid_until ?? ''}</Text>
          </View>
          <View style={styles.headerRight}>
            {issuer.companyName && <Text style={{ fontSize: 11, marginBottom: 4 }}>{issuer.companyName}</Text>}
            {issuer.address && <Text style={styles.value}>{issuer.address}</Text>}
            {issuer.phone && <Text style={styles.value}>TEL: {issuer.phone}</Text>}
            {issuer.email && <Text style={styles.value}>{issuer.email}</Text>}
            {issuer.representative && <Text style={styles.value}>{issuer.representative}</Text>}
            {issuer.invoiceNumber && <Text style={styles.value}>登録番号: {issuer.invoiceNumber}</Text>}
          </View>
        </View>

        {data.subject && <Text style={styles.subject}>件名: {data.subject}</Text>}

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colName]}>品名</Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>数量</Text>
            <Text style={[styles.tableHeaderText, styles.colUnit]}>単価</Text>
            <Text style={[styles.tableHeaderText, styles.colAmount]}>金額</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colName}>{item.name ?? ''}</Text>
              <Text style={styles.colQty}>{item.quantity ?? 0}</Text>
              <Text style={styles.colUnit}>{fmt(item.unit_price ?? 0)}</Text>
              <Text style={styles.colAmount}>{fmt(item.subtotal ?? 0)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>小計</Text>
            <Text style={styles.totalValue}>{fmt(data.subtotal ?? 0)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>消費税</Text>
            <Text style={styles.totalValue}>{fmt(data.tax_amount ?? 0)}</Text>
          </View>
          <View style={styles.totalGrand}>
            <Text style={styles.totalGrandLabel}>合計</Text>
            <Text style={styles.totalGrandValue}>{fmt(data.total ?? 0)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          {data.payment_terms && <Text style={styles.footerItem}>支払条件: {data.payment_terms}</Text>}
          {data.delivery_date && <Text style={styles.footerItem}>納期: {data.delivery_date}</Text>}
          {data.notes && <Text style={styles.footerItem}>備考: {data.notes}</Text>}
        </View>
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
