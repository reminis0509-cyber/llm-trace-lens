/**
 * /tools/soufu — 送付状テンプレート 無料 (Freemium 第 1 層 Phase B)
 *
 * 戦略 doc Section 5.6 / Section 18.2.N (Founder 承認 2026-04-29)
 *
 * 役割:
 *   - SEO 集客装置。ターゲット流入語「送付状 テンプレート 無料」(256/月)
 *     ※ 履歴書文脈と分離するため、本文・コピーをビジネス書類用に統一
 *   - 認証不要・登録不要・コスト 0 で完結する純粋関数ツール
 *   - PDF DL 直後にのみ「自社広告」(第 2 層 Free 登録誘導) を提示
 *
 * 送付状は明細表・合計欄なし — 同封書類リスト + 本文の手紙形式。
 */
import { useEffect, useRef, useState } from 'react';
import { useSeo } from '../../hooks/useSeo';
import { todayIso, formatJapaneseDate } from './_shared/formatting';
import { Fieldset, TextField, DateField, TextAreaField } from './_shared/FormControls';
import PostDownloadPanel from './_shared/PostDownloadPanel';
import type { CoverLetterPdfData, IssuerInfo } from '../../lib/pdf/cover-letter';

interface IssuerForm {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  representative: string;
}

interface ClientForm {
  companyName: string;
  contactPerson: string;
}

interface CoverForm {
  issueDate: string;
  subject: string;
  body: string;
  notes: string;
}

const DEFAULT_BODY =
  'このたびは平素より格別のお引き立てを賜り、誠にありがとうございます。\n下記書類をお送りいたしますので、ご査収のほどお願い申し上げます。';

function trackEvent(
  name:
    | 'tools_soufu_page_view'
    | 'tools_soufu_form_started'
    | 'tools_soufu_pdf_downloaded'
    | 'tools_soufu_cta_clicked',
  params?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params ?? {});
}

export default function SoufuPage() {
  useSeo({
    title: '送付状テンプレート 無料｜ビジネス書類用｜おしごと AI',
    description:
      'ビジネス書類（請求書・見積書・契約書）に同封する送付状を無料で作成・PDFダウンロード。会員登録不要、同封書類リスト対応。月¥3,000 で AI 事務員に進化。',
    url: 'https://oshigoto.ai/tools/soufu',
    ogTitle: '送付状テンプレート 無料｜ビジネス書類用',
    jsonLd: [
      {
        id: 'jsonld-soufu-webpage',
        data: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: '送付状テンプレート 無料 (ビジネス書類用)',
          url: 'https://oshigoto.ai/tools/soufu',
          description:
            'ビジネス書類に同封する送付状を無料で作成・PDFダウンロード。同封書類リスト対応。',
          inLanguage: 'ja-JP',
          isPartOf: { '@type': 'WebSite', name: 'おしごと AI', url: 'https://oshigoto.ai' },
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'ホーム', item: 'https://oshigoto.ai/' },
              { '@type': 'ListItem', position: 2, name: '無料ツール', item: 'https://oshigoto.ai/tools' },
              { '@type': 'ListItem', position: 3, name: '送付状', item: 'https://oshigoto.ai/tools/soufu' },
            ],
          },
        },
      },
    ],
  });

  const [issuer, setIssuer] = useState<IssuerForm>({
    companyName: '',
    address: '',
    phone: '',
    email: '',
    representative: '',
  });
  const [client, setClient] = useState<ClientForm>({ companyName: '', contactPerson: '' });
  const [meta, setMeta] = useState<CoverForm>(() => ({
    issueDate: todayIso(),
    subject: '書類送付のご案内',
    body: DEFAULT_BODY,
    notes: '',
  }));
  const [enclosures, setEnclosures] = useState<string[]>(['請求書 1 部']);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showPostDownload, setShowPostDownload] = useState(false);

  const formStartedRef = useRef(false);
  useEffect(() => {
    trackEvent('tools_soufu_page_view');
  }, []);

  function markFormStarted(): void {
    if (formStartedRef.current) return;
    formStartedRef.current = true;
    trackEvent('tools_soufu_form_started');
  }

  const updateEnclosure = (index: number, value: string): void => {
    markFormStarted();
    setEnclosures((prev) => prev.map((e, i) => (i === index ? value : e)));
  };
  const addEnclosure = (): void => {
    markFormStarted();
    setEnclosures((prev) => [...prev, '']);
  };
  const removeEnclosure = (index: number): void => {
    setEnclosures((prev) => prev.filter((_, i) => i !== index));
  };

  async function handleDownloadPdf(): Promise<void> {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const issuerInfo: IssuerInfo = {
        companyName: issuer.companyName || undefined,
        address: issuer.address || undefined,
        phone: issuer.phone || undefined,
        email: issuer.email || undefined,
        representative: issuer.representative || undefined,
      };

      const pdfData: CoverLetterPdfData = {
        issue_date: meta.issueDate ? formatJapaneseDate(meta.issueDate) : undefined,
        client: {
          company_name: client.companyName || undefined,
          honorific: '御中',
          contact_person: client.contactPerson || undefined,
        },
        subject: meta.subject || undefined,
        enclosures: enclosures.filter((e) => e.trim().length > 0),
        body: meta.body || undefined,
        notes: meta.notes || undefined,
      };

      const { generateCoverLetterPdf } = await import('../../lib/pdf/cover-letter');
      const blob = await generateCoverLetterPdf(pdfData, issuerInfo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cover-letter.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      trackEvent('tools_soufu_pdf_downloaded', {
        enclosure_count: enclosures.filter((e) => e.trim().length > 0).length,
        has_issuer_company: !!issuer.companyName,
        has_client_company: !!client.companyName,
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
    trackEvent('tools_soufu_cta_clicked', { target });
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
            送付状を、無料で作成。
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-3">
            請求書・見積書などビジネス書類に同封する送付状を、PDF ですぐ出力。
          </p>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6">
            ※ 履歴書用ではなく、ビジネス書類同封用のフォーマットです。
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
              <Fieldset legend="差出人（自社情報）">
                <TextField label="会社名" value={issuer.companyName} onChange={(v) => { markFormStarted(); setIssuer((s) => ({ ...s, companyName: v })); }} placeholder="株式会社あなたの会社" />
                <TextField label="代表者・担当者名" value={issuer.representative} onChange={(v) => { markFormStarted(); setIssuer((s) => ({ ...s, representative: v })); }} placeholder="担当: 山田 太郎" />
                <TextField label="住所" value={issuer.address} onChange={(v) => { markFormStarted(); setIssuer((s) => ({ ...s, address: v })); }} placeholder="東京都中央区銀座一丁目22番11号" />
                <TextField label="電話番号" value={issuer.phone} onChange={(v) => { markFormStarted(); setIssuer((s) => ({ ...s, phone: v })); }} placeholder="03-0000-0000" />
                <TextField label="メール" value={issuer.email} onChange={(v) => { markFormStarted(); setIssuer((s) => ({ ...s, email: v })); }} placeholder="info@example.com" />
              </Fieldset>

              <Fieldset legend="宛先">
                <TextField label="会社名" value={client.companyName} onChange={(v) => { markFormStarted(); setClient((s) => ({ ...s, companyName: v })); }} placeholder="株式会社○○商事" />
                <TextField label="ご担当者名" value={client.contactPerson} onChange={(v) => { markFormStarted(); setClient((s) => ({ ...s, contactPerson: v })); }} placeholder="営業部 鈴木 様" />
              </Fieldset>

              <Fieldset legend="送付状の内容">
                <DateField label="発行日" value={meta.issueDate} onChange={(v) => { markFormStarted(); setMeta((s) => ({ ...s, issueDate: v })); }} />
                <TextField label="件名" value={meta.subject} onChange={(v) => { markFormStarted(); setMeta((s) => ({ ...s, subject: v })); }} placeholder="書類送付のご案内" />
                <TextAreaField label="本文" value={meta.body} onChange={(v) => { markFormStarted(); setMeta((s) => ({ ...s, body: v })); }} rows={5} placeholder={DEFAULT_BODY} />
                <TextAreaField label="備考" value={meta.notes} onChange={(v) => { markFormStarted(); setMeta((s) => ({ ...s, notes: v })); }} placeholder="その他、特記事項があれば" />
              </Fieldset>

              <Fieldset legend="同封書類">
                <div className="space-y-2">
                  {enclosures.map((value, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-sm text-slate-400 w-6 text-right tabular-nums">
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => updateEnclosure(index, e.target.value)}
                        placeholder="例: 請求書 1 部"
                        aria-label={`同封書類 ${index + 1}`}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-w-0"
                      />
                      {enclosures.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEnclosure(index)}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                          aria-label={`同封書類 ${index + 1} を削除`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addEnclosure}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  ＋ 同封書類を追加
                </button>
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
                    送　付　状
                  </h2>
                </div>

                <p className="text-right text-xs text-slate-600 mb-4">
                  {formatJapaneseDate(meta.issueDate) || '---'}
                </p>

                <div className="mb-4 pb-2 border-b border-slate-200">
                  <p className="text-base font-medium text-slate-900">
                    {client.companyName || '(宛先 未入力)'}{' '}
                    <span className="text-slate-400 font-normal">御中</span>
                  </p>
                  {client.contactPerson && (
                    <p className="text-sm text-slate-700 mt-1">{client.contactPerson} 様</p>
                  )}
                </div>

                <div className="text-right mb-6 text-sm">
                  <p className="font-medium text-slate-900">
                    {issuer.companyName || '(自社名 未入力)'}
                  </p>
                  {issuer.address && <p className="text-xs text-slate-600 mt-0.5">{issuer.address}</p>}
                  {issuer.phone && <p className="text-xs text-slate-600 mt-0.5">TEL: {issuer.phone}</p>}
                  {issuer.email && <p className="text-xs text-slate-600 mt-0.5">{issuer.email}</p>}
                  {issuer.representative && (
                    <p className="text-xs text-slate-700 mt-0.5">{issuer.representative}</p>
                  )}
                  <div className="inline-flex items-center justify-center w-12 h-12 mt-3 border border-slate-300 text-slate-400 text-xs">
                    印
                  </div>
                </div>

                {meta.subject && (
                  <p className="text-center font-bold text-base text-slate-900 py-2 my-4 border-y border-slate-300">
                    {meta.subject}
                  </p>
                )}

                <p className="text-sm text-slate-700 leading-relaxed mb-3">
                  拝啓 時下ますますご清祥のこととお慶び申し上げます。<br />
                  平素は格別のお引き立てを賜り、厚く御礼申し上げます。
                </p>

                {meta.body && (
                  <p className="text-sm text-slate-900 leading-relaxed mb-4 whitespace-pre-wrap">
                    {meta.body}
                  </p>
                )}

                <p className="text-right text-sm text-slate-700 mb-6">敬具</p>

                {enclosures.filter((e) => e.trim().length > 0).length > 0 && (
                  <>
                    <p className="text-center text-sm font-medium text-slate-900 mb-2">記</p>
                    <div className="border border-slate-200 rounded-lg p-4 mb-2">
                      <p className="text-sm text-slate-900 mb-2 pb-1 border-b border-slate-100">
                        同封書類
                      </p>
                      {enclosures
                        .filter((e) => e.trim().length > 0)
                        .map((item, i) => (
                          <p key={i} className="text-sm text-slate-900 pl-2 mb-1">
                            <span className="text-slate-500 mr-2 tabular-nums">{i + 1}.</span>
                            {item}
                          </p>
                        ))}
                    </div>
                    <p className="text-right text-sm text-slate-700">以上</p>
                  </>
                )}

                {meta.notes && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500">備考: {meta.notes}</p>
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

      {showPostDownload && (
        <PostDownloadPanel
          documentName="送付状"
          onDownloadAgain={handleDownloadPdf}
          onCtaClick={handleCtaClick}
          navigate={navigate}
        />
      )}
    </div>
  );
}
