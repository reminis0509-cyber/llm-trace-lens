/**
 * Pure-function keyword matching + information extraction for the
 * `/tutorial` page. No LLM calls — all responses are scripted and
 * deterministic, which lets us ship tutorials at ¥0 per visitor.
 *
 * Ethics: every response returned here is paired with a disclaimer in
 * the UI layer ("※このチュートリアルでは関数で動いています").
 */

export type DocumentKind =
  | 'estimate'
  | 'invoice'
  | 'delivery-note'
  | 'purchase-order'
  | 'cover-letter';

export interface IntentMatch {
  kind: DocumentKind;
  keyword: string;
}

interface KeywordEntry {
  kind: DocumentKind;
  keywords: string[];
}

// Keyword tables. Order matters: longer / more specific entries first so
// "納品書" is not mis-captured by a prefix of something else.
const KEYWORD_TABLE: KeywordEntry[] = [
  { kind: 'purchase-order', keywords: ['発注書', '注文書', '発注', 'オーダー'] },
  { kind: 'delivery-note', keywords: ['納品書', '納品'] },
  { kind: 'cover-letter', keywords: ['送付状', '添え状', 'カバーレター'] },
  { kind: 'invoice', keywords: ['請求書', '請求', 'インボイス'] },
  { kind: 'estimate', keywords: ['見積書', '見積もり', '見積り', '見積', '御見積'] },
];

export const PRACTICE_SUGGESTIONS: Record<
  'purchase_order' | 'cover_letter' | 'delivery_note',
  string[]
> = {
  purchase_order: ['発注書作って', '発注書出して', 'サーバー機材の発注書'],
  cover_letter: ['送付状作って', '書類の送付状', '送り状お願い'],
  delivery_note: ['納品書作って', '納品書お願い', '納品書出して'],
};

export function matchIntentForKind(
  input: string,
  expectedKind: DocumentKind,
): IntentMatch | null {
  const intent = matchIntent(input);
  if (!intent) return null;
  return intent.kind === expectedKind ? intent : null;
}

export function matchIntent(input: string): IntentMatch | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Track earliest occurrence so "請求書と見積書" picks the one written first.
  let best: { kind: DocumentKind; keyword: string; index: number } | null = null;
  for (const entry of KEYWORD_TABLE) {
    for (const keyword of entry.keywords) {
      const idx = trimmed.indexOf(keyword);
      if (idx === -1) continue;
      if (best === null || idx < best.index) {
        best = { kind: entry.kind, keyword, index: idx };
      }
    }
  }
  if (best === null) return null;
  return { kind: best.kind, keyword: best.keyword };
}

/**
 * Extracts a company name from natural-language input.
 * Patterns handled (in priority order):
 *   1. 株式会社〇〇 / 〇〇株式会社 / 合同会社〇〇 / 〇〇合同会社
 *   2. 〇〇商事 / 〇〇商店 / 〇〇工業 / 〇〇製作所 (common JP company suffixes)
 *   3. 〇〇様 (honorific recipient)
 *   4. 単文字 + 社 (A社, B社) — last resort
 */
export function extractCompanyName(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  // 1. Legal entity prefix/suffix
  const legalPrefix = text.match(/(株式会社|合同会社|有限会社|合資会社|合名会社)([ぁ-んァ-ヶ一-龥A-Za-z0-9ー・]+)/);
  if (legalPrefix) return `${legalPrefix[1]}${legalPrefix[2]}`;

  const legalSuffix = text.match(/([ぁ-んァ-ヶ一-龥A-Za-z0-9ー・]+)(株式会社|合同会社|有限会社|合資会社|合名会社)/);
  if (legalSuffix) return `${legalSuffix[1]}${legalSuffix[2]}`;

  // 2. Common business suffixes
  const bizSuffix = text.match(/([ぁ-んァ-ヶ一-龥A-Za-z0-9]{1,12})(商事|商店|工業|製作所|製造|物産|商会|事務所)/);
  if (bizSuffix) return `${bizSuffix[1]}${bizSuffix[2]}`;

  // 3. Honorific recipient 〇〇様
  const honorific = text.match(/([ぁ-んァ-ヶ一-龥A-Za-z0-9ー・]{1,16})様/);
  if (honorific) return honorific[1];

  // 4. Single-char + 社 (A社, B社, 甲社)
  const shortShaPrefix = text.match(/([A-Za-zぁ-んァ-ヶ一-龥])社/);
  if (shortShaPrefix) return `${shortShaPrefix[1]}社`;

  return null;
}

/**
 * Extracts a JPY amount from natural-language input. Returns yen as a
 * plain number (e.g. 100000 for "10万円" or "¥100,000"). Returns null if
 * no amount-like token is detected.
 */
export function extractAmount(input: string): number | null {
  const text = input.trim();
  if (!text) return null;

  // 1. "〇〇万円" or "〇〇万" (including decimals like 1.5万)
  const manMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*万(?:円)?/);
  if (manMatch) {
    const v = Number(manMatch[1]);
    if (Number.isFinite(v)) return Math.round(v * 10000);
  }

  // 2. "〇〇億" (rare but cheap to support)
  const okuMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*億(?:円)?/);
  if (okuMatch) {
    const v = Number(okuMatch[1]);
    if (Number.isFinite(v)) return Math.round(v * 100000000);
  }

  // 3. "¥100,000" / "￥100,000" / "100,000円" / "100000円"
  const yenSymbol = text.match(/[¥￥]\s*([0-9][0-9,]*)/);
  if (yenSymbol) {
    const n = Number(yenSymbol[1].replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }
  const yenSuffix = text.match(/([0-9][0-9,]*)\s*円/);
  if (yenSuffix) {
    const n = Number(yenSuffix[1].replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }

  return null;
}

export interface ExtractedPrompt {
  kind: DocumentKind | null;
  companyName: string | null;
  amount: number | null;
}

export function extractComplexPrompt(input: string): ExtractedPrompt {
  const match = matchIntent(input);
  return {
    kind: match?.kind ?? null,
    companyName: extractCompanyName(input),
    amount: extractAmount(input),
  };
}

export const PDF_SUMMARIES: Record<DocumentKind, string> = {
  estimate: '宛先: 株式会社サンプル商事\n件名: AI 社員導入コンサルティング\n合計: ¥330,000（税込）',
  invoice: '宛先: 株式会社サンプル商事\n請求番号: INV-2026-001\n合計: ¥330,000（税込）',
  'delivery-note': '宛先: 株式会社サンプル商事\n納品日: 2026-04-15\n品目: AI 社員初期構築',
  'purchase-order': '宛先: 株式会社ベンダー様\n品目: サーバー機材一式\n合計: ¥220,000（税込）',
  'cover-letter': '宛先: 株式会社サンプル商事\n送付物: 見積書 1 部\n担当: 山田太郎',
};

export const PDF_PATHS: Record<DocumentKind, string> = {
  estimate: '/tutorial/sample-estimate.pdf',
  invoice: '/tutorial/sample-invoice.pdf',
  'delivery-note': '/tutorial/sample-delivery-note.pdf',
  'purchase-order': '/tutorial/sample-purchase-order.pdf',
  'cover-letter': '/tutorial/sample-cover-letter.pdf',
};

const COMPLEX_PDF_PATH = '/tutorial/sample-complex-invoice.pdf';

const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  estimate: '見積書',
  invoice: '請求書',
  'delivery-note': '納品書',
  'purchase-order': '発注書',
  'cover-letter': '送付状',
};

const DOCUMENT_FILENAME: Record<DocumentKind, string> = {
  estimate: '見積書_サンプル.pdf',
  invoice: '請求書_サンプル.pdf',
  'delivery-note': '納品書_サンプル.pdf',
  'purchase-order': '発注書_サンプル.pdf',
  'cover-letter': '送付状_サンプル.pdf',
};

export function documentLabel(kind: DocumentKind): string {
  return DOCUMENT_LABEL[kind];
}

export function documentFilename(kind: DocumentKind): string {
  return DOCUMENT_FILENAME[kind];
}

export function getSimpleResponse(match: IntentMatch): string {
  const label = DOCUMENT_LABEL[match.kind];
  return `「${match.keyword}」って言ってくれたから、${label}のサンプルを用意したよ。下のプレビューを確認してね。`;
}

export const UNMATCHED_SIMPLE_MESSAGE =
  'ごめん、ボクが読み取れるのは書類の名前だけなんだ。「見積書作って」「請求書お願い」みたいに送ってみて！';

export const TUTORIAL_FOOTNOTE = '※このチュートリアルでは関数で動いています';

export interface ComplexResponse {
  message: string;
  pdfPath: string | null;
  detectedSummary: string | null;
  filename: string | null;
}

function formatAmount(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

export function getComplexResponse(extracted: ExtractedPrompt): ComplexResponse {
  const { kind, companyName, amount } = extracted;

  // All three detected — this is the happy path for Step 3.
  if (kind && companyName && amount !== null) {
    const label = DOCUMENT_LABEL[kind];
    const summary = `宛先: ${companyName} / 金額: ${formatAmount(amount)} / 書類: ${label}`;
    // Step 3 showcases "complex invoice" PDF regardless of kind so the user
    // can see the recipient/amount rendered in the doc. If kind is invoice
    // we use the complex sample; otherwise fall back to the static one per kind.
    const pdfPath = kind === 'invoice' ? COMPLEX_PDF_PATH : PDF_PATHS[kind];
    return {
      message: `読み取った情報で${label}を用意したよ。金額と会社名もちゃんと反映されてる（本物のAIはもっと柔軟に解釈できるよ）。`,
      pdfPath,
      detectedSummary: summary,
      filename: DOCUMENT_FILENAME[kind],
    };
  }

  // Only doc kind detected — show the static PDF but nudge for fuller input.
  if (kind) {
    const label = DOCUMENT_LABEL[kind];
    return {
      message: `${label}のサンプルを出したよ。会社名や金額も一緒に書いてくれたら、そこを反映したものを用意できるんだ。`,
      pdfPath: PDF_PATHS[kind],
      detectedSummary: null,
      filename: DOCUMENT_FILENAME[kind],
    };
  }

  // Nothing detected.
  return {
    message:
      '「会社名」「金額」「書類の種類」のどれかが必要だよ。例: 「A社向けに月次保守料10万円で請求書作って」',
    pdfPath: null,
    detectedSummary: null,
    filename: null,
  };
}
