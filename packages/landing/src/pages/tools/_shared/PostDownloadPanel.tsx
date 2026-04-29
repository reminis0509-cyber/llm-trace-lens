/**
 * Post-download self-promo panel shown only after a user successfully clicks
 * "PDFをダウンロード" on any /tools/* page.
 *
 * 戦略 doc Section 18.2.N (Founder 承認 2026-04-29):
 *   第 1 段訴求 = 「Free 登録誘導のみ」
 *   Pro / 月額訴求はここでは禁止 (転換率を下げるため、第 2 段で行う)
 */
import { trackDashboardConversion } from '../../../utils/gtag';

interface PostDownloadPanelProps {
  /** Document name shown in the success line, e.g. "見積書". */
  documentName: string;
  /** Re-trigger PDF download. */
  onDownloadAgain: () => void;
  /** Tracking handler — called when CTA links are clicked. */
  onCtaClick: (target: 'signup' | 'tools') => void;
  /** Programmatic SPA navigate. */
  navigate: (href: string) => void;
}

export default function PostDownloadPanel({
  documentName,
  onDownloadAgain,
  onCtaClick,
  navigate,
}: PostDownloadPanelProps) {
  return (
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
                {documentName} PDF をダウンロードしました
              </p>
              <button
                type="button"
                onClick={onDownloadAgain}
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
                `「○○商事に先月分」と話すだけで${documentName}を作成`,
                'LINE から写真 1 枚で OCR + 書類チェック',
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
              onClick={() => {
                onCtaClick('signup');
                trackDashboardConversion();
              }}
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
              onCtaClick('tools');
              navigate('/tools');
            }}
            className="hover:text-slate-600 transition-colors underline"
          >
            他の無料ツールを見る
          </button>
        </p>
      </div>
    </section>
  );
}
