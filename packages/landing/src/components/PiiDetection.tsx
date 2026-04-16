interface PiiPattern {
  name: string;
  example: string;
}

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

interface ComparisonRow {
  label: string;
  fujitrace: string;
  datadog: string;
  langfuse: string;
}

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

export default function PiiDetection() {
  return (
    <section id="pii-detection" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-status-block label-spacing uppercase surface-card mb-6">
            データ保護
          </span>
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            企業の機密情報を、
            <br className="sm:hidden" />
            AIから自動で守る
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            設定不要。AIの入出力に含まれる
            <br className="hidden md:block" />
            個人情報・機密データを自動で検出・遮断。
            <br className="hidden md:block" />
            セキュリティ専任者がいなくても、
            <br className="hidden md:block" />
            導入した瞬間から企業データを保護します。
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
                  <span className="bg-accent-dim text-accent px-1.5 py-0.5 rounded">
                    1234 5678 9012
                  </span>
                  {" で、住所は "}
                  <span className="bg-accent-dim text-accent px-1.5 py-0.5 rounded">
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
            なぜ国産プラットフォームを選ぶべきか
          </h3>
          <p className="text-base text-text-secondary max-w-2xl mx-auto text-center mb-8 leading-relaxed">
            日本企業特有の規制・機密情報に対応し、データ主権を守りながら、
            <br className="hidden md:block" />
            海外ツールでは実現できない安心と説明責任を提供します。
          </p>
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

        {/* CTA */}
        <div className="text-center">
          <a
            href="/dashboard"
            className="inline-flex px-6 py-3 bg-accent text-white rounded-card font-medium hover:bg-accent/90 transition-colors duration-120"
          >
            AI 事務員を使い始める
          </a>
          <p className="text-sm text-text-muted mt-3">
            無料（Free 30 回/月）から始められます
          </p>
        </div>
      </div>
    </section>
  );
}
