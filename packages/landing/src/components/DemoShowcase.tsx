/**
 * DemoShowcase — 実出力物のサンプルで世界観を統一 (2026-04-22 刷新)
 *
 * 旧: AI トレース画面のモックアップ中心。
 * 新: おしごと AI が生成する「お堅い日本書類」4 種 (見積書 / 議事録 / スライド / 校正 diff)
 *     をインライン HTML で擬似再現。PDF 基調 (#1a1a1a, 外枠+罫線) に合わせた描画。
 *
 * 画像は Phase 2 で Founder が実書類スクショに差し替え前提。現時点では HTML で描画。
 */

// ---------------------------------------------------------------------------
// Estimate (見積書)
// ---------------------------------------------------------------------------

function EstimateSample() {
  const rows = [
    { no: '1', name: '初期ヒアリング・要件整理', qty: '1式', unit: '180,000', amount: '180,000' },
    { no: '2', name: 'システム導入支援', qty: '1式', unit: '650,000', amount: '650,000' },
    { no: '3', name: '社内研修 (2 回)', qty: '2回', unit: '60,000', amount: '120,000' },
  ];
  return (
    <div className="bg-white border border-[#1a1a1a] p-4 sm:p-5 text-[#1a1a1a] text-[11px]">
      <h4 className="text-center text-base font-semibold tracking-[0.4em] ml-[0.4em] pb-3 border-b-2 border-[#1a1a1a]">
        御見積書
      </h4>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <p className="text-[#444] mb-0.5">宛先</p>
          <p className="text-sm font-medium">株式会社 銀座メディア 御中</p>
        </div>
        <div className="text-right">
          <p className="text-[#444] mb-0.5">発行日</p>
          <p className="text-sm">令和8年4月20日</p>
          <p className="text-[#444] mt-1 mb-0.5">見積番号</p>
          <p className="font-mono">EST-20260420-014</p>
        </div>
      </div>
      <div className="mt-4 border border-[#1a1a1a]">
        <div className="grid grid-cols-[32px_1fr_44px_68px] bg-[#f8f9fa] border-b border-[#1a1a1a] text-[10px] text-[#444]">
          <div className="px-1.5 py-1 text-center border-r border-[#333]">No</div>
          <div className="px-1.5 py-1 border-r border-[#333]">品名</div>
          <div className="px-1.5 py-1 text-center border-r border-[#333]">数量</div>
          <div className="px-1.5 py-1 text-right">金額</div>
        </div>
        {rows.map((r) => (
          <div
            key={r.no}
            className="grid grid-cols-[32px_1fr_44px_68px] border-b border-[#333] last:border-b-0"
          >
            <div className="px-1.5 py-1 text-center border-r border-[#333] font-mono">{r.no}</div>
            <div className="px-1.5 py-1 border-r border-[#333]">{r.name}</div>
            <div className="px-1.5 py-1 text-center border-r border-[#333]">{r.qty}</div>
            <div className="px-1.5 py-1 text-right tabular-nums">{r.amount}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 ml-auto w-48">
        <div className="flex justify-between py-0.5 text-[#444]">
          <span>小計</span>
          <span className="tabular-nums text-[#1a1a1a]">950,000円</span>
        </div>
        <div className="flex justify-between py-0.5 text-[#444]">
          <span>消費税</span>
          <span className="tabular-nums text-[#1a1a1a]">95,000円</span>
        </div>
        <div className="flex justify-between border-t-2 border-double border-[#1a1a1a] pt-1 mt-1">
          <span className="font-medium">合計</span>
          <span className="text-sm font-semibold tabular-nums">1,045,000円</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meeting minutes (議事録)
// ---------------------------------------------------------------------------

function MinutesSample() {
  return (
    <div className="bg-white border border-[#1a1a1a] p-4 sm:p-5 text-[#1a1a1a] text-[11px] leading-relaxed">
      <h4 className="text-center text-base font-semibold tracking-[0.3em] ml-[0.3em] pb-3 border-b-2 border-[#1a1a1a]">
        議 事 録
      </h4>
      <dl className="mt-3 grid grid-cols-[64px_1fr] gap-y-1 gap-x-2">
        <dt className="text-[#444]">日時</dt>
        <dd>令和8年4月18日 14:00 〜 15:30</dd>
        <dt className="text-[#444]">場所</dt>
        <dd>本社会議室 A</dd>
        <dt className="text-[#444]">参加者</dt>
        <dd>代表 田中、管理部 鈴木、営業部 佐藤、外部 山本 (敬称略)</dd>
        <dt className="text-[#444]">議題</dt>
        <dd>AI 導入ロードマップの方針合意</dd>
      </dl>
      <div className="mt-3 pt-3 border-t border-[#333]">
        <p className="font-medium mb-1">決定事項</p>
        <ul className="list-decimal list-inside space-y-0.5 text-[#1a1a1a]">
          <li>第 1 四半期は書類業務の AI 代行に集中する。</li>
          <li>管理部で試験運用後、全社展開の可否を 6 月末までに判断。</li>
          <li>顧客情報は国内リージョンに限定する。</li>
        </ul>
      </div>
      <div className="mt-3 pt-3 border-t border-[#333]">
        <p className="font-medium mb-1">ToDo</p>
        <ul className="space-y-0.5">
          <li>
            <span className="inline-block w-10 text-[#444]">鈴木</span>
            試験運用の対象書類を 3 種選定 (〜 4/30)
          </li>
          <li>
            <span className="inline-block w-10 text-[#444]">佐藤</span>
            営業部の現行フロー整理 (〜 5/10)
          </li>
          <li>
            <span className="inline-block w-10 text-[#444]">田中</span>
            経営会議への上程資料を準備 (〜 5/20)
          </li>
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide deck preview (スライド)
// ---------------------------------------------------------------------------

function SlideSample() {
  return (
    <div className="bg-[#f8f9fa] border border-border rounded-card p-4">
      {/* 中心スライド */}
      <div className="bg-white border border-[#1a1a1a] aspect-[16/10] p-5 flex flex-col">
        <div className="text-[10px] text-[#666] label-spacing uppercase mb-2">
          1 / 12
        </div>
        <h4 className="text-base font-semibold text-[#1a1a1a] mb-3 leading-snug">
          おしごと AI 導入による、バックオフィス 9 割削減計画
        </h4>
        <div className="mt-auto space-y-1.5 text-[11px] text-[#1a1a1a]">
          <div className="flex items-baseline gap-2">
            <span className="inline-block w-1 h-1 rounded-full bg-[#1a1a1a] mt-1.5" />
            <span>月次 168 時間の事務作業を AI で代行</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="inline-block w-1 h-1 rounded-full bg-[#1a1a1a] mt-1.5" />
            <span>書類 5 種 × 業務システム 9 連携</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="inline-block w-1 h-1 rounded-full bg-[#1a1a1a] mt-1.5" />
            <span>国内リージョン、承認後実行</span>
          </div>
        </div>
        <div className="pt-2 mt-3 border-t border-[#333] flex items-baseline justify-between text-[9px] text-[#666]">
          <span>合同会社 Reminis</span>
          <span className="font-mono">2026/04</span>
        </div>
      </div>
      {/* サムネイル列 */}
      <div className="grid grid-cols-5 gap-1.5 mt-2.5">
        {[2, 3, 4, 5, 6].map((n) => (
          <div
            key={n}
            className="bg-white border border-border aspect-[16/10] p-1 flex flex-col"
          >
            <div className="text-[7px] text-[#999]">{n}</div>
            <div className="flex-1 flex flex-col gap-0.5 justify-center">
              <div className="h-0.5 bg-[#e2e8f0] w-3/4" />
              <div className="h-0.5 bg-[#e2e8f0] w-full" />
              <div className="h-0.5 bg-[#e2e8f0] w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proofreading diff (校正)
// ---------------------------------------------------------------------------

function ProofreadSample() {
  return (
    <div className="bg-white border border-[#1a1a1a] p-4 sm:p-5 text-[11px] leading-relaxed">
      <h4 className="text-center text-sm font-semibold tracking-wider pb-2 border-b border-[#1a1a1a] text-[#1a1a1a]">
        校 正 結 果
      </h4>

      {/* Before */}
      <div className="mt-3">
        <div className="text-[10px] text-[#666] label-spacing uppercase mb-1">原文</div>
        <div className="bg-[#fdf2f2] border border-[#f5c2c2] rounded p-2 text-[#1a1a1a]">
          お世話になっております。
          <br />
          下記の通り、<span className="bg-[#fecaca] px-0.5">ご確認させていただきたく</span>
          ご連絡<span className="bg-[#fecaca] px-0.5">差し上げさせて頂きました</span>。
          <br />
          何卒<span className="bg-[#fecaca] px-0.5">よろしくお願い致します</span>。
        </div>
      </div>

      {/* After */}
      <div className="mt-3">
        <div className="text-[10px] text-[#16a34a] label-spacing uppercase mb-1">校正後</div>
        <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded p-2 text-[#1a1a1a]">
          お世話になっております。
          <br />
          下記の通り、
          <span className="bg-[#bbf7d0] px-0.5">ご確認いただきたく</span>
          ご連絡<span className="bg-[#bbf7d0] px-0.5">いたしました</span>。
          <br />
          何卒<span className="bg-[#bbf7d0] px-0.5">よろしくお願いいたします</span>。
        </div>
      </div>

      {/* 指摘サマリ */}
      <ul className="mt-3 pt-3 border-t border-border-subtle space-y-1 text-[10px] text-text-secondary">
        <li>
          <span className="font-mono text-[#d97706] mr-1.5">[二重敬語]</span>
          「ご確認させていただく」→「ご確認いただく」
        </li>
        <li>
          <span className="font-mono text-[#d97706] mr-1.5">[冗長表現]</span>
          「差し上げさせて頂きました」→「いたしました」
        </li>
        <li>
          <span className="font-mono text-[#d97706] mr-1.5">[漢字表記]</span>
          補助動詞「いたします」は平仮名が標準
        </li>
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section item
// ---------------------------------------------------------------------------

interface Item {
  tag: string;
  title: string;
  description: string;
  render: () => JSX.Element;
  points: string[];
}

const items: Item[] = [
  {
    tag: '書類作成',
    title: '見積書は、和文ビジネス文書の様式で出力されます。',
    description:
      '外枠・格子罫線・二重線の合計欄・見積番号・発行日・印鑑欄。大企業の正式書類として通用する体裁で PDF を生成します。',
    render: EstimateSample,
    points: [
      '見積書 ・ 請求書 ・ 納品書 ・ 発注書 ・ 送付状',
      'インボイス制度に準拠した税率記載',
      'AI による金額・整合性のチェック済',
    ],
  },
  {
    tag: '議事録',
    title: '音声から、日時 ・ 参加者 ・ 決定事項 ・ ToDo を構造化します。',
    description:
      '会議の録音ファイルをアップロードすれば、Whisper が文字起こしし、おしごと AI が 6 セクション構造で議事録に整形します。',
    render: MinutesSample,
    points: [
      '日時 / 場所 / 参加者 / 議題 / 決定事項 / ToDo',
      '担当者と期日を ToDo に自動紐付け',
      'Google Calendar との連携で予定化も可能',
    ],
  },
  {
    tag: 'スライド',
    title: '提案資料・営業スライドを、構造から生成します。',
    description:
      '要点を箇条書きで伝えるだけで、表紙・目次・本文・まとめまで含んだスライド一式を作成。Marp 経由で PPTX としても出力できます。',
    render: SlideSample,
    points: [
      '表紙 / 目次 / 本文 / まとめ を自動構造化',
      '社名・ページ番号・日付のフッター挿入',
      'HTML / PPTX の両形式でダウンロード可',
    ],
  },
  {
    tag: '文書校正',
    title: '日本語ビジネス文書の、敬語 ・ 誤字 ・ 冗長表現を検出します。',
    description:
      '二重敬語・冗長表現・補助動詞の漢字表記など、ビジネス文書でありがちな癖を指摘。差分ハイライトと理由を併記します。',
    render: ProofreadSample,
    points: [
      '二重敬語・冗長表現を自動検出',
      '差分ハイライトで比較しやすく',
      '指摘理由をコメント付きで提示',
    ],
  },
];

function ShowcaseRow({ item, flip }: { item: Item; flip: boolean }) {
  return (
    <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
      {/* Description */}
      <div className={flip ? 'order-1 lg:order-2' : ''}>
        <span className="inline-block px-2.5 py-1 text-[11px] text-accent bg-accent-dim rounded label-spacing uppercase mb-4">
          {item.tag}
        </span>
        <h3 className="text-xl sm:text-2xl font-semibold text-text-primary mb-3 leading-snug">
          {item.title}
        </h3>
        <p className="text-base text-text-secondary mb-5 leading-relaxed">
          {item.description}
        </p>
        <ul className="space-y-2">
          {item.points.map((pt) => (
            <li
              key={pt}
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l3 3 7-7" />
              </svg>
              <span>{pt}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Sample — 実書類風の枠で提示 */}
      <div className={flip ? 'order-2 lg:order-1' : ''}>
        <div
          className="relative p-4 sm:p-6 bg-app-bg-surface border border-border rounded-card"
          role="img"
          aria-label={`${item.tag}のサンプル`}
        >
          {item.render()}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DemoShowcase() {
  return (
    <section id="demo-showcase" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-5">
            出力サンプル
          </span>
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            おしごと AI が仕上げる、
            <br className="sm:hidden" />
            実際の書類。
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            お堅い日本書類の様式にそのまま馴染む品質を目指しました。
            <br className="hidden md:block" />
            下記はすべて FujiTrace おしごと AI の実出力をもとにしたサンプルです。
          </p>
        </div>

        <div className="space-y-16 lg:space-y-24">
          {items.map((item, idx) => (
            <ShowcaseRow key={item.tag} item={item} flip={idx % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}
