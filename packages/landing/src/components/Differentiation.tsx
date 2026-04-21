/**
 * Differentiation — ChatGPT / 海外 AI / FujiTrace の 3 軸比較 (2026-04-22 新設)
 *
 * 中小企業決裁者の疑問「ChatGPT でよくない?」「海外の Manus/Claude とどう違う?」に
 * 一枚の表で答える。老舗 SaaS 風に、派手な装飾を避け罫線と網掛けで差を示す。
 */
interface ComparisonRow {
  axis: string;
  chatgpt: string;
  overseas: string;
  fujitrace: string;
}

const rows: ComparisonRow[] = [
  {
    axis: '日本語ビジネス文書',
    chatgpt: '敬語が不自然になりやすい',
    overseas: '翻訳ベースの品質',
    fujitrace: '日本の商慣習に準拠',
  },
  {
    axis: 'データ保管',
    chatgpt: '海外サーバー',
    overseas: 'Meta 傘下など海外',
    fujitrace: '国内リージョン滞留',
  },
  {
    axis: '業務設計',
    chatgpt: '汎用チャット',
    overseas: '汎用エージェント',
    fujitrace: '書類 5 種 + 9 業務連携',
  },
  {
    axis: '書込み実行前の承認',
    chatgpt: '原則なし',
    overseas: '自動実行中心',
    fujitrace: 'ユーザー承認を標準',
  },
  {
    axis: '月額料金の分かりやすさ',
    chatgpt: '個人 / 法人別建て',
    overseas: '$20〜$200 / クレジット制',
    fujitrace: '¥0 〜 ¥50,000 固定',
  },
];

export default function Differentiation() {
  return (
    <section id="differentiation" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-5">
            比較
          </span>
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            ChatGPT や海外 AI と、
            <br className="sm:hidden" />
            何が違うか。
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            中小企業が実務で AI を運用する際に、
            <br className="hidden md:block" />
            もっとも迷うであろう五つの論点で整理しました。
          </p>
        </div>

        {/* Comparison table — デスクトップ */}
        <div className="hidden md:block surface-card overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1.1fr_1fr_1fr_1.1fr] border-b border-border">
            <div className="px-5 py-4 text-xs text-text-muted label-spacing uppercase">
              評価軸
            </div>
            <div className="px-5 py-4 text-center border-l border-border">
              <div className="text-xs text-text-muted label-spacing uppercase">
                ChatGPT 汎用
              </div>
            </div>
            <div className="px-5 py-4 text-center border-l border-border">
              <div className="text-xs text-text-muted label-spacing uppercase">
                海外 AI エージェント
              </div>
            </div>
            <div className="px-5 py-4 text-center border-l border-border bg-accent-dim">
              <div className="text-xs text-accent label-spacing uppercase font-semibold">
                FujiTrace AI社員
              </div>
            </div>
          </div>

          {/* Data rows */}
          {rows.map((row, idx) => (
            <div
              key={row.axis}
              className={`grid grid-cols-[1.1fr_1fr_1fr_1.1fr] ${
                idx < rows.length - 1 ? 'border-b border-border-subtle' : ''
              }`}
            >
              <div className="px-5 py-4 flex items-center">
                <span className="text-sm text-text-primary font-medium">{row.axis}</span>
              </div>
              <div className="px-5 py-4 text-center border-l border-border flex items-center justify-center">
                <span className="text-sm text-text-muted">{row.chatgpt}</span>
              </div>
              <div className="px-5 py-4 text-center border-l border-border flex items-center justify-center">
                <span className="text-sm text-text-muted">{row.overseas}</span>
              </div>
              <div className="px-5 py-4 text-center border-l border-border bg-accent-dim/60 flex items-center justify-center">
                <span className="text-sm text-accent font-medium">{row.fujitrace}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Comparison — モバイル縦スタック */}
        <div className="md:hidden space-y-4">
          {rows.map((row) => (
            <div key={row.axis} className="surface-card p-5">
              <div className="text-xs text-text-muted label-spacing uppercase mb-3">
                {row.axis}
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted flex-shrink-0">ChatGPT</dt>
                  <dd className="text-text-secondary text-right">{row.chatgpt}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted flex-shrink-0">海外 AI</dt>
                  <dd className="text-text-secondary text-right">{row.overseas}</dd>
                </div>
                <div className="flex justify-between gap-3 pt-2 border-t border-border-subtle">
                  <dt className="text-accent font-medium flex-shrink-0">FujiTrace</dt>
                  <dd className="text-accent font-medium text-right">{row.fujitrace}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-text-muted text-center">
          比較情報は各サービスの 2026 年 4 月時点の公開情報に基づいています。
        </p>
      </div>
    </section>
  );
}
