interface FeatureBadge {
  label: string;
}

interface TraceItem {
  prompt: string;
  confidence: number;
  detail: string;
  borderColor: string;
}

interface StatItem {
  label: string;
  value: string;
  sub?: string;
}

const traceItems: TraceItem[] = [
  {
    prompt: 'PIIってなんですか？わかりやすく...',
    confidence: 95,
    detail: '根拠 3 / 8720ms',
    borderColor: 'border-l-status-pass',
  },
  {
    prompt: '株式会社サンプルテックの営業担当...',
    confidence: 95,
    detail: '見積書生成',
    borderColor: 'border-l-status-warn',
  },
  {
    prompt: 'Hello, connection test',
    confidence: 100,
    detail: '1968ms / トークン 162',
    borderColor: 'border-l-status-pass',
  },
];

const statsItems: StatItem[] = [
  { label: '総トレース数', value: '47', sub: '件' },
  { label: '平均スコア', value: '89', sub: '/100' },
  { label: '合格率', value: '85', sub: '%' },
  { label: '平均レイテンシ', value: '5073', sub: 'ms' },
];

function BadgePill({ label }: FeatureBadge) {
  return (
    <span className="inline-block px-2.5 py-1 text-xs text-text-secondary bg-base-elevated border border-border rounded-full">
      {label}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-base rounded-full overflow-hidden">
        <div
          className="h-full bg-status-pass rounded-full"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-mono tabular-nums text-status-pass">{value}%</span>
    </div>
  );
}

/* ──────────────────── Mockup: Trace List ──────────────────── */
function TraceListMockup() {
  return (
    <div className="bg-base-surface border border-border rounded-card overflow-hidden" role="img" aria-label="トレース一覧のダッシュボード画面">
      {/* Header tabs */}
      <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex gap-1">
          {['すべて', '合格', '警告', '失敗'].map((tab, i) => (
            <span
              key={tab}
              className={`px-2.5 py-1 text-xs rounded-card ${
                i === 0
                  ? 'bg-accent-dim text-accent'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          {['OpenAI', 'Anthropic', 'Gemini'].map((provider, i) => (
            <span
              key={provider}
              className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                i === 0
                  ? 'bg-accent-dim text-accent'
                  : 'text-text-muted'
              }`}
            >
              {provider}
            </span>
          ))}
        </div>
      </div>

      {/* Trace items */}
      <div className="divide-y divide-border">
        {traceItems.map((item, i) => (
          <div key={i} className={`px-4 py-3 border-l-2 ${item.borderColor}`}>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <p className="text-sm text-text-primary truncate flex-1">{item.prompt}</p>
              <span className="text-xs font-mono tabular-nums text-status-pass whitespace-nowrap">
                {item.confidence}%
              </span>
            </div>
            <p className="text-xs text-text-muted font-mono">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────── Mockup: Trace Detail ──────────────────── */
function TraceDetailMockup() {
  return (
    <div className="bg-base-surface border border-border rounded-card overflow-hidden" role="img" aria-label="トレース詳細のダッシュボード画面">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">トレース詳細</span>
        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-status-warn/20 text-status-warn">
          WARN
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Warning */}
        <div className="p-3 rounded-card bg-status-warn/5 border border-status-warn/20">
          <p className="text-xs text-status-warn">
            <span className="font-mono font-medium">confidence</span>
            <span className="mx-1.5 text-text-muted">&mdash;</span>
            信頼度が高いが根拠不足
          </p>
        </div>

        {/* Response */}
        <div>
          <p className="text-xs text-text-muted mb-1.5 label-spacing uppercase">回答</p>
          <p className="text-sm text-text-secondary">
            Hello! How can I assist you today?
          </p>
        </div>

        {/* Confidence bar */}
        <div>
          <p className="text-xs text-text-muted mb-1.5 label-spacing uppercase">信頼度</p>
          <ConfidenceBar value={100} />
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'プロバイダー', value: 'openai' },
            { label: 'モデル', value: 'gpt-4o-mini' },
            { label: 'レイテンシ', value: '1968ms' },
            { label: 'トークン', value: '162' },
          ].map((meta) => (
            <div key={meta.label} className="p-2 rounded-card bg-base">
              <p className="text-[10px] text-text-muted mb-0.5">{meta.label}</p>
              <p className="text-xs font-mono text-text-primary">{meta.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── Mockup: Stats Dashboard ──────────────────── */
function StatsDashboardMockup() {
  return (
    <div className="bg-base-surface border border-border rounded-card overflow-hidden" role="img" aria-label="統計ダッシュボードの画面">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <span className="text-sm font-medium text-text-primary">統計概要</span>
      </div>

      <div className="p-4 space-y-4">
        {/* 4-stat grid */}
        <div className="grid grid-cols-2 gap-3">
          {statsItems.map((stat) => (
            <div key={stat.label} className="p-3 rounded-card bg-base border border-border-subtle">
              <p className="text-[10px] text-text-muted mb-1">{stat.label}</p>
              <p className="text-lg font-mono tabular-nums text-text-primary">
                {stat.value}
                <span className="text-xs text-text-muted ml-0.5">{stat.sub}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Validation bar */}
        <div>
          <p className="text-xs text-text-muted mb-1.5 label-spacing uppercase">検証結果分布</p>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div className="bg-status-pass" style={{ width: '85%' }} />
            <div className="bg-status-warn" style={{ width: '15%' }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-status-pass">合格 85%</span>
            <span className="text-[10px] text-status-warn">警告 15%</span>
          </div>
        </div>

        {/* Provider stats */}
        <div className="rounded-card bg-base border border-border-subtle overflow-hidden">
          <div className="px-3 py-2 border-b border-border-subtle">
            <p className="text-[10px] text-text-muted label-spacing uppercase">プロバイダー別</p>
          </div>
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-xs text-text-primary font-mono">openai</span>
              <span className="text-[10px] text-text-muted">/</span>
              <span className="text-xs text-text-secondary font-mono">gpt-4o-mini</span>
            </div>
            <span className="text-xs font-mono tabular-nums text-text-primary">47件</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── Description Card ──────────────────── */
interface DescriptionCardProps {
  title: string;
  description: string;
  badges: string[];
}

function DescriptionCard({ title, description, badges }: DescriptionCardProps) {
  return (
    <div className="flex flex-col justify-center">
      <h3 className="text-xl sm:text-2xl font-semibold text-text-primary mb-3">
        {title}
      </h3>
      <p className="text-base text-text-secondary mb-5 leading-relaxed">
        {description}
      </p>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <BadgePill key={badge} label={badge} />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────── Main Component ──────────────────── */
export default function DemoShowcase() {
  return (
    <section id="demo-showcase" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            DASHBOARD
          </span>
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            すべてのLLM通信を可視化
          </h2>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            プロンプト、レスポンス、信頼度、コスト &mdash; 全てのトレースをリアルタイムで確認
          </p>
        </div>

        {/* Showcase Item 1: Trace List — description left, mockup right */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-16 lg:mb-24">
          <DescriptionCard
            title="全トレースを自動記録"
            description="LLM APIへの全リクエストを自動的にキャプチャ。プロンプト、レスポンス、信頼度スコア、レイテンシを一覧表示します。"
            badges={['リアルタイム更新', 'フィルタリング', 'プロバイダー別表示']}
          />
          <TraceListMockup />
        </div>

        {/* Showcase Item 2: Trace Detail — mockup left, description right */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-16 lg:mb-24">
          <div className="order-2 lg:order-1">
            <TraceDetailMockup />
          </div>
          <div className="order-1 lg:order-2">
            <DescriptionCard
              title="AI回答の品質を自動検証"
              description="各トレースに対して信頼度スコア、根拠の有無、リスク要因を自動で分析。ハルシネーションや機密情報漏洩を即座に検出します。"
              badges={['信頼度スコアリング', 'PII検出', 'リスク分析']}
            />
          </div>
        </div>

        {/* Showcase Item 3: Stats Dashboard — description left, mockup right */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <DescriptionCard
            title="使用状況を一目で把握"
            description="トレース数、平均スコア、合格率、レイテンシをリアルタイムで集計。プロバイダー別の比較分析でコスト最適化に貢献します。"
            badges={['リアルタイム集計', 'プロバイダー比較', 'コスト追跡']}
          />
          <StatsDashboardMockup />
        </div>
      </div>
    </section>
  );
}
