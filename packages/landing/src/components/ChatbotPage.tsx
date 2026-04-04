import { useState } from 'react';
import { useSeo } from '../hooks/useSeo';
import { trackDashboardConversion } from '../utils/gtag';

/* ──────────────────── Types ──────────────────── */

interface FaqItem {
  question: string;
  answer: string;
}

interface ChallengeCard {
  icon: 'phone' | 'yen' | 'shield';
  title: string;
  description: string;
}

interface FeatureCard {
  title: string;
  description: string;
}

interface StepItem {
  number: string;
  title: string;
  description: string;
}

interface ComparisonRow {
  label: string;
  other: string;
  fujitrace: string;
}

/* ──────────────────── Data ──────────────────── */

const challenges: ChallengeCard[] = [
  {
    icon: 'phone',
    title: '問い合わせ対応に人手が足りない',
    description:
      '増え続ける問い合わせに対応しきれず、顧客満足度が低下している',
  },
  {
    icon: 'yen',
    title: 'チャットbot導入の月額が高すぎる',
    description:
      '月額5万円以上の固定費は、導入効果が見えない段階では稟議が通らない',
  },
  {
    icon: 'shield',
    title: 'AIの品質やコストが不安',
    description:
      'ハルシネーションのリスクやAPI料金の増大が見えず、導入に踏み切れない',
  },
];

const features: FeatureCard[] = [
  {
    title: '5分で導入',
    description:
      'ドキュメントをアップロードし、デザインを設定。生成されたコードをサイトに貼り付けるだけで公開完了。APIキーの設定は不要です。',
  },
  {
    title: 'API実費のみ',
    description:
      'プラットフォーム利用料は0円。発生するのはLLM APIの従量課金のみ。他社チャットbotサービスの1/10以下のコストで運用できます。',
  },
  {
    title: '品質監視が標準搭載',
    description:
      '回答品質のスコアリング、ハルシネーション検知、API利用料の円換算リアルタイム表示。FujiTraceの監視機能が最初から組み込まれています。',
  },
];

const steps: StepItem[] = [
  {
    number: '01',
    title: 'ドキュメント登録',
    description:
      'PDFやWebページのURLから、チャットbotの知識ベースを自動構築します',
  },
  {
    number: '02',
    title: 'デザイン設定',
    description:
      'ブランドカラー、チャットウィンドウの配置やサイズをカスタマイズします',
  },
  {
    number: '03',
    title: 'コード貼り付け',
    description:
      '生成された埋め込みコードをサイトのHTMLに貼り付けるだけで公開完了',
  },
];

const comparisonRows: ComparisonRow[] = [
  { label: '初期費用', other: '¥100,000〜', fujitrace: '¥0' },
  {
    label: '月額料金',
    other: '¥50,000〜',
    fujitrace: '¥0（API実費のみ）',
  },
  { label: '品質監視', other: '別途導入が必要', fujitrace: '標準搭載' },
  {
    label: 'コスト可視化',
    other: 'なし',
    fujitrace: '円換算リアルタイム',
  },
  { label: '導入期間', other: '数週間', fujitrace: '5分' },
  {
    label: '日本語PII検出',
    other: 'なし',
    fujitrace: '15パターン以上',
  },
];

const faqItems: FaqItem[] = [
  {
    question: '本当に月額0円ですか？',
    answer:
      'はい。プラットフォーム利用料は一切かかりません。発生するのはLLM API（OpenAI、Claude等）の利用量に応じた従量課金のみです。使わない月は0円です。',
  },
  {
    question: 'どんなドキュメントに対応していますか？',
    answer:
      'PDF、Webページ（URL指定）、テキストファイルに対応しています。アップロードしたドキュメントから自動的にチャットbotの知識ベースを構築します。',
  },
  {
    question: 'セキュリティは大丈夫ですか？',
    answer:
      '国内サーバーでのデータ保持に対応しており、日本語の個人情報（氏名、電話番号、マイナンバー等15パターン以上）を自動検出・ブロックする機能を標準搭載しています。',
  },
  {
    question: '既存のWebサイトに影響はありますか？',
    answer:
      '影響はありません。生成されたJavaScriptコードを貼り付けるだけで、既存のサイトデザインや機能には一切干渉しません。',
  },
];

/* ──────────────────── Icons ──────────────────── */

function PhoneIcon() {
  return (
    <svg
      className="w-8 h-8 text-accent mb-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
      />
    </svg>
  );
}

function YenIcon() {
  return (
    <svg
      className="w-8 h-8 text-accent mb-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4l8 8m0 0l8-8m-8 8v8m-4-4h8m-8-4h8"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      className="w-8 h-8 text-accent mb-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}

const iconMap = {
  phone: PhoneIcon,
  yen: YenIcon,
  shield: ShieldIcon,
} as const;

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 8.25l-7.5 7.5-7.5-7.5"
      />
    </svg>
  );
}

/* ──────────────────── Component ──────────────────── */

/* ──────────────────── SEO ──────────────────── */

const CHATBOT_SEO = {
  title: 'AIチャットbot導入ならFujiTrace | 初期費用0円・月額0円・従量課金のみ',
  description: 'AIチャットbotを5分で導入。初期費用0円、月額0円、LLM API従量課金のみ。ハルシネーション監視・日本語PII検出・コスト可視化が標準搭載。問い合わせ対応の自動化ならFujiTrace。',
  url: 'https://fujitrace.jp/chatbot',
  ogTitle: 'AIチャットbot導入ならFujiTrace',
  jsonLd: [
    {
      id: 'chatbot-faq-jsonld',
      data: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
    },
    {
      id: 'chatbot-product-jsonld',
      data: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'FujiTrace AIチャットbot',
        description: 'AIチャットbotを5分で導入。初期費用0円、月額0円、LLM API従量課金のみ。',
        url: 'https://fujitrace.jp/chatbot',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'JPY',
          description: '初期費用0円・月額0円・LLM API従量課金のみ',
        },
        featureList: [
          '5分で導入完了',
          'LLM API従量課金のみ',
          'ハルシネーション検知',
          '日本語PII自動検出（15パターン以上）',
          'API利用料の円換算リアルタイム表示',
          '国内データ保持対応',
        ],
        author: { '@type': 'Organization', name: '合同会社Reminis', url: 'https://fujitrace.jp' },
      },
    },
  ],
};

export default function ChatbotPage() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useSeo(CHATBOT_SEO);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const handleBackClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo(0, 0);
  };

  return (
    <section className="pt-32 pb-16 sm:pb-24 px-4 sm:px-6">
      <div className="section-container max-w-4xl mx-auto">
        {/* Back link */}
        <a
          href="/"
          onClick={handleBackClick}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors duration-120 mb-8"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          トップに戻る
        </a>

        {/* 1. Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-2xl sm:text-display-sm font-semibold text-text-primary">
            AIチャットbotを、今すぐあなたのサイトに。
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed mt-4">
            初期費用0円・月額0円・AI利用量に応じた従量課金のみ。5分で導入、品質監視も標準搭載。
          </p>
          <div className="mt-8">
            <a
              href="/dashboard#chatbot"
              onClick={trackDashboardConversion}
              className="inline-flex items-center justify-center bg-accent text-white rounded-card px-8 py-4 font-semibold hover:bg-accent-hover transition-colors duration-120"
              aria-label="まずは5分で体験する"
            >
              まずは5分で体験する
            </a>
          </div>
        </div>

        {/* 2. 課題提起セクション */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-text-primary mb-6">
            こんな課題はありませんか？
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {challenges.map((challenge, index) => {
              const Icon = iconMap[challenge.icon];
              return (
                <div key={index} className="feature-card">
                  <Icon />
                  <h3 className="text-sm font-medium text-text-primary mb-2">
                    {challenge.title}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {challenge.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. 特徴セクション */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-text-primary mb-6">
            FujiTraceのAIチャットbotが選ばれる理由
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <h3 className="text-lg font-medium text-text-primary mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 4. 導入ステップセクション */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-text-primary mb-6">
            3ステップで導入完了
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, index) => (
              <div key={index}>
                <span className="text-3xl font-mono tabular-nums text-accent/20 font-bold">
                  {step.number}
                </span>
                <h3 className="text-lg font-medium text-text-primary mt-2">
                  {step.title}
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 5. 競合比較テーブルセクション */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-text-primary mb-6">
            他社サービスとの比較
          </h2>
          <div className="surface-card p-6 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left py-3 text-text-muted font-medium text-sm border-b border-border">
                    項目
                  </th>
                  <th className="text-left py-3 text-text-muted font-medium text-sm border-b border-border">
                    他社チャットbot
                  </th>
                  <th className="text-left py-3 text-text-muted font-medium text-sm border-b border-border">
                    FujiTrace
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, index) => (
                  <tr key={index} className="border-b border-border/50">
                    <td className="py-3 text-sm text-text-primary font-medium">
                      {row.label}
                    </td>
                    <td className="py-3 text-sm text-text-secondary">
                      {row.other}
                    </td>
                    <td className="py-3 text-sm text-accent font-medium">
                      {row.fujitrace}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6. FAQ セクション */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-text-primary mb-6">
            よくある質問
          </h2>
          <div className="surface-card px-6">
            {faqItems.map((item, index) => (
              <div key={index} className="border-b border-border last:border-b-0">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex justify-between items-center py-4 text-left text-text-primary font-medium text-sm hover:text-accent transition-colors duration-120"
                  aria-expanded={openFaqIndex === index}
                >
                  <span>{item.question}</span>
                  <ChevronIcon isOpen={openFaqIndex === index} />
                </button>
                {openFaqIndex === index && (
                  <p className="pb-4 text-sm text-text-secondary leading-relaxed">
                    {item.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 7. Final CTA Section */}
        <div className="text-center py-16 sm:py-24">
          <h2 className="text-xl font-semibold text-text-primary mb-4">
            AIチャットbotで、問い合わせ対応を自動化しませんか？
          </h2>
          <p className="text-lg text-text-secondary mb-8">
            初期費用0円・月額0円。まずは5分で体験してください。
          </p>
          <a
            href="/dashboard#chatbot"
            onClick={trackDashboardConversion}
            className="inline-flex items-center justify-center bg-accent text-white rounded-card px-8 py-4 font-semibold hover:bg-accent-hover transition-colors duration-120"
            aria-label="無料で始める"
          >
            無料で始める
          </a>
          <p className="text-sm text-text-muted mt-4">
            ※ クレジットカード不要で始められます
          </p>
        </div>
      </div>
    </section>
  );
}
