import { useSeo } from '../hooks/useSeo';

interface NavigationLinkProps {
  href: string;
  children: React.ReactNode;
}

function NavigationLink({ href, children }: NavigationLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo(0, 0);
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="inline-flex items-center gap-1 text-accent hover:text-accent/80 transition-colors duration-120"
    >
      {children}
    </a>
  );
}

const challenges = [
  {
    title: 'ハルシネーション検出',
    description:
      'LLMの回答品質を継続的に監視しないと、誤情報がエンドユーザーに届くリスク',
  },
  {
    title: 'コスト可視化の欠如',
    description:
      'どのプロンプトがコストを消費しているか把握できず、予算超過のリスク',
  },
  {
    title: '日本語PII漏洩',
    description:
      '海外ツールでは日本語の個人情報（住所、電話番号、マイナンバー等）を検出できない',
  },
  {
    title: '監査証跡の不在',
    description:
      '金融・医療・法務など規制産業では、LLM利用の記録と追跡が必須',
  },
];

const features = [
  {
    title: 'リアルタイムトレース',
    description: '全LLMコールのレイテンシ、トークン数、コストを自動記録',
  },
  {
    title: '日本語PII検出',
    description:
      '住所、電話番号、マイナンバーなど15パターン以上を自動検出・マスク',
  },
  {
    title: 'LLM-as-Judge評価',
    description: 'AIが回答品質を自動スコアリング。人手レビューのコストを削減',
  },
  {
    title: 'コスト分析ダッシュボード',
    description: 'プロバイダ別・モデル別のコスト推移をリアルタイムで可視化',
  },
  {
    title: 'エージェントトレース',
    description: 'マルチステップAIエージェントの実行フローを完全に可視化',
  },
  {
    title: 'カスタムバリデーション',
    description: '業務要件に応じた独自の品質チェックルールを設定可能',
  },
];

const pricingPlans = [
  {
    plan: 'Free',
    price: '¥0',
    traces: '5,000/月',
    features: 'リアルタイムトレース、PII検出',
  },
  {
    plan: 'Pro',
    price: '¥3,000',
    traces: '\u7121\u5236\u9650',
    features: '\u30D5\u30B8\u5BFE\u8A71\u7121\u5236\u9650\u3001\u81EA\u5F8B\u30E2\u30FC\u30C9\u3001\u5FDC\u7528\u30AF\u30A8\u30B9\u30C8',
  },
  {
    plan: 'Max',
    price: '¥15,000',
    traces: '\u7121\u5236\u9650',
    features: 'Watch Room \u5168\u6587\u691C\u7D22\u3001\u512A\u5148\u30B5\u30DD\u30FC\u30C8',
  },
];

const partnershipSteps = [
  {
    step: 1,
    title: '無料で試す',
    description:
      'まずは御社の環境でFujiTraceをお試しください。Free（5時間ごとにリセット）から登録のみですぐに利用開始できます。',
  },
  {
    step: 2,
    title: '御社プロダクトの付加価値向上',
    description:
      'FujiTraceの品質監視機能を活用することで、御社がクライアントにAIソリューションを提案する際に「品質監視込み」でご提供いただけます。',
  },
  {
    step: 3,
    title: 'クライアントへのご紹介',
    description:
      '御社が価値を実感いただけた場合、御社のクライアントにもPro相当の無料試用期間をご提供いただけます。有料転換時にはマージンをお支払いします。',
  },
  {
    step: 4,
    title: '正式パートナー契約',
    description:
      '実績が積み上がった段階で、正式なパートナー契約（レベニューシェア）を締結。御社の全新規顧客にFujiTraceを標準搭載いただけます。',
  },
];

export default function SalesPage() {
  useSeo({
    title: 'FujiTrace パートナープログラム | 販売代理店・リセラー募集',
    description: 'FujiTraceの販売パートナープログラム。AI導入プラットフォームの代理店として、日本企業のAI活用を支援しませんか。獲得報酬・継続報酬の2段階報酬体系。',
    url: 'https://fujitrace.jp/sales',
    ogTitle: 'FujiTrace パートナープログラム',
  });

  return (
    <section className="pt-32 pb-16 sm:pb-24 px-4 sm:px-6">
      <div className="section-container max-w-4xl mx-auto">
        {/* Back link */}
        <div className="mb-8">
          <NavigationLink href="/">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span>トップに戻る</span>
          </NavigationLink>
        </div>

        {/* Header */}
        <h1 className="text-display-sm font-semibold text-text-primary mb-3">
          FujiTrace 導入のご提案
        </h1>
        <p className="text-lg text-text-secondary mb-16">
          国産LLMオブザーバビリティプラットフォーム
        </p>

        {/* Section 1: 課題 */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-text-primary mb-6">
            AIの本番運用における課題
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {challenges.map((challenge, index) => (
              <div
                key={index}
                className="feature-card"
              >
                <h3 className="text-sm font-medium text-text-primary mb-2">
                  {challenge.title}
                </h3>
                <p className="text-sm text-text-secondary">
                  {challenge.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: FujiTraceとは */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-text-primary mb-6">
            FujiTraceとは
          </h2>
          <div className="surface-card p-6">
            <ul className="space-y-3 text-sm text-text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-text-muted mt-0.5 shrink-0">--</span>
                <span>国内初のLLM特化オブザーバビリティプラットフォーム</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-text-muted mt-0.5 shrink-0">--</span>
                <span>
                  LLMへの全リクエスト・レスポンスをリアルタイムでトレース・可視化
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-text-muted mt-0.5 shrink-0">--</span>
                <span>日本語UI、国内データ保持、日本語PII検出に対応</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-text-muted mt-0.5 shrink-0">--</span>
                <span>
                  OpenAI / Anthropic / Google Gemini など主要プロバイダに対応
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Section 3: 主な機能 */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-text-primary mb-6">
            主な機能
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="feature-card"
              >
                <h3 className="text-sm font-medium text-text-primary mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-text-secondary">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: 導入の簡単さ */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-text-primary mb-6">
            導入の簡単さ
          </h2>
          <div className="terminal-block p-6 overflow-x-auto">
            <pre className="text-text-muted">
              <code>
                <span className="text-text-muted">
                  {'// Before'}
                </span>
                {'\n'}
                <span className="text-text-secondary">
                  {'const client = new OpenAI({ baseURL: '}
                </span>
                <span className="text-status-pass">
                  {'"https://api.openai.com/v1"'}
                </span>
                <span className="text-text-secondary">{' });'}</span>
                {'\n\n'}
                <span className="text-text-muted">
                  {'// After（1行変更するだけ）'}
                </span>
                {'\n'}
                <span className="text-text-secondary">
                  {'const client = new OpenAI({ baseURL: '}
                </span>
                <span className="text-accent">
                  {'"https://fujitrace.jp/v1"'}
                </span>
                <span className="text-text-secondary">{' });'}</span>
              </code>
            </pre>
          </div>
          <p className="text-sm text-text-secondary mt-4">
            既存コードの修正は一切不要。ベースURLを1行変更するだけで、全てのLLMコールが自動的にトレースされます。
          </p>
        </div>

        {/* Section 5: 料金プラン */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-text-primary mb-6">
            料金プラン（概要）
          </h2>
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 sm:px-6 py-3 text-xs text-text-muted font-medium text-left uppercase label-spacing bg-app-bg-elevated/50">
                      プラン
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-xs text-text-muted font-medium text-left uppercase label-spacing bg-app-bg-elevated/50">
                      月額
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-xs text-text-muted font-medium text-left uppercase label-spacing bg-app-bg-elevated/50">
                      トレース
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-xs text-text-muted font-medium text-left uppercase label-spacing bg-app-bg-elevated/50">
                      主な機能
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pricingPlans.map((plan, index) => (
                    <tr key={index}>
                      <td className="px-4 sm:px-6 py-4 text-sm font-medium text-text-primary whitespace-nowrap">
                        {plan.plan}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-text-primary whitespace-nowrap">
                        {plan.price}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-text-secondary whitespace-nowrap">
                        {plan.traces}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-text-secondary">
                        {plan.features}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-sm text-text-muted mt-4">
            詳しくは料金ページをご覧ください。
          </p>
          <p className="text-sm text-text-secondary mt-2">
            Free（5時間ごとにリセット）から、登録のみでご利用いただけます。
          </p>
        </div>

        {/* Section 6: パートナーシップのご提案 */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-text-primary mb-6">
            パートナーシップのご提案
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {partnershipSteps.map((item) => (
              <div key={item.step} className="feature-card">
                <div className="flex items-start gap-4">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-app-bg-elevated text-xs font-medium text-text-primary shrink-0">
                    {item.step}
                  </span>
                  <div>
                    <h3 className="text-sm font-medium text-text-primary mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-text-muted mt-4">
            ご紹介は義務ではありません。まずは御社自身でお試しいただき、価値を実感いただけた場合にのみご検討ください。
          </p>
        </div>

        {/* Section 7: お問い合わせ */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-text-primary mb-6">
            お問い合わせ
          </h2>
          <div className="surface-card p-6">
            <p className="text-sm text-text-secondary mb-4">
              ご不明な点がございましたら、お気軽にお問い合わせください。
            </p>
            <p className="text-sm text-text-secondary mb-6">
              メール:{' '}
              <a
                href="mailto:reminis0509@gmail.com"
                className="text-accent hover:underline"
              >
                reminis0509@gmail.com
              </a>
            </p>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors duration-120"
              aria-label="AI 社員を使い始める"
            >
              AI 社員を使い始める
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
