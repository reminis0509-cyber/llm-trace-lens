import { useState } from 'react';

/* ──────────────────── Types ──────────────────── */

type Provider = 'openai' | 'anthropic' | 'gemini';

interface PiiPattern {
  name: string;
  example: string;
}

interface ComparisonRow {
  label: string;
  fujitrace: string;
  datadog: string;
  langfuse: string;
}

interface TechFeature {
  title: string;
  description: string;
}

interface EvaluationAxis {
  titleJa: string;
  titleEn: string;
  method: string;
  metrics: string;
  label: string;
}

/* ──────────────────── Data ──────────────────── */

const piiPatterns: PiiPattern[] = [
  { name: 'マイナンバー（個人番号）', example: '1234 5678 9012' },
  { name: '口座番号', example: '1234567' },
  { name: 'パスポート番号', example: 'AB1234567' },
  { name: '運転免許証番号', example: '012345678900' },
  { name: '健康保険証番号', example: '01234567' },
  { name: '在留カード番号', example: 'AB12345678CD' },
  { name: '基礎年金番号', example: '1234-567890' },
  { name: '電話番号（固定・携帯・国際）', example: '090-1234-5678' },
  { name: '日本の住所（47都道府県）', example: '東京都千代田区...' },
  { name: '郵便番号', example: '100-0001' },
  { name: 'メールアドレス', example: 'user@example.com' },
  { name: 'クレジットカード番号', example: '4111-XXXX-XXXX' },
  { name: 'APIキー（OpenAI, AWS等）', example: 'sk-proj-...' },
  { name: '氏名（漢字・カタカナ）', example: '山田 太郎' },
  { name: '法人番号', example: '1234567890123' },
];

const comparisonData: ComparisonRow[] = [
  {
    label: '日本語の機密情報検知',
    fujitrace: '15+種類 組み込み',
    datadog: '対応なし',
    langfuse: '対応なし',
  },
  {
    label: '設定',
    fujitrace: '不要（自動検出）',
    datadog: '顧客が自前実装',
    langfuse: '顧客が自前実装',
  },
  {
    label: '日本語UI',
    fujitrace: '完全対応',
    datadog: '英語のみ',
    langfuse: '英語のみ',
  },
];

const techFeatures: TechFeature[] = [
  {
    title: '日本語PII検出エンジン',
    description: 'マイナンバー、住所、電話番号、パスポートなど15種類以上を正規表現ベースで自動検出・遮断。',
  },
  {
    title: 'LLM-as-Judge 評価',
    description: 'OpenAI・Anthropic両対応。独立したLLMが回答の正確性・関連性・安全性を自動スコアリング。',
  },
  {
    title: 'AIエージェント行動トレース',
    description: 'Thought / Action / Observation パターンを構造化記録。ネストされたツール呼び出しも完全に可視化。',
  },
  {
    title: 'ハルシネーション検出',
    description: '信頼度スコア(0-100)と根拠数を照合。閾値ベースの自動判定でFail/Warn/Passを分類。',
  },
  {
    title: 'コスト・予算管理',
    description: 'トークン数 x モデル単価でリアルタイム計算。プロジェクト別の予算上限設定とアラート通知。',
  },
  {
    title: 'セキュリティリスクスコア',
    description: '4要素(PII, Injection, Toxicity, Anomaly)の加重平均で0-100のリスクスコアを算出。',
  },
  {
    title: 'マルチプロバイダー対応',
    description: 'OpenAI, Anthropic, Google Gemini に対応。各プロバイダーのSDK互換APIを提供。',
  },
  {
    title: 'セルフホスト対応',
    description: 'Docker Composeで全サービスを一括起動。PostgreSQL + Redis + Fastify構成。OSSライセンス。',
  },
];

const evaluationAxes: EvaluationAxis[] = [
  {
    titleJa: '応答品質',
    titleEn: 'Response Quality',
    method: 'LLM-as-Judge（独立したLLMによる自動採点）',
    metrics: '正確性、関連性、一貫性',
    label: '01',
  },
  {
    titleJa: 'ハルシネーション率',
    titleEn: 'Hallucination Rate',
    method: '出力とソースデータの自動突合',
    metrics: '事実と異なる出力の割合(%)',
    label: '02',
  },
  {
    titleJa: 'レイテンシ',
    titleEn: 'Latency',
    method: 'トレースのタイムスタンプ分析',
    metrics: '応答速度 (p50, p95, p99)',
    label: '03',
  },
  {
    titleJa: 'コスト効率',
    titleEn: 'Cost Efficiency',
    method: 'トークン使用量 x モデル単価',
    metrics: '1リクエストあたりのコスト',
    label: '04',
  },
  {
    titleJa: '安全性',
    titleEn: 'Safety',
    method: '機密情報検知エンジン + 有害出力フィルタ',
    metrics: '個人情報漏洩の検出率、有害コンテンツの遮断率',
    label: '05',
  },
];

/* ──────────────────── Code Block Sub-components ──────────────────── */

function OpenAIBeforeAfter() {
  return (
    <pre className="text-text-secondary">
      <code>
        <span className="text-text-muted">{'// Before'}</span>
        {'\n'}
        <span className="text-status-pass">const</span>{' '}
        <span className="text-text-primary">client</span>{' '}
        {'='}{' '}
        <span className="text-status-pass">new</span>{' '}
        <span className="text-text-primary">OpenAI</span>
        {'({'}{'\n'}
        {'  '}baseURL:{' '}
        <span className="text-accent">{'"https://api.openai.com/v1"'}</span>
        {'\n'}
        {'});'}{'\n'}
        {'\n'}
        <span className="text-text-muted">{'// After \u2014 FujiTrace\u7D4C\u7531'}</span>
        {'\n'}
        <span className="text-status-pass">const</span>{' '}
        <span className="text-text-primary">client</span>{' '}
        {'='}{' '}
        <span className="text-status-pass">new</span>{' '}
        <span className="text-text-primary">OpenAI</span>
        {'({'}{'\n'}
        {'  '}baseURL:{' '}
        <span className="text-accent">{'"https://your-fujitrace.example.com/v1"'}</span>
        {'\n'}
        {'});'}
      </code>
    </pre>
  );
}

function AnthropicBeforeAfter() {
  return (
    <pre className="text-text-secondary">
      <code>
        <span className="text-text-muted">{'// Before'}</span>
        {'\n'}
        <span className="text-status-pass">const</span>{' '}
        <span className="text-text-primary">client</span>{' '}
        {'='}{' '}
        <span className="text-status-pass">new</span>{' '}
        <span className="text-text-primary">Anthropic</span>
        {'();'}{'\n'}
        {'\n'}
        <span className="text-text-muted">{'// After \u2014 FujiTrace\u7D4C\u7531'}</span>
        {'\n'}
        <span className="text-status-pass">const</span>{' '}
        <span className="text-text-primary">client</span>{' '}
        {'='}{' '}
        <span className="text-status-pass">new</span>{' '}
        <span className="text-text-primary">Anthropic</span>
        {'({'}{'\n'}
        {'  '}baseURL:{' '}
        <span className="text-accent">{'"https://your-fujitrace.example.com/anthropic"'}</span>
        {'\n'}
        {'});'}
      </code>
    </pre>
  );
}

function GeminiBeforeAfter() {
  return (
    <pre className="text-text-secondary">
      <code>
        <span className="text-text-muted">{'// Before'}</span>
        {'\n'}
        <span className="text-status-pass">const</span>{' '}
        <span className="text-text-primary">genAI</span>{' '}
        {'='}{' '}
        <span className="text-status-pass">new</span>{' '}
        <span className="text-text-primary">GoogleGenerativeAI</span>
        {'(API_KEY);'}{'\n'}
        {'\n'}
        <span className="text-text-muted">{'// After \u2014 FujiTrace\u7D4C\u7531'}</span>
        {'\n'}
        <span className="text-status-pass">const</span>{' '}
        <span className="text-text-primary">genAI</span>{' '}
        {'='}{' '}
        <span className="text-status-pass">new</span>{' '}
        <span className="text-text-primary">GoogleGenerativeAI</span>
        {'(API_KEY, {'}{'\n'}
        {'  '}baseUrl:{' '}
        <span className="text-accent">{'"https://your-fujitrace.example.com/gemini"'}</span>
        {','}{'\n'}
        {'});'}
      </code>
    </pre>
  );
}

/* ──────────────────── Main Component ──────────────────── */

export default function ForEngineersPage() {
  const [provider, setProvider] = useState<Provider>('openai');

  const providerLabels: { key: Provider; label: string }[] = [
    { key: 'openai', label: 'OpenAI' },
    { key: 'anthropic', label: 'Anthropic' },
    { key: 'gemini', label: 'Gemini' },
  ];

  return (
    <>
      {/* ── Section 1: Hero (Technical) ── */}
      <section className="min-h-[60vh] flex items-center justify-center pt-20 pb-16 px-4 sm:px-6">
        <div className="section-container w-full">
          <div className="text-center">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 surface-card text-sm mb-8">
              <span className="w-1.5 h-1.5 bg-accent rounded-full" />
              <span className="text-text-muted">技術者向け詳細</span>
            </div>

            <h1 className="text-display-sm md:text-display font-semibold text-text-primary mb-6">
              1行のコード変更で、
              <br className="hidden sm:block" />
              LLM通信の完全な可視化を実現
            </h1>

            <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-8">
              OpenAI互換プロキシ方式で、既存のAIアプリケーションに
              <br className="hidden sm:block" />
              トレース・PII検出・品質評価機能を即座に追加できます。
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-4 mb-10">
              {['OpenAI互換API', 'OSS公開予定', 'Docker Compose対応'].map((badge) => (
                <div key={badge} className="flex items-center gap-1.5 text-sm text-text-secondary">
                  <svg className="w-4 h-4 text-status-pass flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>{badge}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
              <a
                href="/dashboard"
                className="w-full sm:w-auto px-8 py-4 bg-accent text-white rounded-card text-base font-semibold hover:bg-accent/90 transition-colors duration-120 text-center"
              >
                30日間無料で試す
              </a>
              <a
                href="/"
                className="w-full sm:w-auto px-6 py-4 text-text-secondary hover:text-text-primary border border-border rounded-card font-medium hover:bg-base-elevated transition-colors duration-120 text-center"
              >
                経営者向けページへ
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Section 2: Code Integration Example ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="section-container">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">導入方法</span>
            <h2 className="text-display-sm font-semibold text-text-primary mb-4">baseURLを変更するだけで導入完了</h2>
            <p className="text-lg text-text-secondary max-w-xl mx-auto">
              既存のOpenAI/Anthropic/Gemini SDKのbaseURLをFujiTraceに向けるだけ。コードの変更は1行のみです。
            </p>
          </div>

          {/* Code tabs for 3 providers */}
          <div className="max-w-3xl mx-auto">
            {/* Provider tabs */}
            <div className="flex gap-1 mb-2" role="tablist" aria-label="プロバイダー選択">
              {providerLabels.map(({ key, label }) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={provider === key}
                  aria-controls={`code-panel-${key}`}
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
              id={`code-panel-${provider}`}
              role="tabpanel"
              className="bg-base-surface border border-border rounded-card p-4 text-sm font-mono overflow-x-auto"
            >
              {provider === 'openai' && <OpenAIBeforeAfter />}
              {provider === 'anthropic' && <AnthropicBeforeAfter />}
              {provider === 'gemini' && <GeminiBeforeAfter />}
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Section 3: Architecture Diagram ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="section-container">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">アーキテクチャ</span>
            <h2 className="text-display-sm font-semibold text-text-primary mb-4">OpenAI互換プロキシ方式</h2>
            <p className="text-lg text-text-secondary max-w-xl mx-auto">
              既存のAI APIコールをFujiTraceプロキシ経由に切り替えるだけ。アプリケーション側の変更は最小限です。
            </p>
          </div>

          {/* Architecture diagram */}
          <div className="surface-card p-4 sm:p-6 lg:p-8">
            <div className="grid lg:grid-cols-5 gap-4 lg:gap-6 items-center">
              {/* Your App */}
              <div className="text-center">
                <div className="surface-card p-4 sm:p-6 mb-4">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-text-primary">Your App</span>
                <p className="text-xs text-text-muted mt-1">OpenAI SDK / Anthropic SDK</p>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center py-2 lg:py-0">
                <div className="lg:hidden h-8 w-px bg-border relative">
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 border-b border-r border-text-muted rotate-45" />
                </div>
                <div className="hidden lg:block w-full h-px bg-border relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-r border-t border-text-muted rotate-45" />
                </div>
              </div>

              {/* FujiTrace */}
              <div className="text-center">
                <div className="bg-accent-dim border border-accent/30 rounded-card p-4 sm:p-6 mb-4">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 mx-auto" viewBox="0 0 32 32" fill="none">
                    <path d="M11.5 8 L7 22 L9.2 22 L11.5 14.5 L13.8 22 L16 22 Z" fill="#60a5fa"/>
                    <path d="M20 10.5 L16.2 22 L18.4 22 L20 15.5 L21.6 22 L23.8 22 Z" fill="#2563eb"/>
                    <path d="M16 22 L15.2 22 L16 19.2 Z" fill="#1d4ed8" opacity="0.7"/>
                  </svg>
                </div>
                <span className="text-sm font-medium text-text-primary">FujiTrace Proxy</span>
                <p className="text-xs text-text-muted mt-1">トレース・PII検出・評価</p>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center py-2 lg:py-0">
                <div className="lg:hidden h-8 w-px bg-border relative">
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 border-b border-r border-text-muted rotate-45" />
                </div>
                <div className="hidden lg:block w-full h-px bg-border relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-r border-t border-text-muted rotate-45" />
                </div>
              </div>

              {/* AI Providers */}
              <div className="text-center">
                <div className="surface-card p-4 sm:p-6 mb-4">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-text-primary">AI Providers</span>
                <p className="text-xs text-text-muted mt-1">OpenAI / Anthropic / Gemini</p>
              </div>
            </div>

            {/* Technical features below */}
            <div className="grid sm:grid-cols-3 gap-6 mt-12 pt-8 border-t border-border">
              {[
                { title: 'OpenAI互換API', desc: 'baseURL変更のみで接続' },
                { title: 'ベンダーロックインなし', desc: '複数プロバイダを統一管理' },
                { title: 'Docker Compose対応', desc: 'ワンコマンドでセルフホスト' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-accent-dim text-accent rounded flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-text-primary">{item.title}</h4>
                    <p className="text-xs text-text-muted">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Section 4: PII Detection Technical Details ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="section-container">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1.5 text-xs text-status-block label-spacing uppercase surface-card mb-6">PII検出エンジン</span>
            <h2 className="text-display-sm font-semibold text-text-primary mb-4">日本語の機密情報を自動検知・遮断</h2>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              15種類以上の日本語固有パターンに対応。設定不要で、プロキシ通過時に自動で検出・遮断します。
            </p>
          </div>

          {/* Detection demo visual */}
          <div className="surface-card overflow-hidden mb-12">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-status-block animate-pulse" />
                <span className="text-xs text-text-muted label-spacing uppercase">機密情報検知エンジン</span>
              </div>
              <span className="text-xs text-status-block font-mono">BLOCKED</span>
            </div>
            <div className="p-6">
              <div className="font-mono text-sm space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                  <span className="text-text-muted flex-shrink-0">Input:</span>
                  <span className="text-text-secondary">
                    {"田中太郎さんのマイナンバーは "}
                    <span className="bg-status-block/20 text-status-block px-1.5 py-0.5 rounded">
                      1234 5678 9012
                    </span>
                    {" で、住所は "}
                    <span className="bg-status-block/20 text-status-block px-1.5 py-0.5 rounded">
                      東京都渋谷区神南1-2-3
                    </span>
                    {" です"}
                  </span>
                </div>
                <div className="border-t border-border-subtle pt-2 mt-2 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                  <span className="text-text-muted flex-shrink-0">Result:</span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono rounded bg-status-block/20 text-status-block">
                        BLOCKED
                      </span>
                      <span className="text-text-secondary">マイナンバー検出</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono rounded bg-status-block/20 text-status-block">
                        BLOCKED
                      </span>
                      <span className="text-text-secondary">住所検出（東京都）</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PII patterns grid */}
          <div className="mb-16">
            <h3 className="text-base font-medium text-text-primary mb-6 text-center">
              検出対応パターン -- <span className="text-accent font-mono">15+種類</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {piiPatterns.map((pattern) => (
                <div
                  key={pattern.name}
                  className="flex items-center justify-between gap-3 bg-base-surface border border-border rounded-card px-4 py-3 hover:bg-base-elevated transition-colors duration-120"
                >
                  <span className="text-sm text-text-primary">{pattern.name}</span>
                  <span className="text-xs text-text-muted font-mono flex-shrink-0">{pattern.example}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Competitor comparison */}
          <div className="mb-12">
            <h3 className="text-base font-medium text-text-primary mb-6 text-center">
              海外製品との比較
            </h3>
            <div className="surface-card overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-4 gap-0 border-b border-border">
                <div className="px-4 py-3 sm:px-6 sm:py-4">
                  <span className="text-xs text-text-muted label-spacing uppercase sr-only">項目</span>
                </div>
                <div className="px-4 py-3 sm:px-6 sm:py-4 text-center border-l border-border bg-accent-dim">
                  <span className="text-xs text-accent label-spacing uppercase font-medium">FujiTrace</span>
                </div>
                <div className="px-4 py-3 sm:px-6 sm:py-4 text-center border-l border-border">
                  <span className="text-xs text-text-muted label-spacing uppercase">Datadog</span>
                </div>
                <div className="px-4 py-3 sm:px-6 sm:py-4 text-center border-l border-border">
                  <span className="text-xs text-text-muted label-spacing uppercase">Langfuse</span>
                </div>
              </div>

              {/* Table rows */}
              {comparisonData.map((row, index) => (
                <div
                  key={row.label}
                  className={`grid grid-cols-4 gap-0 ${index < comparisonData.length - 1 ? 'border-b border-border-subtle' : ''}`}
                >
                  <div className="px-4 py-3 sm:px-6 sm:py-4 flex items-center">
                    <span className="text-sm text-text-secondary">{row.label}</span>
                  </div>
                  <div className="px-4 py-3 sm:px-6 sm:py-4 text-center border-l border-border bg-accent-dim flex items-center justify-center">
                    <span className="text-sm text-accent font-medium">{row.fujitrace}</span>
                  </div>
                  <div className="px-4 py-3 sm:px-6 sm:py-4 text-center border-l border-border flex items-center justify-center">
                    <span className="text-sm text-text-muted">{row.datadog}</span>
                  </div>
                  <div className="px-4 py-3 sm:px-6 sm:py-4 text-center border-l border-border flex items-center justify-center">
                    <span className="text-sm text-text-muted">{row.langfuse}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Section 5: Technical Feature Specs ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="section-container">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
              技術仕様
            </span>
            <h2 className="text-display-sm font-semibold text-text-primary mb-4">
              AI監視に必要な全機能を搭載
            </h2>
            <p className="text-lg text-text-secondary max-w-xl mx-auto">
              トレース・品質検証・セキュリティ保護をワンストップで提供
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {techFeatures.map((feature, index) => (
              <div
                key={index}
                className="feature-card hover:bg-base-elevated transition-colors duration-120"
              >
                <h3 className="text-sm font-medium text-text-primary mb-2">{feature.title}</h3>
                <p className="text-sm text-text-secondary">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Section 6: Evaluation Standards ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="section-container">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
              品質評価基準
            </span>
            <h2 className="text-display-sm font-semibold text-text-primary mb-4">
              評価基準
            </h2>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              FujiTraceはAI品質を5つの軸で定量評価します。
              <br className="hidden sm:block" />
              評価基準を公開し、第三者としての透明性を担保します。
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {evaluationAxes.map((axis) => (
              <div
                key={axis.label}
                className="feature-card hover:bg-base-elevated transition-colors duration-120"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-card bg-accent-dim text-accent flex items-center justify-center font-mono text-xs flex-shrink-0">
                    {axis.label}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-text-primary">
                      {axis.titleJa}
                    </h3>
                    <span className="text-xs text-text-muted font-mono">
                      {axis.titleEn}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-text-muted label-spacing uppercase mb-1">
                      測定方法
                    </div>
                    <p className="text-sm text-text-secondary">{axis.method}</p>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted label-spacing uppercase mb-1">
                      Metrics
                    </div>
                    <p className="text-sm text-text-secondary">{axis.metrics}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Transparency note */}
          <div className="mt-8 surface-card p-6 text-center">
            <p className="text-sm text-text-secondary">
              全評価ロジックはオープンソースとして公開予定です。評価の透明性と再現性を保証し、ベンダーロックインのない品質管理を実現します。
            </p>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Section 7: Supported Providers ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="section-container">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">対応プロバイダー</span>
            <h2 className="text-display-sm font-semibold text-text-primary mb-4">主要AIプロバイダーに対応</h2>
          </div>
          <div className="flex justify-center gap-8">
            {['OpenAI', 'Anthropic', 'Google Gemini'].map((name) => (
              <div key={name} className="surface-card px-8 py-6 text-center">
                <span className="text-base font-mono text-text-primary">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Section 8: CTA ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="section-container">
          <div className="surface-card p-6 sm:p-8 lg:p-12 text-center">
            <h2 className="text-display-sm font-semibold text-text-primary mb-4">
              今すぐ導入を始める
            </h2>
            <p className="text-lg text-text-secondary mb-8 max-w-xl mx-auto">
              30日間全機能無料。クレジットカード不要。1行のコード変更で導入できます。
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="/dashboard"
                className="w-full sm:w-auto px-8 py-4 bg-accent text-white rounded-card text-base font-semibold hover:bg-accent/90 transition-colors duration-120 text-center"
              >
                30日間無料で試す
              </a>
              <a
                href="mailto:contact@fujitrace.com"
                className="w-full sm:w-auto px-6 py-4 text-text-secondary hover:text-text-primary border border-border rounded-card font-medium hover:bg-base-elevated transition-colors duration-120 text-center"
              >
                技術的なご質問
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
