import React from 'react';

interface FeatureCard {
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface Step {
  number: number;
  title: string;
  description: string;
}

interface ComparisonRow {
  label: string;
  competitor: string;
  fujitrace: string;
}

const featureCards: FeatureCard[] = [
  {
    title: '5分で導入',
    description:
      'ドキュメントをアップロードして、埋め込みコードをコピペするだけ。APIキーの取得も不要です。',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    title: 'API実費のみ',
    description:
      'プラットフォーム利用料0円。かかるのはLLM APIの従量課金だけ。競合の1/10以下のコストで運用できます。',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M15 9.5c-.5-1-1.5-1.5-3-1.5-2 0-3 1-3 2.5s1.5 2 3 2.5 3 1 3 2.5-1 2.5-3 2.5c-1.5 0-2.5-.5-3-1.5" />
        <path d="M12 5.5v1M12 17.5v1" />
      </svg>
    ),
  },
  {
    title: '品質監視が標準搭載',
    description:
      '回答品質スコア、ハルシネーション検知、コスト円換算。FujiTraceの監視が最初から動いています。',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
];

const steps: Step[] = [
  {
    number: 1,
    title: 'ドキュメントを登録',
    description: 'PDFやURLを登録するだけで知識ベースを構築',
  },
  {
    number: 2,
    title: 'デザインを設定',
    description: 'ブランドカラーや配置をカスタマイズ',
  },
  {
    number: 3,
    title: 'コードを貼り付け',
    description: '生成されたコードをサイトにコピペして完了',
  },
];

const comparisonData: ComparisonRow[] = [
  { label: '月額料金', competitor: '¥50,000~', fujitrace: '0円' },
  { label: '初期費用', competitor: '¥100,000~', fujitrace: '0円' },
  { label: '品質監視', competitor: '別途導入', fujitrace: '標準搭載' },
  { label: 'コスト可視化', competitor: 'なし', fujitrace: '円換算リアルタイム' },
  { label: '導入期間', competitor: '数週間', fujitrace: '5分' },
];

function ArrowConnector() {
  return (
    <div className="hidden md:flex items-center justify-center" aria-hidden="true">
      <svg
        width="32"
        height="24"
        viewBox="0 0 32 24"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12h24M22 6l6 6-6 6" />
      </svg>
    </div>
  );
}

export default function ChatbotSection() {
  return (
    <section id="chatbot" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            AIチャットbot
          </span>
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            AIチャットbotを、今すぐあなたのサイトに。
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            初期費用0円・月額0円。LLM API従量課金のみ。FujiTraceの品質監視が最初から組み込まれています。
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20">
          {featureCards.map((card, index) => (
            <div key={index} className="feature-card">
              <div className="w-10 h-10 rounded-card bg-accent-dim flex items-center justify-center text-accent mb-4">
                {card.icon}
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-2">{card.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{card.description}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="mb-20">
          <h3 className="text-center text-lg font-semibold text-text-primary mb-10">
            導入の流れ
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-0 items-start">
            {steps.map((step, index) => (
              <React.Fragment key={`step-${step.number}`}>
                <div className="text-center px-2">
                  <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center text-sm font-semibold mx-auto mb-3">
                    {step.number}
                  </div>
                  <h4 className="text-sm font-semibold text-text-primary mb-1">{step.title}</h4>
                  <p className="text-xs text-text-secondary">{step.description}</p>
                </div>
                {index < steps.length - 1 && <ArrowConnector />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Comparison table */}
        <div className="mb-16">
          <h3 className="text-center text-lg font-semibold text-text-primary mb-8">
            他社チャットbotとの比較
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" role="table">
              <thead>
                <tr>
                  <th className="text-left text-sm font-medium text-text-muted py-3 px-4 border-b border-border w-1/3">
                    &nbsp;
                  </th>
                  <th className="text-center text-sm font-medium text-text-muted py-3 px-4 border-b border-border w-1/3">
                    競合チャットbot
                  </th>
                  <th className="text-center text-sm font-semibold text-accent py-3 px-4 border-b-2 border-accent w-1/3 bg-accent-dim rounded-t-card">
                    FujiTrace
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, index) => (
                  <tr key={index}>
                    <td className="text-sm text-text-primary font-medium py-3 px-4 border-b border-border">
                      {row.label}
                    </td>
                    <td className="text-center text-sm text-text-secondary py-3 px-4 border-b border-border">
                      {row.competitor}
                    </td>
                    <td className="text-center text-sm text-accent font-semibold py-3 px-4 border-b border-border bg-accent-dim">
                      {row.fujitrace}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA area */}
        <div className="text-center">
          <a
            href="/dashboard"
            className="inline-block bg-accent text-white rounded-card px-8 py-4 font-semibold hover:bg-accent-hover transition-colors duration-120"
            aria-label="無料で始める - AIチャットbotの導入"
          >
            無料で始める
          </a>
          <p className="mt-4 text-sm text-text-muted">
            30日間の無料トライアル。クレジットカード不要。
          </p>
        </div>
      </div>
    </section>
  );
}
