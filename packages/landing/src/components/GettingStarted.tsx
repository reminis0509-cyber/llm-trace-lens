import { useState } from 'react';

/* ──────────────────── Types ──────────────────── */

type DeploymentMethod = 'cloud' | 'docker';
type Provider = 'openai' | 'anthropic' | 'gemini';

interface StepData {
  number: number;
  title: string;
  description: string;
  content: React.ReactNode;
}

/* ──────────────────── Code Snippets ──────────────────── */

function ApiKeyBlock() {
  return (
    <pre className="bg-base-surface border border-border rounded-card p-4 text-sm font-mono overflow-x-auto">
      <code>
        <span className="text-text-muted">FUJITRACE_API_KEY</span>
        <span className="text-text-secondary">=</span>
        <span className="text-accent">ft_xxxxxxxxxxxxx</span>
      </code>
    </pre>
  );
}

function CloudCodeBlock() {
  const [provider, setProvider] = useState<Provider>('openai');

  const providerLabels: { key: Provider; label: string }[] = [
    { key: 'openai', label: 'OpenAI' },
    { key: 'anthropic', label: 'Anthropic' },
    { key: 'gemini', label: 'Gemini' },
  ];

  return (
    <div>
      {/* Provider tabs */}
      <div className="flex gap-1 mb-2" role="tablist" aria-label="プロバイダー選択">
        {providerLabels.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={provider === key}
            aria-controls={`panel-${key}`}
            className={`px-2.5 py-1 text-xs rounded-card transition-colors duration-120 cursor-pointer ${
              provider === key
                ? 'bg-accent-dim text-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            onClick={() => setProvider(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Code blocks */}
      <div
        id={`panel-${provider}`}
        role="tabpanel"
        className="bg-base-surface border border-border rounded-card p-4 text-sm font-mono overflow-x-auto"
      >
        {provider === 'openai' && <OpenAICode />}
        {provider === 'anthropic' && <AnthropicCode />}
        {provider === 'gemini' && <GeminiCode />}
      </div>
    </div>
  );
}

function OpenAICode() {
  return (
    <pre className="text-text-secondary">
      <code>
        <span className="text-status-pass">import</span>{' '}
        <span className="text-text-primary">OpenAI</span>{' '}
        <span className="text-status-pass">from</span>{' '}
        <span className="text-accent">"openai"</span>
        {';'}{'\n'}
        {'\n'}
        <span className="text-status-pass">const</span>{' '}
        <span className="text-text-primary">client</span>{' '}
        {'='}{' '}
        <span className="text-status-pass">new</span>{' '}
        <span className="text-text-primary">OpenAI</span>
        {'({'}{'\n'}
        {'  '}baseURL:{' '}
        <span className="text-accent">"https://your-fujitrace.example.com/v1"</span>
        {','}{'\n'}
        {'  '}
        <span className="text-text-muted">{'// API\u30AD\u30FC\u306F\u305D\u306E\u307E\u307E\u4F7F\u7528'}</span>
        {'\n'}
        {'});'}{'\n'}
        {'\n'}
        <span className="text-status-pass">const</span>{' '}
        <span className="text-text-primary">res</span>{' '}
        {'='}{' '}
        <span className="text-status-pass">await</span>{' '}
        <span className="text-text-primary">client</span>
        {'.chat.completions.create({'}{'\n'}
        {'  '}model:{' '}
        <span className="text-accent">"gpt-4o-mini"</span>
        {','}{'\n'}
        {'  '}messages: [{'{ '}role:{' '}
        <span className="text-accent">"user"</span>
        {', '}content:{' '}
        <span className="text-accent">"Hello"</span>
        {' }'}]{','}{'\n'}
        {'});'}
      </code>
    </pre>
  );
}

function AnthropicCode() {
  return (
    <pre className="text-text-secondary">
      <code>
        <span className="text-status-pass">import</span>{' '}
        <span className="text-text-primary">Anthropic</span>{' '}
        <span className="text-status-pass">from</span>{' '}
        <span className="text-accent">"@anthropic-ai/sdk"</span>
        {';'}{'\n'}
        {'\n'}
        <span className="text-status-pass">const</span>{' '}
        <span className="text-text-primary">client</span>{' '}
        {'='}{' '}
        <span className="text-status-pass">new</span>{' '}
        <span className="text-text-primary">Anthropic</span>
        {'({'}{'\n'}
        {'  '}baseURL:{' '}
        <span className="text-accent">"https://your-fujitrace.example.com/anthropic"</span>
        {','}{'\n'}
        {'  '}
        <span className="text-text-muted">{'// API\u30AD\u30FC\u306F\u305D\u306E\u307E\u307E\u4F7F\u7528'}</span>
        {'\n'}
        {'});'}{'\n'}
        {'\n'}
        <span className="text-status-pass">const</span>{' '}
        <span className="text-text-primary">res</span>{' '}
        {'='}{' '}
        <span className="text-status-pass">await</span>{' '}
        <span className="text-text-primary">client</span>
        {'.messages.create({'}{'\n'}
        {'  '}model:{' '}
        <span className="text-accent">"claude-sonnet-4-20250514"</span>
        {','}{'\n'}
        {'  '}max_tokens:{' '}
        <span className="text-text-primary">1024</span>
        {','}{'\n'}
        {'  '}messages: [{'{ '}role:{' '}
        <span className="text-accent">"user"</span>
        {', '}content:{' '}
        <span className="text-accent">"Hello"</span>
        {' }'}]{','}{'\n'}
        {'});'}
      </code>
    </pre>
  );
}

function GeminiCode() {
  return (
    <pre className="text-text-secondary">
      <code>
        <span className="text-status-pass">import</span>{' '}
        {'{ '}
        <span className="text-text-primary">GoogleGenerativeAI</span>
        {' }'}{' '}
        <span className="text-status-pass">from</span>{' '}
        <span className="text-accent">"@google/generative-ai"</span>
        {';'}{'\n'}
        {'\n'}
        <span className="text-text-muted">{'// FujiTrace\u30D7\u30ED\u30AD\u30B7\u7D4C\u7531\u3067\u63A5\u7D9A'}</span>
        {'\n'}
        <span className="text-status-pass">const</span>{' '}
        <span className="text-text-primary">genAI</span>{' '}
        {'='}{' '}
        <span className="text-status-pass">new</span>{' '}
        <span className="text-text-primary">GoogleGenerativeAI</span>
        {'(API_KEY, {'}{'\n'}
        {'  '}baseUrl:{' '}
        <span className="text-accent">"https://your-fujitrace.example.com/gemini"</span>
        {','}{'\n'}
        {'});'}{'\n'}
        {'\n'}
        <span className="text-status-pass">const</span>{' '}
        <span className="text-text-primary">model</span>{' '}
        {'='}{' '}
        <span className="text-text-primary">genAI</span>
        {'.getGenerativeModel({'}{'\n'}
        {'  '}model:{' '}
        <span className="text-accent">"gemini-2.0-flash"</span>
        {','}{'\n'}
        {'});'}
      </code>
    </pre>
  );
}

function StatusBadges() {
  const badges = [
    '\u2713 \u30C8\u30EC\u30FC\u30B9\u8A18\u9332\u4E2D',
    '\u2713 \u4FE1\u983C\u5EA6\u30B9\u30B3\u30A2\u7B97\u51FA',
    '\u2713 PII\u691C\u51FA\u7A3C\u50CD',
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          key={badge}
          className="inline-block px-3 py-1.5 text-sm text-status-pass bg-status-pass/10 border border-status-pass/20 rounded-card"
        >
          {badge}
        </span>
      ))}
    </div>
  );
}

function DockerCloneBlock() {
  return (
    <pre className="bg-base-surface border border-border rounded-card p-4 text-sm font-mono overflow-x-auto">
      <code className="text-text-secondary">
        <span className="text-accent">git clone</span>{' '}
        https://github.com/reminis0509-cyber/llm-trace-lens.git{'\n'}
        <span className="text-accent">cd</span>{' '}
        llm-trace-lens
      </code>
    </pre>
  );
}

function DockerEnvBlock() {
  return (
    <pre className="bg-base-surface border border-border rounded-card p-4 text-sm font-mono overflow-x-auto">
      <code className="text-text-secondary">
        <span className="text-accent">cp</span>{' '}
        .env.example .env{'\n'}
        {'\n'}
        <span className="text-text-muted"># .env を編集</span>{'\n'}
        <span className="text-text-muted"># OPENAI_API_KEY=sk-xxxxx        # 検証用AIのAPIキー</span>{'\n'}
        <span className="text-text-muted"># SUPABASE_URL=https://xxx.supabase.co</span>{'\n'}
        <span className="text-text-muted"># SUPABASE_ANON_KEY=eyJxxx...</span>{'\n'}
        <span className="text-text-muted"># VITE_SUPABASE_URL=https://xxx.supabase.co</span>{'\n'}
        <span className="text-text-muted"># VITE_SUPABASE_ANON_KEY=eyJxxx...</span>
      </code>
    </pre>
  );
}

function DockerUpBlock() {
  return (
    <pre className="bg-base-surface border border-border rounded-card p-4 text-sm font-mono overflow-x-auto">
      <code className="text-text-secondary">
        <span className="text-accent">docker compose up -d</span>{'\n'}
        {'\n'}
        <span className="text-text-muted"># {'\uD83D\uDE80'} 起動完了！</span>{'\n'}
        <span className="text-text-muted"># プロキシ:       </span>
        <span className="text-accent">http://localhost:3000</span>{'\n'}
        <span className="text-text-muted"># ダッシュボード:  </span>
        <span className="text-accent">http://localhost:8080</span>{'\n'}
        <span className="text-text-muted"># Redis:          </span>
        <span className="text-accent">localhost:6379</span>
      </code>
    </pre>
  );
}

/* ──────────────────── Step Timeline ──────────────────── */

interface StepTimelineProps {
  steps: StepData[];
}

function StepTimeline({ steps }: StepTimelineProps) {
  return (
    <div className="space-y-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;

        return (
          <div key={step.number} className="flex gap-4 relative">
            {/* Number circle and vertical line */}
            <div className="flex flex-col items-center shrink-0">
              <div
                className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-sm font-bold shrink-0"
                style={{ color: '#0d0d0f' }}
                aria-hidden="true"
              >
                {step.number}
              </div>
              {!isLast && (
                <div className="w-px flex-1 bg-border" />
              )}
            </div>

            {/* Content */}
            <div className={`pb-8 ${isLast ? 'pb-0' : ''} min-w-0 flex-1`}>
              <h3 className="text-lg font-semibold text-text-primary">
                {step.title}
              </h3>
              <p className="text-sm text-text-secondary mt-1 mb-3">
                {step.description}
              </p>
              {step.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────── Main Component ──────────────────── */

export default function GettingStarted() {
  const [method, setMethod] = useState<DeploymentMethod>('cloud');

  const cloudSteps: StepData[] = [
    {
      number: 1,
      title: '\u30A2\u30AB\u30A6\u30F3\u30C8\u4F5C\u6210',
      description:
        '\u7121\u6599\u30A2\u30AB\u30A6\u30F3\u30C8\u3092\u4F5C\u6210\u3057\u3001\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u304B\u3089API\u30AD\u30FC\u3092\u53D6\u5F97',
      content: <ApiKeyBlock />,
    },
    {
      number: 2,
      title: '\u30B3\u30FC\u30C91\u884C\u5909\u66F4',
      description:
        '\u65E2\u5B58\u306EAI\u547C\u3073\u51FA\u3057\u30B3\u30FC\u30C9\u306EbaseURL\u3092FujiTrace\u306B\u5411\u3051\u308B\u3060\u3051',
      content: <CloudCodeBlock />,
    },
    {
      number: 3,
      title: '\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u3067\u78BA\u8A8D',
      description:
        '\u30C8\u30EC\u30FC\u30B9\u304C\u81EA\u52D5\u7684\u306B\u8A18\u9332\u3055\u308C\u3001\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u3067\u30EA\u30A2\u30EB\u30BF\u30A4\u30E0\u306B\u78BA\u8A8D\u53EF\u80FD',
      content: <StatusBadges />,
    },
  ];

  const dockerSteps: StepData[] = [
    {
      number: 1,
      title: '\u30EA\u30DD\u30B8\u30C8\u30EA\u3092\u30AF\u30ED\u30FC\u30F3',
      description:
        'GitHub\u304B\u3089FujiTrace\u306E\u30EA\u30DD\u30B8\u30C8\u30EA\u3092\u53D6\u5F97',
      content: <DockerCloneBlock />,
    },
    {
      number: 2,
      title: '\u74B0\u5883\u5909\u6570\u3092\u8A2D\u5B9A',
      description:
        '.env\u30D5\u30A1\u30A4\u30EB\u3092\u4F5C\u6210\u3057\u3001\u5FC5\u8981\u306A\u74B0\u5883\u5909\u6570\u3092\u8A2D\u5B9A',
      content: <DockerEnvBlock />,
    },
    {
      number: 3,
      title: '\u8D77\u52D5',
      description:
        'Docker Compose\u3067\u5168\u30B5\u30FC\u30D3\u30B9\u3092\u4E00\u62EC\u8D77\u52D5\u3002\u30D7\u30ED\u30AD\u30B7\u3001Redis\u3001\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u304C\u81EA\u52D5\u3067\u7ACB\u3061\u4E0A\u304C\u308A\u307E\u3059',
      content: <DockerUpBlock />,
    },
  ];

  const tabs: { key: DeploymentMethod; label: string }[] = [
    { key: 'cloud', label: 'クラウド版' },
    { key: 'docker', label: 'セルフホスト版' },
  ];

  return (
    <section id="getting-started" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container max-w-3xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            GETTING STARTED
          </span>
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            3ステップで導入完了
          </h2>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            クラウド版もセルフホスト版も、わずか数分でAIの可視化を開始
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center gap-2 mb-12" role="tablist" aria-label="導入方法の選択">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={method === key}
              aria-controls={`method-panel-${key}`}
              className={
                method === key
                  ? 'px-5 py-2.5 text-sm font-medium rounded-card bg-accent transition-colors duration-120 cursor-pointer'
                  : 'px-5 py-2.5 text-sm font-medium rounded-card border border-border text-text-secondary hover:text-text-primary hover:border-border transition-colors duration-120 cursor-pointer'
              }
              style={method === key ? { color: '#0d0d0f' } : undefined}
              onClick={() => setMethod(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Steps timeline */}
        <div id={`method-panel-${method}`} role="tabpanel">
          <StepTimeline steps={method === 'cloud' ? cloudSteps : dockerSteps} />
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <a
            href="/dashboard"
            className="inline-flex px-6 py-3 bg-accent rounded-card font-medium hover:bg-accent/90 transition-colors duration-120"
            style={{ color: '#0d0d0f' }}
          >
            無料で始める →
          </a>
        </div>
      </div>
    </section>
  );
}
