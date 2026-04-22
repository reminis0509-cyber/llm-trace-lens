/**
 * Capabilities — FujiTrace でできること一覧 (2026-04-22 新設)
 *
 * 背景:
 *  - 東京商工会議所 訪問フィードバック「HP見て、何ができるか分からない」
 *  - Founder 指示「関数的にリスト化、Before → After を明記」
 *  - 中小企業社長が 3 秒で「これができる」と把握できる一覧を提供
 *
 * 配置: Hero 直下、Problems の前
 *
 * 設計方針:
 *  - 15 機能をカード化 (訴求強度順)
 *  - Before → After で時短効果を一目で伝える
 *  - 白基調・深紺 accent・絵文字禁止
 *  - アイコンは inline SVG (lucide-react は landing 側未搭載のため)
 *  - モバイル 1 列 → タブレット 2 列 → デスクトップ 3 列
 */

interface Capability {
  /** Icon name (for reference — actual SVG is rendered inline) */
  icon: string;
  title: string;
  before: string;
  after: string;
  note?: string;
  /** Inline SVG path element(s) — uses currentColor so parent sets color */
  svg: React.ReactNode;
}

/* --------------------------------------------------------------------------
 * Icon definitions (inline SVG — lucide を landing に導入しないための措置)
 * 各 icon は 24x24 viewBox、stroke="currentColor"、strokeWidth={1.75}
 * ------------------------------------------------------------------------ */

const IconFileText = (
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="14" y2="17" />
  </>
);

const IconReceipt = (
  <>
    <path d="M4 2v20l2.5-1.5L9 22l2.5-1.5L14 22l2.5-1.5L19 22V2l-2.5 1.5L14 2l-2.5 1.5L9 2 6.5 3.5 4 2z" />
    <line x1="8" y1="8" x2="16" y2="8" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <line x1="8" y1="16" x2="12" y2="16" />
  </>
);

const IconMic = (
  <>
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="8" y1="22" x2="16" y2="22" />
  </>
);

const IconPresentation = (
  <>
    <rect x="3" y="4" width="18" height="12" rx="1" />
    <line x1="12" y1="16" x2="12" y2="20" />
    <line x1="8" y1="20" x2="16" y2="20" />
    <polyline points="7 11 10 8 13 11 17 7" />
  </>
);

const IconTrendingUp = (
  <>
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="15 7 21 7 21 13" />
  </>
);

const IconSearch = (
  <>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.5" y2="16.5" />
  </>
);

const IconPenLine = (
  <>
    <path d="M15 3l6 6-12 12H3v-6z" />
    <line x1="14" y1="4" x2="20" y2="10" />
  </>
);

const IconCalendar = (
  <>
    <rect x="3" y="5" width="18" height="16" rx="1" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="3" x2="8" y2="7" />
    <line x1="16" y1="3" x2="16" y2="7" />
  </>
);

const IconMail = (
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <polyline points="3 7 12 13 21 7" />
  </>
);

const IconPackage = (
  <>
    <path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" />
    <polyline points="3 8 12 13 21 8" />
    <line x1="12" y1="13" x2="12" y2="22" />
  </>
);

const IconCheckCircle = (
  <>
    <circle cx="12" cy="12" r="9" />
    <polyline points="8 12 11 15 16 9" />
  </>
);

const IconMessage = (
  <>
    <path d="M4 4h16v12H8l-4 4V4z" />
    <line x1="8" y1="10" x2="16" y2="10" />
  </>
);

const IconFolder = (
  <>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="8 13 11 16 16 11" />
  </>
);

const IconCalculator = (
  <>
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <rect x="7" y="6" width="10" height="3" />
    <circle cx="8.5" cy="13" r="0.5" fill="currentColor" />
    <circle cx="12" cy="13" r="0.5" fill="currentColor" />
    <circle cx="15.5" cy="13" r="0.5" fill="currentColor" />
    <circle cx="8.5" cy="16.5" r="0.5" fill="currentColor" />
    <circle cx="12" cy="16.5" r="0.5" fill="currentColor" />
    <circle cx="15.5" cy="16.5" r="0.5" fill="currentColor" />
  </>
);

const IconBot = (
  <>
    <rect x="4" y="8" width="16" height="12" rx="2" />
    <line x1="12" y1="4" x2="12" y2="8" />
    <circle cx="12" cy="4" r="1" />
    <circle cx="9" cy="13" r="1" fill="currentColor" />
    <circle cx="15" cy="13" r="1" fill="currentColor" />
    <line x1="9" y1="17" x2="15" y2="17" />
  </>
);

/* --------------------------------------------------------------------------
 * Capability data — 訴求強度順 (1 = 最もコンバージョン寄与)
 * ------------------------------------------------------------------------ */

const capabilities: Capability[] = [
  {
    icon: 'FileText',
    title: '見積書を自動作成',
    before: '30分',
    after: '30秒',
    note: '会社情報・品目・税率から一式生成',
    svg: IconFileText,
  },
  {
    icon: 'Receipt',
    title: '請求書の金額ミス自動検出',
    before: '手動目視',
    after: '自動',
    note: '合計・消費税・支払サイトを機械チェック',
    svg: IconReceipt,
  },
  {
    icon: 'Mic',
    title: '会議音声から議事録PDF',
    before: '2時間',
    after: '5分',
    note: '日時・参加者・決定事項・ToDoを構造化',
    svg: IconMic,
  },
  {
    icon: 'Presentation',
    title: '営業スライド10枚を生成',
    before: '3時間',
    after: '3分',
    note: '会社紹介・提案・見積まで一気通貫',
    svg: IconPresentation,
  },
  {
    icon: 'TrendingUp',
    title: 'Excelを分析して報告書PDF',
    before: '1日',
    after: '10分',
    note: '.xlsx を読み取り、傾向と示唆を文章化',
    svg: IconTrendingUp,
  },
  {
    icon: 'Search',
    title: '業界リサーチレポート',
    before: '1週間',
    after: '5分',
    note: 'Wide Research で競合・市場動向を深掘り',
    svg: IconSearch,
  },
  {
    icon: 'PenLine',
    title: '日本語ビジネス敬語校正',
    before: '30分',
    after: '30秒',
    note: '敬語・誤字・冗長表現を一括添削',
    svg: IconPenLine,
  },
  {
    icon: 'Calendar',
    title: '今日の予定を朝にブリーフィング',
    before: '手動確認',
    after: '自動',
    note: '昨日完了・今日の予定・保留事項を一覧化',
    svg: IconCalendar,
  },
  {
    icon: 'Mail',
    title: 'Gmail下書きを自動作成',
    before: '10分',
    after: '10秒',
    note: '要件を伝えると文面を提案、承認後に下書き保存',
    svg: IconMail,
  },
  {
    icon: 'Package',
    title: '納品書・発注書・送付状を自動作成',
    before: '各30分',
    after: '各30秒',
    note: '見積書から派生する書類も一括生成',
    svg: IconPackage,
  },
  {
    icon: 'CheckCircle2',
    title: '書類の記載漏れ・計算ミス検出',
    before: '目視',
    after: '自動',
    note: 'Tier 1〜3 で段階的に検証、Pass/Fail を明示',
    svg: IconCheckCircle,
  },
  {
    icon: 'MessageSquare',
    title: 'Slack/Chatwork通知を自動投稿',
    before: '5分',
    after: '自動',
    note: '書類完成・承認依頼・アラートを適切な channel へ',
    svg: IconMessage,
  },
  {
    icon: 'FolderOpen',
    title: 'Google Drive/Notionと連携',
    before: '手動転記',
    after: '自動',
    note: '生成物を所定フォルダ・ページへそのまま保存',
    svg: IconFolder,
  },
  {
    icon: 'Calculator',
    title: 'freee会計データを参照して資料作成',
    before: '手動',
    after: '自動',
    note: '仕訳・売上データを元に月次報告書を下書き',
    svg: IconCalculator,
  },
  {
    icon: 'Bot',
    title: '複雑な指示を一言で複数タスクに分解実行',
    before: '半日',
    after: '数分',
    note: '自律モード (β) が Plan → Execute → Review を自動ループ',
    svg: IconBot,
  },
];

/* --------------------------------------------------------------------------
 * CapabilityCard — 個別カード
 * ------------------------------------------------------------------------ */

function CapabilityCard({ capability }: { capability: Capability }) {
  return (
    <article className="surface-card p-5 sm:p-6 flex flex-col h-full hover:border-accent/30 transition-colors duration-120">
      {/* アイコン + タイトル */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-9 h-9 rounded-card bg-accent-dim text-accent flex items-center justify-center flex-shrink-0"
          aria-hidden="true"
        >
          <svg
            className="w-[18px] h-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {capability.svg}
          </svg>
        </div>
        <h3 className="text-[15px] sm:text-base font-semibold text-text-primary leading-snug pt-1">
          {capability.title}
        </h3>
      </div>

      {/* Before → After — 深紺ハイライト */}
      <div className="flex items-center gap-2 mb-3 font-mono">
        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-app-bg-elevated text-text-muted border border-border-subtle tabular-nums">
          {capability.before}
        </span>
        <svg
          className="w-3.5 h-3.5 text-accent flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="13 6 19 12 13 18" />
        </svg>
        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-accent text-white tabular-nums font-semibold">
          {capability.after}
        </span>
      </div>

      {/* 補足 (1行) */}
      {capability.note && (
        <p className="text-xs sm:text-[13px] text-text-secondary leading-relaxed mt-auto">
          {capability.note}
        </p>
      )}
    </article>
  );
}

/* --------------------------------------------------------------------------
 * Capabilities section
 * ------------------------------------------------------------------------ */

export default function Capabilities() {
  return (
    <section
      id="capabilities"
      className="py-16 sm:py-20 px-4 sm:px-6"
      aria-labelledby="capabilities-heading"
    >
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-10 sm:mb-14">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-5">
            できること
          </span>
          <h2
            id="capabilities-heading"
            className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4"
          >
            FujiTrace でできること。
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            具体的な機能と、時間削減の実績を一覧にしました。
            <br className="hidden sm:block" />
            中小企業の机上業務を、広くカバーします。
          </p>
        </div>

        {/* 15 capability cards — 1列 (mobile) / 2列 (sm) / 3列 (lg) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {capabilities.map((cap) => (
            <CapabilityCard key={cap.title} capability={cap} />
          ))}
        </div>

        {/* 下部補足 + CTA */}
        <div className="mt-10 sm:mt-14 text-center">
          <p className="text-sm text-text-muted mb-5">
            Before の時間は、中小企業 10 社へのヒアリングに基づく平均値です。
          </p>
          <a
            href="/tutorial"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-card text-sm sm:text-base font-semibold hover:bg-accent-hover transition-colors duration-120"
          >
            まずは無料で試してみる
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="13 6 19 12 13 18" />
            </svg>
          </a>
          <p className="text-xs text-text-muted mt-3">
            登録不要・クレジットカード不要で、4 章のチュートリアルから始められます。
          </p>
        </div>
      </div>
    </section>
  );
}
