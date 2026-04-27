/**
 * Solution — おしごと AI 全機能を 3 カテゴリで提示 (2026-04-28 リブランド)
 *
 * 旧名「AI 社員」「AI 事務員」を「おしごと AI」に統一。
 * 「書類業務 / 分析・リサーチ / コミュニケーション」の 3 カテゴリ訴求は維持。
 * チュートリアル訴求は EducationShowcase が引き続き担当。
 */
interface Capability {
  label: string;
}

interface SolutionCategory {
  tag: string;
  title: string;
  description: string;
  capabilities: Capability[];
  footnote?: string;
}

const categories: SolutionCategory[] = [
  {
    tag: '書類業務',
    title: '机上の書類作成を、ひととおり代行します。',
    description:
      '見積・請求・納品・発注・送付状の五書類に加え、稟議書や議事録のドラフトまで。インボイス・支払サイト・敬語の商慣習を踏まえて仕上げます。',
    capabilities: [
      { label: '見積書・請求書・納品書・発注書・送付状' },
      { label: '稟議書・議事録のドラフト' },
      { label: 'インボイス制度・支払サイト準拠' },
      { label: 'AI による金額・整合性の自動チェック' },
    ],
    footnote: '書き込み前に人間の承認を挟む設計。誤送信を避けます。',
  },
  {
    tag: '分析・リサーチ',
    title: '「調べて、まとめる」の時間を圧縮します。',
    description:
      'Excel をアップロードすれば LLM が解釈し、競合調査・業界動向も Wide Research で深掘り。日本語ビジネス文書の校正もお任せください。',
    capabilities: [
      { label: 'Excel 解析 (.xlsx アップロード)' },
      { label: 'Wide Research による業界・競合調査' },
      { label: '日本語ビジネス文書の校正 (敬語・誤字・冗長)' },
      { label: 'レポート形式での自動要約' },
    ],
  },
  {
    tag: 'コミュニケーション',
    title: '会議とやり取りを、業務システムと繋ぎます。',
    description:
      '音声から議事録を自動構造化。提案スライドも生成可能。Google Calendar / Gmail / Chatwork / freee など九種の業務システムと連携します。',
    capabilities: [
      { label: '議事録 (音声 → 日時・参加者・決定事項・ToDo)' },
      { label: '提案スライド・営業資料の生成' },
      {
        label:
          'Calendar / Gmail / Drive / Slack / Chatwork / freee / Notion / GitHub / LINE',
      },
      { label: '朝のブリーフィング (今日の予定・昨日完了・保留)' },
    ],
  },
];

function CategoryCard({ category, index }: { category: SolutionCategory; index: number }) {
  return (
    <article className="relative surface-card p-6 sm:p-7 flex flex-col h-full">
      {/* 番号と分類 */}
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-card bg-accent text-white font-mono text-xs tabular-nums">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="inline-block px-2 py-0.5 text-[11px] text-accent bg-accent-dim rounded label-spacing">
          {category.tag}
        </span>
      </div>

      <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-3 leading-snug">
        {category.title}
      </h3>
      <p className="text-sm text-text-secondary mb-5 leading-relaxed">
        {category.description}
      </p>

      {/* 機能箇条書き (チェックアイコン) */}
      <ul className="space-y-2 mb-4">
        {category.capabilities.map((cap) => (
          <li
            key={cap.label}
            className="flex items-start gap-2 text-sm text-text-secondary"
          >
            <svg
              className="w-4 h-4 text-accent mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 20 20"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 10l3 3 7-7"
              />
            </svg>
            <span>{cap.label}</span>
          </li>
        ))}
      </ul>

      {category.footnote && (
        <p className="mt-auto pt-4 border-t border-border-subtle text-xs text-text-muted leading-relaxed">
          {category.footnote}
        </p>
      )}
    </article>
  );
}

export default function Solution() {
  return (
    <section id="solution" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-5">
            解決策
          </span>
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            おしごと AI が、
            <br className="sm:hidden" />
            担える仕事。
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            書類作成だけではありません。分析・リサーチ・コミュニケーションまで、
            <br className="hidden md:block" />
            中小企業の事務作業を横断的に引き受けます。
          </p>
        </div>

        {/* 3 category cards */}
        <div className="grid md:grid-cols-3 gap-4 lg:gap-5">
          {categories.map((category, idx) => (
            <CategoryCard key={category.tag} category={category} index={idx} />
          ))}
        </div>

        {/* 補足リンク */}
        <div className="mt-10 text-center">
          <a
            href="/tools"
            className="inline-flex items-center gap-2 text-sm text-accent hover:underline underline-offset-4"
          >
            搭載機能の全体像を見る
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
