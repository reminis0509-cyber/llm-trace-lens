/**
 * One-shot PDF generator for the lead magnet placeholder
 * (戦略 doc Section 18.2.K — リード磁石「カピぶちょー入り AI 活用 PDF」).
 *
 * Produces ONE deterministic placeholder PDF at
 *   packages/landing/public/leadmagnet/oshigoto-ai-guide.pdf
 *
 * This is a placeholder — the production content (6-10 pages, 5-step
 * structure with カピぶちょー commentary) is being authored separately by
 * CEO + Founder. The placeholder MUST clearly state "準備中" so any user
 * who reaches it before the real content is published understands.
 *
 * Stack:
 *   - @react-pdf/renderer (resolved from packages/dashboard, same as
 *     scripts/generate-tutorial-pdfs.mjs — no new dep at repo root)
 *   - NotoSansJP-Regular.ttf for Japanese rendering
 *
 * Usage:
 *   node scripts/generate-leadmagnet-placeholder.mjs
 *
 * Re-run only if the placeholder design changes.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Resolve @react-pdf/renderer + React from the dashboard package
// (already installed there; avoids adding a dev dep at repo root).
const dashboardDir = path.join(repoRoot, 'packages', 'dashboard');
const require = createRequire(path.join(dashboardDir, 'package.json'));
const React = require('react');
const ReactPDF = require('@react-pdf/renderer');
const { Document, Page, Text, View, StyleSheet, Font, renderToFile } = ReactPDF;

const fontPath = path.join(
  dashboardDir,
  'public',
  'fonts',
  'NotoSansJP-Regular.ttf',
);
Font.register({ family: 'NotoSansJP', src: fontPath });

const outDir = path.join(repoRoot, 'packages', 'landing', 'public', 'leadmagnet');
await fs.mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, 'oshigoto-ai-guide.pdf');

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansJP',
    fontSize: 11,
    padding: 56,
    color: '#1a1a1a',
    lineHeight: 1.6,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 32,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    color: '#555',
    marginBottom: 48,
  },
  notice: {
    border: '1pt solid #2563eb',
    backgroundColor: '#eff6ff',
    padding: 16,
    marginBottom: 32,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 8,
  },
  body: { fontSize: 11, marginBottom: 12 },
  capi: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#fef9c3',
    border: '0.5pt solid #ca8a04',
  },
  capiLabel: {
    fontSize: 10,
    color: '#854d0e',
    marginBottom: 6,
    fontWeight: 'bold',
  },
  capiQuote: { fontSize: 12, color: '#3f3f3f' },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 56,
    right: 56,
    textAlign: 'center',
    fontSize: 9,
    color: '#888',
  },
});

const Doc = React.createElement(
  Document,
  null,
  React.createElement(
    Page,
    { size: 'A4', style: styles.page },
    React.createElement(
      Text,
      { style: styles.title },
      'カピぶちょーが教える、人を雇わずに事務を回す5ステップ',
    ),
    React.createElement(
      Text,
      { style: styles.subtitle },
      'FujiTrace × おしごとAI 活用ガイド',
    ),

    React.createElement(
      View,
      { style: styles.notice },
      React.createElement(Text, { style: styles.noticeTitle }, '【準備中】'),
      React.createElement(
        Text,
        { style: styles.body },
        'このガイドは現在制作中です。完成後、こちらと同じURLから最新版をダウンロードできます。',
      ),
      React.createElement(
        Text,
        { style: styles.body },
        'LINEで「おしごとAI」とお話ししながら、続報をお待ちください。',
      ),
    ),

    React.createElement(
      Text,
      { style: styles.body },
      '本ガイド(完成時の予定):',
    ),
    React.createElement(
      Text,
      { style: styles.body },
      '1. なぜ採用市場が壊れたのか(現状認識)',
    ),
    React.createElement(
      Text,
      { style: styles.body },
      '2. 業務を「人がやる」と「AIがやる」に分ける(整理術)',
    ),
    React.createElement(
      Text,
      { style: styles.body },
      '3. AI事務員(おしごとAI)を試す(具体例)',
    ),
    React.createElement(
      Text,
      { style: styles.body },
      '4. AIと社員の役割分担を作る(運用設計)',
    ),
    React.createElement(
      Text,
      { style: styles.body },
      '5. 3ヶ月後の効果測定(KPI例)',
    ),

    React.createElement(
      View,
      { style: styles.capi },
      React.createElement(Text, { style: styles.capiLabel }, 'カピぶちょー'),
      React.createElement(
        Text,
        { style: styles.capiQuote },
        '「もうちょい待っててや〜!ええの作ったるで〜☺」',
      ),
    ),

    React.createElement(
      Text,
      { style: styles.footer },
      'FujiTrace — 合同会社Reminis  |  https://www.fujitrace.jp',
    ),
  ),
);

await renderToFile(Doc, outPath);

const stat = await fs.stat(outPath);
console.log(`Wrote ${outPath} (${stat.size} bytes)`);
