import { useState } from 'react';

/**
 * FAQ — 中小企業決裁者の本音の疑問に答える 7 問 (2026-04-22 新設)
 *
 * ChatGPT との違い / データ漏洩 / 導入期間 / 解約 / 士業法 / freee 併用 / 社員研修。
 * アコーディオンで老舗 SaaS 風に。絵文字禁止。
 */
interface FaqEntry {
  q: string;
  a: React.ReactNode;
}

const faqs: FaqEntry[] = [
  {
    q: 'ChatGPT や Claude と、具体的に何が違うのですか?',
    a: (
      <>
        汎用チャット AI との違いは三点あります。まず、日本のビジネス商慣習 (敬語・インボイス・支払サイト)
        に準拠した書類を出力します。次に、データは国内リージョンに滞留し海外に流れません。
        最後に、書類 5 種や業務システム 9 連携にあわせた業務設計をあらかじめ持っており、
        「何を頼めばいいか分からない」段階からすぐに使い始められます。
      </>
    ),
  },
  {
    q: '入力した顧客データが、外部に漏れる心配はありませんか?',
    a: (
      <>
        業務データは国内リージョンに限定して保管します。外部 LLM API
        を呼び出す際は、必要最小限の情報のみを送信し、マイナンバー・口座番号など日本固有の機密情報 15 種類以上は
        自動検出のうえ遮断する仕組みを備えています。OAuth トークンは AES-256-GCM で暗号化して保管します。
      </>
    ),
  },
  {
    q: '導入までに何日かかりますか? 何を準備すればよいですか?',
    a: (
      <>
        個人・SOHO 向けの Pro プランであれば、クレジットカード登録のみで当日から利用できます。
        中小企業 5〜20 名向けの Team プランは、管理者アカウントの発行とメンバー招待で最短翌営業日から開始可能です。
        業務システム連携を行う場合は、Google ・ freee ・ Chatwork などの管理者権限があるとスムーズです。
      </>
    ),
  },
  {
    q: '解約は簡単にできますか? データはどうなりますか?',
    a: (
      <>
        Pro / Team / Max プランはダッシュボードから即時解約できます。違約金・最低利用期間はありません。
        解約後はデータのエクスポートを 30 日間お選びいただけます。エクスポート後は、国内リージョンから
        完全消去する運用です。Enterprise プランは契約書に基づく個別対応となります。
      </>
    ),
  },
  {
    q: '税理士や社労士の仕事も、AI 社員が奪ってしまうのでは?',
    a: (
      <>
        いいえ。税務申告・登記申請・労務手続きなど、税理士法・司法書士法・社労士法に定められた独占業務は
        意図的に対応範囲から除外しています。 AI 社員は「下書き ・ チェック ・ 集計」など非独占業務に限定し、
        士業の先生方と併走する前提で設計しています。
      </>
    ),
  },
  {
    q: '既に freee ・ サイボウズ ・ Chatwork を使っています。併用できますか?',
    a: (
      <>
        はい、併用を前提に設計しています。 Google Calendar / Gmail / Drive / Slack / Chatwork / freee / Notion / GitHub / LINE
        の 9 種と OAuth 連携が可能です。既存システムで管理している顧客 DB ・ 会計データを
        AI 社員から参照し、書類ドラフトや議事録に自動反映できます。
      </>
    ),
  },
  {
    q: '社員への研修は必要ですか?',
    a: (
      <>
        ご希望に応じて、4 章構成のチュートリアル教材と修了証を標準でご提供しています。
        登録不要で試せるため、まずは管理部門の担当者がチュートリアルを完走し、社内展開の可否を
        判断いただくケースが多いです。 Enterprise プランでは、オンサイト研修や運用手順書の整備も個別にご相談いただけます。
      </>
    ),
  },
];

function FaqItem({ entry, isOpen, onToggle }: { entry: FaqEntry; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        className="w-full flex items-start justify-between gap-4 py-5 text-left group"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="text-sm sm:text-base font-medium text-text-primary leading-snug group-hover:text-accent transition-colors duration-120">
          {entry.q}
        </span>
        <span className="flex-shrink-0 w-6 h-6 mt-0.5 rounded-card border border-border flex items-center justify-center text-text-muted group-hover:border-accent group-hover:text-accent transition-colors duration-120">
          <svg
            className={`w-3 h-3 transition-transform duration-150 ${isOpen ? 'rotate-45' : ''}`}
            fill="none"
            viewBox="0 0 12 12"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" d="M6 2v8M2 6h8" />
          </svg>
        </span>
      </button>
      {isOpen && (
        <div className="pb-5 pr-10 text-sm text-text-secondary leading-relaxed">{entry.a}</div>
      )}
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-5">
            よくあるご質問
          </span>
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            よくあるご質問
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            導入検討時にご質問いただくことが多い 7 項目です。
          </p>
        </div>

        <div className="max-w-3xl mx-auto surface-card px-6 sm:px-8">
          {faqs.map((entry, idx) => (
            <FaqItem
              key={entry.q}
              entry={entry}
              isOpen={openIndex === idx}
              onToggle={() => setOpenIndex(openIndex === idx ? null : idx)}
            />
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-text-muted">
            上記以外のご質問は
            <a
              href="mailto:contact@fujitrace.com"
              className="text-accent hover:underline underline-offset-2 mx-1"
            >
              contact@fujitrace.com
            </a>
            までお気軽にお問い合わせください。
          </p>
        </div>
      </div>
    </section>
  );
}
