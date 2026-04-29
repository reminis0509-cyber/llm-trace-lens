/**
 * /tools/hatchu — 発注書テンプレート 無料 (Freemium 第 1 層 Phase B)
 *
 * 戦略 doc Section 5.6 / Section 18.2.N (Founder 承認 2026-04-29)
 *
 * 役割:
 *   - SEO 集客装置。ターゲット流入語「発注書 作成」(136/月) ほか
 *   - 認証不要・登録不要・コスト 0 で完結する純粋関数ツール
 *   - PDF DL 直後にのみ「自社広告」(第 2 層 Free 登録誘導) を提示
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSeo } from '../../hooks/useSeo';
import {
  formatJpy,
  todayIso,
  addDaysIso,
  formatJapaneseDate,
} from './_shared/formatting';
import { Fieldset, TextField, DateField, TextAreaField, Row } from './_shared/FormControls';
import PostDownloadPanel from './_shared/PostDownloadPanel';
import SeoContent from './_shared/SeoContent';
import { TOOLS_SEO, buildAllJsonLd, CANONICAL_ORIGIN } from '../../data/seo-tools';
import { SEO_CONTENT } from '../../data/seo-content';
import type { PurchaseOrderPdfData, IssuerInfo } from '../../lib/pdf/purchase-order';

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
}

interface ClientForm {
  companyName: string;
  contactPerson: string;
}

interface OrderForm {
  orderNumber: string;
  issueDate: string;
  deliveryDate: string;
  subject: string;
  deliveryLocation: string;
  notes: string;
}

function trackEvent(
  name:
    | 'tools_hatchu_page_view'
    | 'tools_hatchu_form_started'
    | 'tools_hatchu_pdf_downloaded'
    | 'tools_hatchu_cta_clicked',
  params?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params ?? {});
}

export default function HatchuPage() {
  const seoConfig = TOOLS_SEO['/tools/hatchu'];
  const jsonLd = useMemo(() => buildAllJsonLd(seoConfig), [seoConfig]);
  useSeo({
    title: seoConfig.title,
    description: seoConfig.description,
    url: `${CANONICAL_ORIGIN}${seoConfig.path}`,
    ogTitle: seoConfig.ogTitle,
    jsonLd,
  });

  const [issuer, setIssuer] = useState<IssuerForm>({ companyName: '', address: '', phone: '' });
  const [client, setClient] = useState<ClientForm>({ companyName: '', contactPerson: '' });
  const [meta, setMeta] = useState<OrderForm>(() => {
    const today = todayIso();
    return {
      orderNumber: `PO-${today.replace(/-/g, '')}-001`,
      issueDate: today,
      deliveryDate: addDaysIso(today, 14),
      subject: '',
      deliveryLocation: '',
      notes: '',
    };
  });
  const [items, setItems] = useState<LineItem[]>([
    { name: '', unitPrice: '', quantity: 1, taxKind: '10' },
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showPostDownload, setShowPostDownload] = useState(false);

  const formStartedRef = useRef(false);
  useEffect(() => {
    trackEvent('tools_hatchu_page_view');
  }, []);

  function markFormStarted(): void {
    if (formStartedRef.current) return;
    formStartedRef.current = true;
    trackEvent('tools_hatchu_form_started');
  }

  const subtotalsByTax: Record<TaxKind, number> = { '10': 0, '8': 0, '0': 0 };
  for (const item of items) {
    const price = Number(item.unitPrice) || 0;
    subtotalsByTax[item.taxKind] += price * item.quantity;
  }
  const subtotal = subtotalsByTax['10'] + subtotalsByTax['8'] + subtotalsByTax['0'];
  const tax10 = Math.floor(subtotalsByTax['10'] * 0.1);
  const tax8 = Math.floor(subtotalsByTax['8'] * 0.08);
  const taxTotal = tax10 + tax8;
  const total = subtotal + taxTotal;

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
    setItems((prev) => [...prev, { name: '', unitPrice: '', quantity: 1, taxKind: '10' }]);
  };

  const removeItem = (index: number): void => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  async function handleDownloadPdf(): Promise<void> {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const issuerInfo: IssuerInfo = {
        companyName: issuer.companyName || undefined,
        address: issuer.address || undefined,
        phone: issuer.phone || undefined,
      };

      const pdfData: PurchaseOrderPdfData = {
        order_number: meta.orderNumber || undefined,
        issue_date: meta.issueDate ? formatJapaneseDate(meta.issueDate) : undefined,
        delivery_date: meta.deliveryDate ? formatJapaneseDate(meta.deliveryDate) : undefined,
        client: {
          company_name: client.companyName || undefined,
          honorific: '御中',
          contact_person: client.contactPerson || undefined,
        },
        subject: meta.subject || undefined,
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
        delivery_location: meta.deliveryLocation || undefined,
        notes: meta.notes || undefined,
      };

      const { generatePurchaseOrderPdf } = await import('../../lib/pdf/purchase-order');
      const blob = await generatePurchaseOrderPdf(pdfData, issuerInfo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeNumber = (meta.orderNumber || 'order').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `${safeNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      trackEvent('tools_hatchu_pdf_downloaded', {
        item_count: items.length,
        has_issuer_company: !!issuer.companyName,
        has_client_company: !!client.companyName,
        total_jpy: total,
      });
      setShowPostDownload(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'PDFの生成に失敗しました。';
      setGenerationError(`PDFの生成中にエラーが発生しました: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCtaClick(target: 'signup' | 'tools'): void {
    trackEvent('tools_hatchu_cta_clicked', { target });
  }

  function navigate(href: string): void {
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo(0, 0);
  }

  return (
    <div className="bg-white">
      <section className="pt-24 sm:pt-32 pb-10 sm:pb-14 px-4 sm:px-6 bg-gradient-to-b from-blue-50/40 to-white">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs sm:text-sm font-medium text-blue-600 mb-3 tracking-wide">
            無料テンプレート
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 leading-tight mb-5">
            発注書テンプレートを無料で作成
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-6">
            会員登録不要、PDF ですぐ出力。自動計算・税区分（10% / 8% / 非課税）対応。
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

      <section className="py-10 sm:py-14 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-7 space-y-7">
              <Fieldset legend="自社情報（発注者）">
                <TextField label="会社名" value={issuer.companyName} onChange={(v) => { markFormStarted(); setIssuer((s) => ({ ...s, companyName: v })); }} placeholder="株式会社あなたの会社" />
                <TextField label="住所" value={issuer.address} onChange={(v) => { markFormStarted(); setIssuer((s) => ({ ...s, address: v })); }} placeholder="東京都中央区銀座一丁目22番11号" />
                <TextField label="電話番号" value={issuer.phone} onChange={(v) => { markFormStarted(); setIssuer((s) => ({ ...s, phone: v })); }} placeholder="03-0000-0000" />
              </Fieldset>

              <Fieldset legend="発注先（受注者）">
                <TextField label="会社名" value={client.companyName} onChange={(v) => { markFormStarted(); setClient((s) => ({ ...s, companyName: v })); }} placeholder="株式会社○○商事" />
                <TextField label="ご担当者名" value={client.contactPerson} onChange={(v) => { markFormStarted(); setClient((s) => ({ ...s, contactPerson: v })); }} placeholder="山田 太郎" />
              </Fieldset>

              <Fieldset legend="発注書情報">
                <TextField label="発注番号" value={meta.orderNumber} onChange={(v) => { markFormStarted(); setMeta((s) => ({ ...s, orderNumber: v })); }} placeholder="PO-20260429-001" />
                <TextField label="件名" value={meta.subject} onChange={(v) => { markFormStarted(); setMeta((s) => ({ ...s, subject: v })); }} placeholder="○○商品の発注" />
                <DateField label="発行日" value={meta.issueDate} onChange={(v) => { markFormStarted(); setMeta((s) => ({ ...s, issueDate: v })); }} />
                <DateField label="納品希望日" value={meta.deliveryDate} onChange={(v) => { markFormStarted(); setMeta((s) => ({ ...s, deliveryDate: v })); }} />
              </Fieldset>

              <Fieldset legend="発注品目">
                <div className="space-y-3">
                  <div className="hidden sm:grid grid-cols-[1fr_5rem_5rem_4.5rem_2rem] gap-2 text-xs text-slate-500 px-1">
                    <span>品名</span>
                    <span className="text-right">単価</span>
                    <span className="text-right">数量</span>
                    <span className="text-center">税</span>
                    <span />
                  </div>
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_5rem_5rem_4.5rem_2rem] gap-2 sm:items-center">
                      <input type="text" value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} placeholder="商品 A" aria-label={`品目${index + 1}の名称`} className="px-3 py-2 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-0" />
                      <input type="text" inputMode="numeric" value={item.unitPrice} onChange={(e) => handleUnitPriceChange(index, e.target.value)} placeholder="単価" aria-label={`品目${index + 1}の単価`} className="px-2 py-2 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                      <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(index, 'quantity', Math.max(1, Number(e.target.value) || 1))} aria-label={`品目${index + 1}の数量`} className="px-2 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                      <select value={item.taxKind} onChange={(e) => updateItem(index, 'taxKind', e.target.value as TaxKind)} aria-label={`品目${index + 1}の税区分`} className="px-2 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                        <option value="10">10%</option>
                        <option value="8">8%</option>
                        <option value="0">非課税</option>
                      </select>
                      {items.length > 1 ? (
                        <button type="button" onClick={() => removeItem(index)} className="w-7 h-7 mx-auto flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" aria-label={`品目${index + 1}を削除`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                <button type="button" onClick={addItem} className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
                  ＋ 品目を追加
                </button>
              </Fieldset>

              <Fieldset legend="補足情報">
                <TextField label="納品場所" value={meta.deliveryLocation} onChange={(v) => { markFormStarted(); setMeta((s) => ({ ...s, deliveryLocation: v })); }} placeholder="東京都中央区銀座 ... (弊社住所と同じ)" />
                <TextAreaField label="備考" value={meta.notes} onChange={(v) => { markFormStarted(); setMeta((s) => ({ ...s, notes: v })); }} placeholder="その他、特記事項があれば" />
              </Fieldset>

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
                  <p className="mt-3 text-sm text-red-600" role="alert">{generationError}</p>
                )}
                <p className="mt-2 text-xs text-slate-400 text-center">
                  会員登録不要・無料 / 入力データはサーバーに送信されません
                </p>
              </div>
            </div>

            {/* Preview */}
            <div className="lg:sticky lg:top-24 self-start">
              <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-7 shadow-sm">
                <div className="text-center mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-[0.4em]">
                    発　注　書
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-4 pb-4 mb-4 border-b border-slate-200">
                  <div>
                    <p className="text-base font-medium text-slate-900">
                      {client.companyName || '(発注先 未入力)'}{' '}
                      <span className="text-slate-400 font-normal">御中</span>
                    </p>
                    {client.contactPerson && (
                      <p className="text-sm text-slate-700 mt-1">{client.contactPerson} 様</p>
                    )}
                    <div className="mt-3 space-y-0.5 text-xs text-slate-600">
                      <p>発注番号: {meta.orderNumber || '---'}</p>
                      <p>発行日: {formatJapaneseDate(meta.issueDate) || '---'}</p>
                      <p>納品希望日: {formatJapaneseDate(meta.deliveryDate) || '---'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 mb-1">発注元</p>
                    <p className="text-sm font-medium text-slate-900">
                      {issuer.companyName || '(自社名 未入力)'}
                    </p>
                    {issuer.address && <p className="text-xs text-slate-600 mt-0.5">{issuer.address}</p>}
                    {issuer.phone && <p className="text-xs text-slate-600 mt-0.5">TEL: {issuer.phone}</p>}
                    <div className="inline-flex items-center justify-center w-12 h-12 mt-3 border border-slate-300 text-slate-400 text-xs">
                      印
                    </div>
                  </div>
                </div>

                {meta.subject && (
                  <div className="border-y border-slate-200 py-2 mb-4 flex">
                    <span className="text-xs text-slate-500 w-14">件　名</span>
                    <span className="text-sm text-slate-900 flex-1">{meta.subject}</span>
                  </div>
                )}

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
                        const amount = (Number(item.unitPrice) || 0) * item.quantity;
                        return (
                          <tr key={index} className="border-b border-slate-100">
                            <td className="py-2 px-1 text-center text-slate-700 tabular-nums">{index + 1}</td>
                            <td className="py-2 px-2 text-slate-900">
                              {item.name || '---'}
                              {item.taxKind !== '10' && (
                                <span className="ml-1 text-xs text-slate-500">
                                  ({item.taxKind === '8' ? '軽減 8%' : '非課税'})
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-1 text-right text-slate-700 tabular-nums">{item.quantity}</td>
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

                <div className="mt-4 ml-auto max-w-xs bg-slate-50 rounded-lg p-4">
                  <Row label="小計" value={formatJpy(subtotal)} />
                  {subtotalsByTax['10'] > 0 && (
                    <Row label={`内 10% 対象 (${formatJpy(subtotalsByTax['10'])})`} value={`消費税 ${formatJpy(tax10)}`} muted />
                  )}
                  {subtotalsByTax['8'] > 0 && (
                    <Row label={`内 8% 対象 (${formatJpy(subtotalsByTax['8'])})`} value={`消費税 ${formatJpy(tax8)}`} muted />
                  )}
                  {subtotalsByTax['0'] > 0 && (
                    <Row label={`非課税対象 (${formatJpy(subtotalsByTax['0'])})`} value="—" muted />
                  )}
                  <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-bold text-slate-900">
                    <span>合計</span>
                    <span className="tabular-nums text-lg">{formatJpy(total)}</span>
                  </div>
                </div>

                {(meta.deliveryLocation || meta.notes) && (
                  <div className="mt-5 pt-4 border-t border-slate-100 space-y-2 text-sm">
                    {meta.deliveryLocation && (
                      <div>
                        <p className="text-slate-500 text-xs mb-0.5">納品場所</p>
                        <p className="text-slate-900">{meta.deliveryLocation}</p>
                      </div>
                    )}
                    {meta.notes && (
                      <div>
                        <p className="text-slate-500 text-xs mb-0.5">備考</p>
                        <p className="text-slate-900 whitespace-pre-wrap">{meta.notes}</p>
                      </div>
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
      <SeoContent data={SEO_CONTENT['/tools/hatchu']} />

      {showPostDownload && (
        <PostDownloadPanel
          documentName="発注書"
          onDownloadAgain={handleDownloadPdf}
          onCtaClick={handleCtaClick}
          navigate={navigate}
        />
      )}
    </div>
  );
}
