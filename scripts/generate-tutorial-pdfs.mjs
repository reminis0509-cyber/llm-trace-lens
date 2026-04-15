/**
 * One-shot PDF generator for the LP free tutorial (`/tutorial`).
 *
 * Produces 6 deterministic sample PDFs under
 *   packages/landing/public/tutorial/
 * using @react-pdf/renderer (resolved from packages/dashboard/node_modules)
 * and the shared layout primitives declared in
 *   packages/dashboard/src/lib/pdf/base.tsx
 *
 * This script is designed to run once; the generated PDFs are checked in as
 * static assets. Re-run only when layout changes.
 *
 * Usage:
 *   node scripts/generate-tutorial-pdfs.mjs
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Resolve @react-pdf/renderer AND react from the dashboard package
// (they are already installed there; avoids adding a dev dep at repo root).
const dashboardDir = path.join(repoRoot, 'packages', 'dashboard');
const require = createRequire(path.join(dashboardDir, 'package.json'));
const React = require('react');
const ReactPDF = require('@react-pdf/renderer');
const { Document, Page, Text, View, StyleSheet, Font, renderToFile } = ReactPDF;

const fontPath = path.join(dashboardDir, 'public', 'fonts', 'NotoSansJP-Regular.ttf');
Font.register({ family: 'NotoSansJP', src: fontPath });

const outDir = path.join(repoRoot, 'packages', 'landing', 'public', 'tutorial');
await fs.mkdir(outDir, { recursive: true });

/* --------------------------------------------------------------------- */
/*  Shared styles (mirrors packages/dashboard/src/lib/pdf/base.tsx)      */
/* --------------------------------------------------------------------- */

const styles = StyleSheet.create({
  page: { fontFamily: 'NotoSansJP', fontSize: 10, padding: 40, color: '#1a1a1a' },
  title: { fontSize: 18, textAlign: 'center', marginBottom: 20, fontWeight: 'bold' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  headerLeft: { flex: 1 },
  headerRight: { flex: 1, textAlign: 'right' },
  label: { fontSize: 8, color: '#666', marginBottom: 2 },
  value: { fontSize: 10, marginBottom: 6 },
  subject: { fontSize: 12, marginBottom: 16, padding: 8, backgroundColor: '#f5f5f5' },
  table: { marginBottom: 16 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#2563eb', color: '#ffffff', padding: 6 },
  tableHeaderText: { color: '#ffffff', fontSize: 9, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', padding: 6, borderBottom: '0.5pt solid #e5e7eb' },
  colName: { flex: 3 },
  colQty: { width: 50, textAlign: 'right' },
  colUnit: { width: 80, textAlign: 'right' },
  colAmount: { width: 80, textAlign: 'right' },
  totals: { alignItems: 'flex-end', marginBottom: 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4, width: 200 },
  totalLabel: { flex: 1, textAlign: 'right', paddingRight: 10, color: '#666' },
  totalValue: { width: 80, textAlign: 'right' },
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
  totalGrandValue: { width: 80, textAlign: 'right', fontSize: 12, fontWeight: 'bold' },
  footer: { marginTop: 10, fontSize: 9, color: '#666' },
  footerItem: { marginBottom: 4 },
  body: { fontSize: 11, lineHeight: 1.7, marginTop: 20 },
});

const jpy = (n) => `¥${n.toLocaleString('ja-JP')}`;
const h = React.createElement;

/* --------------------------------------------------------------------- */
/*  Primitive builders                                                   */
/* --------------------------------------------------------------------- */

function Header({ meta, issuer, numberLabel }) {
  return h(
    View,
    { style: styles.header },
    h(
      View,
      { style: styles.headerLeft },
      h(Text, { style: styles.label }, '宛先'),
      h(
        Text,
        { style: { fontSize: 13, marginBottom: 4 } },
        `${meta.clientCompanyName ?? ''} ${meta.clientHonorific ?? '御中'}`,
      ),
      meta.documentNumber != null &&
        h(React.Fragment, null,
          h(Text, { style: styles.label }, numberLabel ?? '番号'),
          h(Text, { style: styles.value }, meta.documentNumber),
        ),
      h(Text, { style: styles.label }, '発行日'),
      h(Text, { style: styles.value }, meta.issueDate ?? ''),
      meta.secondaryDateLabel &&
        h(React.Fragment, null,
          h(Text, { style: styles.label }, meta.secondaryDateLabel),
          h(Text, { style: styles.value }, meta.secondaryDateValue ?? ''),
        ),
    ),
    h(
      View,
      { style: styles.headerRight },
      issuer.companyName && h(Text, { style: { fontSize: 11, marginBottom: 4 } }, issuer.companyName),
      issuer.address && h(Text, { style: styles.value }, issuer.address),
      issuer.phone && h(Text, { style: styles.value }, `TEL: ${issuer.phone}`),
      issuer.email && h(Text, { style: styles.value }, issuer.email),
      issuer.representative && h(Text, { style: styles.value }, issuer.representative),
      issuer.invoiceNumber && h(Text, { style: styles.value }, `登録番号: ${issuer.invoiceNumber}`),
    ),
  );
}

function ItemsTable({ items }) {
  return h(
    View,
    { style: styles.table },
    h(
      View,
      { style: styles.tableHeader },
      h(Text, { style: [styles.tableHeaderText, styles.colName] }, '品名'),
      h(Text, { style: [styles.tableHeaderText, styles.colQty] }, '数量'),
      h(Text, { style: [styles.tableHeaderText, styles.colUnit] }, '単価'),
      h(Text, { style: [styles.tableHeaderText, styles.colAmount] }, '金額'),
    ),
    ...items.map((item, i) =>
      h(
        View,
        { key: i, style: styles.tableRow },
        h(Text, { style: styles.colName }, item.name ?? ''),
        h(Text, { style: styles.colQty }, String(item.quantity ?? 0)),
        h(Text, { style: styles.colUnit }, jpy(item.unit_price ?? 0)),
        h(Text, { style: styles.colAmount }, jpy(item.subtotal ?? 0)),
      ),
    ),
  );
}

function Totals({ subtotal, tax, total }) {
  return h(
    View,
    { style: styles.totals },
    h(
      View,
      { style: styles.totalRow },
      h(Text, { style: styles.totalLabel }, '小計'),
      h(Text, { style: styles.totalValue }, jpy(subtotal ?? 0)),
    ),
    h(
      View,
      { style: styles.totalRow },
      h(Text, { style: styles.totalLabel }, '消費税'),
      h(Text, { style: styles.totalValue }, jpy(tax ?? 0)),
    ),
    h(
      View,
      { style: styles.totalGrand },
      h(Text, { style: styles.totalGrandLabel }, '合計'),
      h(Text, { style: styles.totalGrandValue }, jpy(total ?? 0)),
    ),
  );
}

function Footer({ items }) {
  const visible = items.filter((i) => i.value);
  if (visible.length === 0) return null;
  return h(
    View,
    { style: styles.footer },
    ...visible.map((item, i) =>
      h(Text, { key: i, style: styles.footerItem }, `${item.label}: ${item.value}`),
    ),
  );
}

/* --------------------------------------------------------------------- */
/*  Fixed issuer / client data                                           */
/* --------------------------------------------------------------------- */

const issuer = {
  companyName: '株式会社フジトレース',
  address: '東京都千代田区丸の内1-1-1',
  phone: '03-0000-0000',
  email: 'contact@fujitrace.jp',
  representative: '代表取締役 藤森 武',
  invoiceNumber: 'T1234567890123',
};

const sampleClient = { companyName: '株式会社サンプル商事', honorific: '御中' };
const vendorClient = { companyName: '株式会社ベンダー', honorific: '様' };
const aClient = { companyName: '株式会社エー', honorific: '御中' };

const consultingItem = {
  name: 'AI事務員初期構築コンサルティング',
  quantity: 1,
  unit_price: 300000,
  subtotal: 300000,
};
const monthlyMaintenanceItem = {
  name: 'システム保守（2026年4月分）',
  quantity: 1,
  unit_price: 100000,
  subtotal: 100000,
};
const serverItem = {
  name: 'サーバー機材一式',
  quantity: 1,
  unit_price: 200000,
  subtotal: 200000,
};

/* --------------------------------------------------------------------- */
/*  Document builders                                                    */
/* --------------------------------------------------------------------- */

function buildBusinessDoc({ title, numberLabel, meta, items, subtotal, tax, total, footerItems }) {
  return h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(Text, { style: styles.title }, title),
      h(Header, { meta, issuer, numberLabel }),
      meta.subject && h(Text, { style: styles.subject }, `件名: ${meta.subject}`),
      h(ItemsTable, { items }),
      h(Totals, { subtotal, tax, total }),
      footerItems && h(Footer, { items: footerItems }),
    ),
  );
}

function estimateDoc() {
  return buildBusinessDoc({
    title: '見 積 書',
    numberLabel: '見積番号',
    meta: {
      documentNumber: 'EST-2026-001',
      clientCompanyName: sampleClient.companyName,
      clientHonorific: sampleClient.honorific,
      issueDate: '2026-04-15',
      secondaryDateLabel: '有効期限',
      secondaryDateValue: '2026-05-15',
      subject: 'AI事務員導入コンサルティング',
    },
    items: [consultingItem],
    subtotal: 300000,
    tax: 30000,
    total: 330000,
    footerItems: [
      { label: '支払条件', value: '月末締翌月末払い' },
      { label: '納期', value: '2026-05-30' },
    ],
  });
}

function invoiceDoc() {
  return buildBusinessDoc({
    title: '請 求 書',
    numberLabel: '請求書番号',
    meta: {
      documentNumber: 'INV-2026-001',
      clientCompanyName: sampleClient.companyName,
      clientHonorific: sampleClient.honorific,
      issueDate: '2026-04-15',
      secondaryDateLabel: '支払期限',
      secondaryDateValue: '2026-05-31',
      subject: 'AI事務員導入コンサルティング',
    },
    items: [consultingItem],
    subtotal: 300000,
    tax: 30000,
    total: 330000,
    footerItems: [
      { label: '振込先', value: 'みずほ銀行 サンプル支店 普通 1234567 カ）フジトレース' },
      { label: '支払期限', value: '2026-05-31' },
    ],
  });
}

function deliveryNoteDoc() {
  return buildBusinessDoc({
    title: '納 品 書',
    numberLabel: '納品書番号',
    meta: {
      documentNumber: 'DN-2026-001',
      clientCompanyName: sampleClient.companyName,
      clientHonorific: sampleClient.honorific,
      issueDate: '2026-04-15',
      secondaryDateLabel: '納品日',
      secondaryDateValue: '2026-04-15',
      subject: 'AI事務員導入コンサルティング',
    },
    items: [consultingItem],
    subtotal: 300000,
    tax: 30000,
    total: 330000,
    footerItems: [{ label: '備考', value: '検収のほどよろしくお願い申し上げます。' }],
  });
}

function purchaseOrderDoc() {
  return buildBusinessDoc({
    title: '発 注 書',
    numberLabel: '発注書番号',
    meta: {
      documentNumber: 'PO-2026-001',
      clientCompanyName: vendorClient.companyName,
      clientHonorific: vendorClient.honorific,
      issueDate: '2026-04-15',
      secondaryDateLabel: '納期',
      secondaryDateValue: '2026-04-30',
      subject: 'サーバー機材一式 発注',
    },
    items: [serverItem],
    subtotal: 200000,
    tax: 20000,
    total: 220000,
    footerItems: [{ label: '納品先', value: '東京都千代田区丸の内1-1-1' }],
  });
}

function complexInvoiceDoc() {
  return buildBusinessDoc({
    title: '請 求 書',
    numberLabel: '請求書番号',
    meta: {
      documentNumber: 'INV-2026-A001',
      clientCompanyName: aClient.companyName,
      clientHonorific: aClient.honorific,
      issueDate: '2026-04-15',
      secondaryDateLabel: '支払期限',
      secondaryDateValue: '2026-05-31',
      subject: '月次保守料',
    },
    items: [monthlyMaintenanceItem],
    subtotal: 100000,
    tax: 10000,
    total: 110000,
    footerItems: [
      { label: '振込先', value: 'みずほ銀行 サンプル支店 普通 1234567 カ）フジトレース' },
      { label: '支払期限', value: '2026-05-31' },
    ],
  });
}

function coverLetterDoc() {
  return h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(Text, { style: styles.title }, '送 付 状'),
      h(Header, {
        meta: {
          clientCompanyName: sampleClient.companyName,
          clientHonorific: sampleClient.honorific,
          issueDate: '2026-04-15',
        },
        issuer,
        numberLabel: '',
      }),
      h(Text, { style: styles.subject }, '件名: 書類送付のご案内'),
      h(
        View,
        { style: styles.body },
        h(Text, null, '拝啓　貴社ますますご清栄のこととお慶び申し上げます。'),
        h(Text, { style: { marginTop: 10 } }, '平素は格別のお引き立てを賜り、厚く御礼申し上げます。'),
        h(
          Text,
          { style: { marginTop: 10 } },
          '下記の書類を送付いたしますので、ご査収のほどよろしくお願い申し上げます。',
        ),
        h(Text, { style: { marginTop: 20, fontWeight: 'bold' } }, '記'),
        h(Text, { style: { marginTop: 6 } }, '・見積書　1部'),
        h(Text, { style: { marginTop: 20, textAlign: 'right' } }, '以上'),
        h(Text, { style: { marginTop: 20 } }, '担当: 山田 太郎'),
      ),
      h(Footer, {
        items: [{ label: 'お問い合わせ', value: 'contact@fujitrace.jp' }],
      }),
    ),
  );
}

/* --------------------------------------------------------------------- */
/*  Run                                                                  */
/* --------------------------------------------------------------------- */

const jobs = [
  ['sample-estimate.pdf', estimateDoc()],
  ['sample-invoice.pdf', invoiceDoc()],
  ['sample-delivery-note.pdf', deliveryNoteDoc()],
  ['sample-purchase-order.pdf', purchaseOrderDoc()],
  ['sample-cover-letter.pdf', coverLetterDoc()],
  ['sample-complex-invoice.pdf', complexInvoiceDoc()],
];

let totalBytes = 0;
for (const [filename, element] of jobs) {
  const absPath = path.join(outDir, filename);
  await renderToFile(element, absPath);
  const stat = await fs.stat(absPath);
  totalBytes += stat.size;
  console.log(`  ${filename}  ${(stat.size / 1024).toFixed(1)} KB`);
}
console.log(`\n${jobs.length} PDFs written to ${outDir}`);
console.log(`Total: ${(totalBytes / 1024).toFixed(1)} KB`);
