/**
 * /tools/seikyusho — 請求書テンプレート 無料 (Freemium 第 1 層 Phase A)
 *
 * 戦略 doc Section 5.6 / Section 18.2.N (Founder 承認 2026-04-29)
 *
 * 役割:
 *   - SEO 集客装置。ターゲット流入語「請求書 テンプレート 無料」(5,280/月) ほか
 *   - 認証不要・登録不要・コスト 0 で完結する純粋関数ツール
 *   - PDF DL 直後にのみ「自社広告」(第 2 層 Free 登録誘導) を提示
 *
 * 禁止事項 (戦略 doc 準拠):
 *   - LLM API 呼び出し禁止 (純粋計算のみ)
 *   - Hero でログイン誘導禁止 (離脱要因)
 *   - フォーム入力中の自社広告表示禁止 (邪魔)
 *   - 自社広告でのいきなりの Pro 訴求禁止 (転換率低下、第 1 段は Free のみ)
 *
 * Phase A は請求書のみ。Phase B で残り 4 書類 + ナビ分離。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSeo } from '../../hooks/useSeo';
import { trackDashboardConversion } from '../../utils/gtag';
import { TOOLS_SEO, buildAllJsonLd, CANONICAL_ORIGIN } from '../../data/seo-tools';
import { SEO_CONTENT } from '../../data/seo-content';
import SeoContent from './_shared/SeoContent';
// `@react-pdf/renderer` is ~500KB and only needed when a user clicks
// "PDFをダウンロード". Lazy-import in handleDownloadPdf so the SEO landing
// payload stays small (Lighthouse Performance / FCP).
import type { InvoicePdfData, IssuerInfo } from '../../lib/pdf/invoice';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TaxKind = '10' | '8' | '0';

interface LineItem {
  name: string;
  unitPrice: string;
  quantity: number;
  taxKind: TaxKind;
}

interface IssuerForm {
  companyName: string;
  address: string;
  phone: string;
  bankInfo: string;
}

interface ClientForm {
  companyName: string;
  contactPerson: string;
  address: string;
}

interface InvoiceForm {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  bearTransferFee: boolean;
  withholdTax: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatJpy(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addMonthsIso(iso: string, months: number): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatJapaneseDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 計測イベント発火 — backend-engineer 別タスクで集計実装予定。
 * 現状は window.gtag が居れば飛ばす、いなくても安全に no-op。
 */
function trackEvent(
  name:
    | 'tools_seikyusho_page_view'
    | 'tools_seikyusho_form_started'
    | 'tools_seikyusho_pdf_downloaded'
    | 'tools_seikyusho_cta_clicked',
  params?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params ?? {});
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SeikyushoPage() {
  /* ----- SEO ----- */
  const seoConfig = TOOLS_SEO['/tools/seikyusho'];
  const jsonLd = useMemo(() => buildAllJsonLd(seoConfig), [seoConfig]);
  useSeo({
    title: seoConfig.title,
    description: seoConfig.description,
    url: `${CANONICAL_ORIGIN}${seoConfig.path}`,
    ogTitle: seoConfig.ogTitle,
    jsonLd,
  });

  /* ----- Form state ----- */
  const [issuer, setIssuer] = useState<IssuerForm>({
    companyName: '',
    address: '',
    phone: '',
    bankInfo: '',
  });
  const [client, setClient] = useState<ClientForm>({
    companyName: '',
    contactPerson: '',
    address: '',
  });
  const [meta, setMeta] = useState<InvoiceForm>(() => {
    const today = todayIso();
    return {
      invoiceNumber: `INV-${todayIso().replace(/-/g, '')}-001`,
      issueDate: today,
      dueDate: addMonthsIso(today, 1),
      notes: '',
      bearTransferFee: false,
      withholdTax: false,
    };
  });
  const [items, setItems] = useState<LineItem[]>([
    { name: '', unitPrice: '', quantity: 1, taxKind: '10' },
  ]);

  /* ----- UI state ----- */
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showPostDownload, setShowPostDownload] = useState(false);

  /* ----- Tracking: page_view fires once on mount, form_started on first edit ----- */
  const formStartedRef = useRef(false);
  useEffect(() => {
    trackEvent('tools_seikyusho_page_view');
  }, []);

  function markFormStarted(): void {
    if (formStartedRef.current) return;
    formStartedRef.current = true;
    trackEvent('tools_seikyusho_form_started');
  }

  /* ----- Computed totals ----- */
  const subtotalsByTax: Record<TaxKind, number> = { '10': 0, '8': 0, '0': 0 };
  for (const item of items) {
    const price = Number(item.unitPrice) || 0;
    const lineSubtotal = price * item.quantity;
    subtotalsByTax[item.taxKind] += lineSubtotal;
  }
  const subtotal =
    subtotalsByTax['10'] + subtotalsByTax['8'] + subtotalsByTax['0'];
  const tax10 = Math.floor(subtotalsByTax['10'] * 0.1);
  const tax8 = Math.floor(subtotalsByTax['8'] * 0.08);
  const taxTotal = tax10 + tax8;
  const total = subtotal + taxTotal;

  /* ----- Item handlers ----- */
  const updateItem = <K extends keyof LineItem>(
    index: number,
    field: K,
    value: LineItem[K],
  ): void => {
    markFormStarted();
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const handleUnitPriceChange = (index: number, raw: string): void => {
    const digits = raw.replace(/[^0-9]/g, '');
    updateItem(index, 'unitPrice', digits);
  };

  const addItem = (): void => {
    markFormStarted();
    setItems((prev) => [
      ...prev,
      { name: '', unitPrice: '', quantity: 1, taxKind: '10' },
    ]);
  };

  const removeItem = (index: number): void => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  /* ----- PDF Download ----- */
  async function handleDownloadPdf(): Promise<void> {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const issuerInfo: IssuerInfo = {
        companyName: issuer.companyName || undefined,
        address: issuer.address || undefined,
        phone: issuer.phone || undefined,
      };

      const pdfData: InvoicePdfData = {
        invoice_number: meta.invoiceNumber || undefined,
        issue_date: meta.issueDate ? formatJapaneseDate(meta.issueDate) : undefined,
        due_date: meta.dueDate ? formatJapaneseDate(meta.dueDate) : undefined,
        client: {
          company_name: client.companyName || undefined,
          honorific: '御中',
          contact_person: client.contactPerson || undefined,
        },
        items: items
          .filter((it) => it.name || it.unitPrice)
          .map((it) => ({
            name: it.name,
            quantity: it.quantity,
            unit_price: Number(it.unitPrice) || 0,
            subtotal: (Number(it.unitPrice) || 0) * it.quantity,
          })),
        subtotal,
        tax_amount: taxTotal,
        total,
        payment_terms: meta.dueDate
          ? `${formatJapaneseDate(meta.dueDate)}までにお振込みください`
          : undefined,
        bank_info: issuer.bankInfo || undefined,
        notes: [
          meta.notes || undefined,
          meta.bearTransferFee
            ? '※ 振込手数料は弊社にて負担いたします'
            : undefined,
          meta.withholdTax ? '※ 源泉徴収税の対象となります' : undefined,
        ]
          .filter(Boolean)
          .join('\n') || undefined,
      };

      const { generateInvoicePdf } = await import('../../lib/pdf/invoice');
      const blob = await generateInvoicePdf(pdfData, issuerInfo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeNumber = (meta.invoiceNumber || 'invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${safeNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      trackEvent('tools_seikyusho_pdf_downloaded', {
        item_count: items.length,
        has_issuer_company: !!issuer.companyName,
        has_client_company: !!client.companyName,
        total_jpy: total,
      });
      setShowPostDownload(true);
    } catch (e) {
      // Surfacing the error in Japanese per Frontend standards.
      const message = e instanceof Error ? e.message : 'PDFの生成に失敗しました。';
      setGenerationError(`PDFの生成中にエラーが発生しました: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCtaClick(target: 'signup' | 'tools'): void {
    trackEvent('tools_seikyusho_cta_clicked', { target });
    if (target === 'signup') {
      trackDashboardConversion();
    }
  }

  function navigate(href: string): void {
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="bg-white">
      {/* ===== Hero ===== */}
      <section className="pt-24 sm:pt-32 pb-10 sm:pb-14 px-4 sm:px-6 bg-gradient-to-b from-blue-50/40 to-white">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs sm:text-sm font-medium text-blue-600 mb-3 tracking-wide">
            無料テンプレート
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 leading-tight mb-5">
            請求書テンプレートを無料で作成
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-6">
            会員登録不要、PDF ですぐ出力。インボイス制度対応・税区分（10% / 8% / 非課税）対応。
          </p>
          <div className="inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-white border border-slate-200 rounded-full px-5 py-2.5 shadow-sm">
            <span className="text-xs sm:text-sm text-slate-700">登録不要</span>
            <span className="text-slate-300">／</span>
            <span className="text-xs sm:text-sm text-slate-700">PDF即出力</span>
            <span className="text-slate-300">／</span>
            <span className="text-xs sm:text-sm text-slate-700">追跡なし</span>
          </div>
        </div>
      </section>

      {/* ===== Form + Preview ===== */}
      <section className="py-10 sm:py-14 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* ---- Left: Form ---- */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-7 space-y-7">
              {/* 自社情報 */}
              <Fieldset legend="自社情報">
                <TextField
                  label="会社名"
                  value={issuer.companyName}
                  onChange={(v) => {
                    markFormStarted();
                    setIssuer((s) => ({ ...s, companyName: v }));
                  }}
                  placeholder="株式会社あなたの会社"
                />
                <TextField
                  label="住所"
                  value={issuer.address}
                  onChange={(v) => {
                    markFormStarted();
                    setIssuer((s) => ({ ...s, address: v }));
                  }}
                  placeholder="東京都中央区銀座一丁目22番11号"
                />
                <TextField
                  label="電話番号"
                  value={issuer.phone}
                  onChange={(v) => {
                    markFormStarted();
                    setIssuer((s) => ({ ...s, phone: v }));
                  }}
                  placeholder="03-0000-0000"
                />
                <TextField
                  label="振込先銀行"
                  value={issuer.bankInfo}
                  onChange={(v) => {
                    markFormStarted();
                    setIssuer((s) => ({ ...s, bankInfo: v }));
                  }}
                  placeholder="○○銀行 △△支店 普通 1234567"
                />
              </Fieldset>

              {/* 取引先情報 */}
              <Fieldset legend="取引先情報">
                <TextField
                  label="会社名"
                  value={client.companyName}
                  onChange={(v) => {
                    markFormStarted();
                    setClient((s) => ({ ...s, companyName: v }));
                  }}
                  placeholder="株式会社○○商事"
                />
                <TextField
                  label="ご担当者名"
                  value={client.contactPerson}
                  onChange={(v) => {
                    markFormStarted();
                    setClient((s) => ({ ...s, contactPerson: v }));
                  }}
                  placeholder="山田 太郎"
                />
                <TextField
                  label="住所"
                  value={client.address}
                  onChange={(v) => {
                    markFormStarted();
                    setClient((s) => ({ ...s, address: v }));
                  }}
                  placeholder="東京都港区..."
                />
              </Fieldset>

              {/* 請求書情報 */}
              <Fieldset legend="請求書情報">
                <TextField
                  label="請求番号"
                  value={meta.invoiceNumber}
                  onChange={(v) => {
                    markFormStarted();
                    setMeta((s) => ({ ...s, invoiceNumber: v }));
                  }}
                  placeholder="INV-20260429-001"
                />
                <DateField
                  label="発行日"
                  value={meta.issueDate}
                  onChange={(v) => {
                    markFormStarted();
                    setMeta((s) => ({ ...s, issueDate: v }));
                  }}
                />
                <DateField
                  label="支払期日"
                  value={meta.dueDate}
                  onChange={(v) => {
                    markFormStarted();
                    setMeta((s) => ({ ...s, dueDate: v }));
                  }}
                />
              </Fieldset>

              {/* 品目 */}
              <Fieldset legend="品目">
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="hidden sm:grid grid-cols-[1fr_5rem_5rem_4.5rem_2rem] gap-2 text-xs text-slate-500 px-1">
                    <span>品名</span>
                    <span className="text-right">単価</span>
                    <span className="text-right">数量</span>
                    <span className="text-center">税</span>
                    <span />
                  </div>
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_5rem_5rem_4.5rem_2rem] gap-2 sm:items-center"
                    >
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(index, 'name', e.target.value)}
                        placeholder="デザイン費"
                        aria-label={`品目${index + 1}の名称`}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-0"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.unitPrice}
                        onChange={(e) => handleUnitPriceChange(index, e.target.value)}
                        placeholder="単価"
                        aria-label={`品目${index + 1}の単価`}
                        className="px-2 py-2 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(
                            index,
                            'quantity',
                            Math.max(1, Number(e.target.value) || 1),
                          )
                        }
                        aria-label={`品目${index + 1}の数量`}
                        className="px-2 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <select
                        value={item.taxKind}
                        onChange={(e) =>
                          updateItem(index, 'taxKind', e.target.value as TaxKind)
                        }
                        aria-label={`品目${index + 1}の税区分`}
                        className="px-2 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        <option value="10">10%</option>
                        <option value="8">8%</option>
                        <option value="0">非課税</option>
                      </select>
                      {items.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="w-7 h-7 mx-auto flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          aria-label={`品目${index + 1}を削除`}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      ) : (
                        <div className="w-7 hidden sm:block" />
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  ＋ 品目を追加
                </button>
              </Fieldset>

              {/* 備考 + オプション */}
              <Fieldset legend="備考・オプション">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  備考
                </label>
                <textarea
                  value={meta.notes}
                  onChange={(e) => {
                    markFormStarted();
                    setMeta((s) => ({ ...s, notes: e.target.value }));
                  }}
                  placeholder="お振込みに関するお願いなど"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={meta.bearTransferFee}
                      onChange={(e) => {
                        markFormStarted();
                        setMeta((s) => ({ ...s, bearTransferFee: e.target.checked }));
                      }}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    振込手数料は弊社負担
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={meta.withholdTax}
                      onChange={(e) => {
                        markFormStarted();
                        setMeta((s) => ({ ...s, withholdTax: e.target.checked }));
                      }}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    源泉徴収あり
                  </label>
                </div>
              </Fieldset>

              {/* DL Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isGenerating}
                  className="w-full px-5 py-3 bg-blue-600 text-white rounded-lg text-sm sm:text-base font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-busy={isGenerating}
                >
                  {isGenerating ? 'PDFを生成しています…' : 'PDFをダウンロード'}
                </button>
                {generationError && (
                  <p className="mt-3 text-sm text-red-600" role="alert">
                    {generationError}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-400 text-center">
                  会員登録不要・無料 / 入力データはサーバーに送信されません
                </p>
              </div>
            </div>

            {/* ---- Right: Preview ---- */}
            <div className="lg:sticky lg:top-24 self-start">
              <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-7 shadow-sm">
                <div className="text-center mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-[0.4em]">
                    請　求　書
                  </h2>
                </div>

                {/* 宛先 + 発行日 */}
                <div className="grid grid-cols-2 gap-4 pb-4 mb-4 border-b border-slate-200">
                  <div>
                    <p className="text-base font-medium text-slate-900">
                      {client.companyName || '(取引先名 未入力)'}{' '}
                      <span className="text-slate-400 font-normal">御中</span>
                    </p>
                    {client.contactPerson && (
                      <p className="text-sm text-slate-700 mt-1">
                        {client.contactPerson} 様
                      </p>
                    )}
                    <div className="mt-3 space-y-0.5 text-xs text-slate-600">
                      <p>請求番号: {meta.invoiceNumber || '---'}</p>
                      <p>発行日: {formatJapaneseDate(meta.issueDate) || '---'}</p>
                      <p>
                        支払期限: {formatJapaneseDate(meta.dueDate) || '---'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 mb-1">発行元</p>
                    <p className="text-sm font-medium text-slate-900">
                      {issuer.companyName || '(自社名 未入力)'}
                    </p>
                    {issuer.address && (
                      <p className="text-xs text-slate-600 mt-0.5">{issuer.address}</p>
                    )}
                    {issuer.phone && (
                      <p className="text-xs text-slate-600 mt-0.5">
                        TEL: {issuer.phone}
                      </p>
                    )}
                    <div className="inline-flex items-center justify-center w-12 h-12 mt-3 border border-slate-300 text-slate-400 text-xs">
                      印
                    </div>
                  </div>
                </div>

                {/* 明細 */}
                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="text-center py-2 px-1 font-medium w-8">No.</th>
                        <th className="text-left py-2 px-2 font-medium">品名</th>
                        <th className="text-right py-2 px-1 font-medium w-12">数量</th>
                        <th className="text-right py-2 px-2 font-medium w-20">単価</th>
                        <th className="text-right py-2 px-2 font-medium w-24">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => {
                        const amount =
                          (Number(item.unitPrice) || 0) * item.quantity;
                        return (
                          <tr key={index} className="border-b border-slate-100">
                            <td className="py-2 px-1 text-center text-slate-700 tabular-nums">
                              {index + 1}
                            </td>
                            <td className="py-2 px-2 text-slate-900">
                              {item.name || '---'}
                              {item.taxKind !== '10' && (
                                <span className="ml-1 text-xs text-slate-500">
                                  ({item.taxKind === '8' ? '軽減 8%' : '非課税'})
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-1 text-right text-slate-700 tabular-nums">
                              {item.quantity}
                            </td>
                            <td className="py-2 px-2 text-right text-slate-700 tabular-nums">
                              {item.unitPrice ? formatJpy(Number(item.unitPrice)) : '---'}
                            </td>
                            <td className="py-2 px-2 text-right text-slate-900 tabular-nums">
                              {amount > 0 ? formatJpy(amount) : '---'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 合計 */}
                <div className="mt-4 ml-auto max-w-xs bg-slate-50 rounded-lg p-4">
                  <Row label="小計" value={formatJpy(subtotal)} />
                  {subtotalsByTax['10'] > 0 && (
                    <Row
                      label={`内 10% 対象 (${formatJpy(subtotalsByTax['10'])})`}
                      value={`消費税 ${formatJpy(tax10)}`}
                      muted
                    />
                  )}
                  {subtotalsByTax['8'] > 0 && (
                    <Row
                      label={`内 8% 対象 (${formatJpy(subtotalsByTax['8'])})`}
                      value={`消費税 ${formatJpy(tax8)}`}
                      muted
                    />
                  )}
                  {subtotalsByTax['0'] > 0 && (
                    <Row
                      label={`非課税対象 (${formatJpy(subtotalsByTax['0'])})`}
                      value="—"
                      muted
                    />
                  )}
                  <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-bold text-slate-900">
                    <span>合計</span>
                    <span className="tabular-nums text-lg">{formatJpy(total)}</span>
                  </div>
                </div>

                {/* 振込先・備考 */}
                {(issuer.bankInfo || meta.notes || meta.bearTransferFee || meta.withholdTax) && (
                  <div className="mt-5 pt-4 border-t border-slate-100 space-y-2 text-sm">
                    {issuer.bankInfo && (
                      <div>
                        <p className="text-slate-500 text-xs mb-0.5">振込先</p>
                        <p className="text-slate-900">{issuer.bankInfo}</p>
                      </div>
                    )}
                    {meta.notes && (
                      <div>
                        <p className="text-slate-500 text-xs mb-0.5">備考</p>
                        <p className="text-slate-900 whitespace-pre-wrap">
                          {meta.notes}
                        </p>
                      </div>
                    )}
                    {meta.bearTransferFee && (
                      <p className="text-slate-700 text-xs">
                        ※ 振込手数料は弊社にて負担いたします
                      </p>
                    )}
                    {meta.withholdTax && (
                      <p className="text-slate-700 text-xs">
                        ※ 源泉徴収税の対象となります
                      </p>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-400 text-center">
                プレビューは表示用のため、実際のPDFと細かなレイアウトが異なる場合があります
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SEO deep content (always visible — feeds Google bot) ===== */}
      <SeoContent data={SEO_CONTENT['/tools/seikyusho']} />

      {/* ===== Post-download self-promo (only after PDF DL) ===== */}
      {showPostDownload && (
        <section
          className="py-12 px-4 sm:px-6 bg-gradient-to-b from-blue-50 to-white border-t border-slate-200"
          aria-label="ダウンロード後のご案内"
        >
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
              {/* DL 完了表示 */}
              <div className="flex items-center gap-3 mb-6">
                <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-600">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <div className="flex-1">
                  <p className="text-sm sm:text-base font-medium text-slate-900">
                    請求書 PDF をダウンロードしました
                  </p>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    もう一度ダウンロード
                  </button>
                </div>
              </div>

              <hr className="border-slate-200 mb-6" />

              {/* 自社広告 — Free 訴求のみ、Pro 訴求禁止 */}
              <div>
                <p className="text-sm text-slate-500 mb-2">
                  おしごと AI からのお知らせ
                </p>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-4">
                  こういう機能、欲しくないですか？
                </h2>
                <ul className="space-y-2.5 mb-6">
                  {[
                    '弊社情報を一度入力したら次回から自動入力',
                    '過去の取引先・過去案件をワンクリックでコピー',
                    '「○○商事に先月分」と話すだけで請求書を作成',
                    'LINE から写真 1 枚で OCR + 請求書チェック',
                  ].map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-2 text-sm text-slate-700"
                    >
                      <span
                        className="flex-shrink-0 mt-0.5 w-4 h-4 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-600"
                        aria-hidden="true"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/dashboard"
                  onClick={() => handleCtaClick('signup')}
                  className="block w-full sm:w-auto sm:inline-block text-center px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  無料で AI 事務員を試す（30 秒登録）
                </a>
                <p className="mt-3 text-xs text-slate-500">
                  クレジットカード不要 / 月 30 回まで無料
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-400 text-center">
              <button
                type="button"
                onClick={() => {
                  handleCtaClick('tools');
                  navigate('/tools');
                }}
                className="hover:text-slate-600 transition-colors underline"
              >
                他の無料ツールを見る
              </button>
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small UI helpers                                                   */
/* ------------------------------------------------------------------ */

interface FieldsetProps {
  legend: string;
  children: React.ReactNode;
}

function Fieldset({ legend, children }: FieldsetProps) {
  return (
    <fieldset>
      <legend className="text-base font-semibold text-slate-900 mb-3">
        {legend}
      </legend>
      <div className="space-y-3">{children}</div>
    </fieldset>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

function TextField({ label, value, onChange, placeholder }: TextFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
      />
    </div>
  );
}

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function DateField({ label, value, onChange }: DateFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  muted?: boolean;
}

function Row({ label, value, muted }: RowProps) {
  return (
    <div
      className={`flex justify-between text-sm mb-1 ${
        muted ? 'text-slate-500 text-xs' : 'text-slate-600'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
