/**
 * Single source of truth for /tools/* page-level SEO metadata.
 *
 * Used by:
 *   - Each /tools/* page at runtime via `useSeo` hook (client-side meta updates)
 *   - The post-build prerender script `scripts/prerender.mjs` (build-time
 *     static HTML generation for Google bot)
 *
 * Why centralize:
 *   Google primarily indexes the initial HTML response. SPA-only meta updates
 *   via useSeo are insufficient — they only fire after JS hydration. The
 *   prerender script reads this module directly and bakes title / description
 *   / JSON-LD into per-route static index.html files.
 *
 * 戦略 doc Section 5.6 / 18.2.N (Founder 承認 2026-04-29)
 *
 * Domain canonicalization rule:
 *   - Production canonical = https://fujitrace.jp (Vercel custom domain)
 *   - All canonical URLs, og:url, JSON-LD url fields MUST use this domain.
 *   - Earlier code referenced oshigoto.ai but that hostname is not deployed;
 *     using divergent canonicals splits PageRank and hurts indexing.
 */

export const CANONICAL_ORIGIN = 'https://fujitrace.jp';

export interface ToolFaqEntry {
  question: string;
  answer: string;
}

export interface ToolHowToStep {
  name: string;
  text: string;
}

export interface ToolSeoConfig {
  /** Route path including leading slash, e.g. "/tools/seikyusho". */
  path: string;
  /** <title> — recommended ≤ 60 chars, keyword first. */
  title: string;
  /** <meta name="description"> — recommended ≤ 120 chars. */
  description: string;
  /** og:title — defaults to title if omitted. */
  ogTitle?: string;
  /** Document name shown in BreadcrumbList position 3 ("請求書", "見積書"...). */
  breadcrumbName: string;
  /** SoftwareApplication.name — full app name shown in rich results. */
  applicationName: string;
  /** Lastmod for sitemap.xml in ISO date. */
  lastmod: string;
  /** Sitemap priority 0.0–1.0. */
  priority: number;
  /** Sitemap change frequency. */
  changefreq: 'daily' | 'weekly' | 'monthly';
  /** HowTo steps shown both in JSON-LD HowTo schema and (optionally) in body. */
  howToSteps: ToolHowToStep[];
  /** FAQPage entries (≥5 recommended for rich snippet eligibility). */
  faq: ToolFaqEntry[];
}

export const TOOLS_SEO: Record<string, ToolSeoConfig> = {
  '/tools': {
    path: '/tools',
    title: '業務書類テンプレート 無料｜請求書・見積書・納品書をPDF出力 - おしごとAI',
    description:
      '5書類（請求書・見積書・納品書・発注書・送付状）を無料で作成・PDFダウンロード。会員登録不要、インボイス制度対応、月¥3,000でAI事務員に進化。',
    ogTitle: '業務書類テンプレート 無料｜請求書・見積書・納品書 - おしごとAI',
    breadcrumbName: '無料ツール',
    applicationName: 'おしごとAI 業務書類テンプレート',
    lastmod: '2026-04-29',
    priority: 0.9,
    changefreq: 'weekly',
    howToSteps: [
      { name: '無料ツールを選ぶ', text: '請求書・見積書・納品書・発注書・送付状の5種から目的の書類を選びます。' },
      { name: '自社情報・取引先情報を入力', text: '会員登録なしでフォームに直接入力できます。データはサーバーに送信されません。' },
      { name: '品目・金額を追加', text: '税区分（10% / 軽減8% / 非課税）も選択可能。合計は自動計算されます。' },
      { name: 'PDFをダウンロード', text: 'ボタン1つで日本のビジネス慣習に沿ったPDFを即出力します。' },
    ],
    faq: [
      {
        question: '会員登録は本当に不要ですか？',
        answer: 'はい、登録もログインも不要です。フォームに入力してPDFをダウンロードするだけで使えます。入力データはお使いのブラウザ内だけで処理され、サーバーには送信されません。',
      },
      {
        question: '商用利用できますか？',
        answer: '可能です。生成されたPDFは法人・個人事業主の業務書類としてそのままご利用いただけます。利用規約・追加料金もありません。',
      },
      {
        question: 'インボイス制度には対応していますか？',
        answer: '請求書テンプレートは適格請求書（インボイス制度）に必要な税区分（10% / 軽減8% / 非課税）の分けて記載に対応しています。登録番号欄は備考欄に記入する形式です。',
      },
      {
        question: 'どの書類が無料で使えますか？',
        answer: '請求書・見積書・納品書・発注書・送付状の5種類です。すべて会員登録なしで無料です。',
      },
      {
        question: 'もっと楽に書類を作る方法はありますか？',
        answer: '月¥3,000のAI事務員プランでは、過去の取引先・案件をワンクリックで再利用したり、「先月分を○○商事に」と話すだけで下書きを生成できます。Free枠（月30回まで）でお試し可能です。',
      },
    ],
  },

  '/tools/seikyusho': {
    path: '/tools/seikyusho',
    title: '請求書テンプレート 無料｜会員登録不要・PDF即出力 - おしごとAI',
    description:
      '請求書を無料で作成・PDFダウンロード。会員登録不要、インボイス制度対応、税区分（10%/8%/0%）対応。月¥3,000でAI事務員に進化。',
    ogTitle: '請求書テンプレート 無料｜PDF即出力 - おしごとAI',
    breadcrumbName: '請求書',
    applicationName: 'おしごとAI 請求書テンプレート',
    lastmod: '2026-04-29',
    priority: 0.9,
    changefreq: 'weekly',
    howToSteps: [
      { name: '自社情報を入力', text: '請求書発行元となる自社の会社名・住所・電話番号・振込先銀行口座を入力します。' },
      { name: '取引先情報を入力', text: '請求先となる取引先の会社名と担当者名を入力します。' },
      { name: '請求番号と日付を確認', text: '請求番号・発行日・支払期日（発行日の1ヶ月後を自動補完）を確認します。' },
      { name: '品目を追加', text: '品名・単価・数量・税区分を入力。税区分（10% / 軽減8% / 非課税）ごとに自動で集計されます。' },
      { name: 'PDFをダウンロード', text: '「PDFをダウンロード」ボタンで日本の商慣習に沿った請求書を即出力します。' },
    ],
    faq: [
      {
        question: '請求書のテンプレートは会員登録なしで本当に無料ですか？',
        answer: 'はい、会員登録もログインも不要で完全無料です。フォームに入力してPDFをダウンロードするだけで使えます。入力データはお使いのブラウザ内だけで処理され、サーバーには送信されません。',
      },
      {
        question: 'インボイス制度（適格請求書）に対応していますか？',
        answer: '対応しています。10%・軽減8%・非課税の税区分ごとに小計と消費税額を分けて表示する形式です。適格請求書発行事業者の登録番号は備考欄に記入してください。',
      },
      {
        question: '振込手数料を弊社負担にしたい場合は？',
        answer: 'フォーム下部の「振込手数料は弊社負担」チェックボックスにチェックを入れてください。請求書PDFの備考欄に自動で文言が追記されます。',
      },
      {
        question: '源泉徴収税の対象となる取引にも使えますか？',
        answer: '使えます。「源泉徴収あり」のチェックボックスにチェックを入れると、備考欄に源泉徴収対象である旨が追記されます。源泉徴収税額の自動計算には対応していません。',
      },
      {
        question: 'Excelダウンロードはできますか？',
        answer: '現状はPDFダウンロードのみ提供しています。Excel編集が必要な場合は、PDFを参考にお手元の請求書テンプレートに転記してご利用ください。',
      },
      {
        question: '商用利用できますか？再販やテンプレート二次配布は？',
        answer: '生成されたPDF（自社の請求書として）は法人・個人事業主の業務書類としてそのままご利用いただけます。テンプレート自体の再販・二次配布は禁止です。',
      },
    ],
  },

  '/tools/mitsumori': {
    path: '/tools/mitsumori',
    title: '見積書テンプレート 無料｜PDF即出力・会員登録不要 - おしごとAI',
    description:
      '見積書を無料で作成・PDFダウンロード。会員登録不要、有効期限・件名・支払条件・納期に対応、税区分（10%/8%/0%）対応。月¥3,000でAI事務員に進化。',
    ogTitle: '見積書テンプレート 無料｜PDF即出力 - おしごとAI',
    breadcrumbName: '見積書',
    applicationName: 'おしごとAI 見積書テンプレート',
    lastmod: '2026-04-29',
    priority: 0.9,
    changefreq: 'weekly',
    howToSteps: [
      { name: '自社情報を入力', text: '見積書発行元の会社名・住所・電話番号を入力します。' },
      { name: '取引先と件名を入力', text: '見積もり先の取引先と、案件の件名（例：「Webサイト制作のお見積り」）を入力します。' },
      { name: '見積番号と有効期限を確認', text: '見積番号・発行日・有効期限（発行日の1ヶ月後を自動補完）を確認します。' },
      { name: '品目・支払条件・納期を入力', text: '品名・単価・数量・税区分を追加し、支払条件と納期を選択します。' },
      { name: 'PDFをダウンロード', text: '「PDFをダウンロード」ボタンで体裁を整えた見積書を即出力します。' },
    ],
    faq: [
      {
        question: '見積書を無料で作成できるのはなぜですか？',
        answer: 'おしごとAIは「最初の1枚を無料で作る」体験を入り口として、月¥3,000のAI事務員プランへの導線にしています。/tools/* の無料ツールはサーバー処理を行わず純粋なクライアント計算のみのため、運営側のコスト負担もほぼありません。',
      },
      {
        question: '見積書の有効期限は何日にすればいいですか？',
        answer: '日本の商慣習では発行日から1ヶ月（30日）が一般的です。本テンプレートも初期値で1ヶ月後を設定します。長期案件や原価変動が大きい商材の場合は、2週間程度に短縮することも検討してください。',
      },
      {
        question: '値引きを反映させたい場合は？',
        answer: '品目欄に「お値引き」の行を追加し、単価をマイナス値で入力すると合計から自動で減算されます。税区分は値引き対象品目と同じものを選んでください。',
      },
      {
        question: '支払条件はどのように記入すればよいですか？',
        answer: '「請求書発行月の翌月末払い」「検収後30日以内」「半金前払い・半金納品時」などが日本のビジネスで一般的です。本テンプレートではセレクトボックスから選択できます。',
      },
      {
        question: '見積書のあとに請求書を発行したい場合は？',
        answer: '当サイトの請求書テンプレート（/tools/seikyusho）で同じ取引先・品目を再入力すれば請求書を発行できます。月¥3,000のAI事務員プランでは、見積書→請求書のワンクリック変換に対応しています。',
      },
      {
        question: 'PDFのレイアウトはカスタマイズできますか？',
        answer: '無料テンプレートではカスタマイズ不可です。ロゴ追加・色変更・フォーマット変更が必要な場合は、AI事務員プラン（月¥3,000）で対応予定です。',
      },
    ],
  },

  '/tools/nouhin': {
    path: '/tools/nouhin',
    title: '納品書テンプレート 無料｜PDF即出力・会員登録不要 - おしごとAI',
    description:
      '納品書を無料で作成・PDFダウンロード。会員登録不要、納品日・受領印スペース対応、税区分（10%/8%/0%）対応。月¥3,000でAI事務員に進化。',
    ogTitle: '納品書テンプレート 無料｜PDF即出力 - おしごとAI',
    breadcrumbName: '納品書',
    applicationName: 'おしごとAI 納品書テンプレート',
    lastmod: '2026-04-29',
    priority: 0.9,
    changefreq: 'weekly',
    howToSteps: [
      { name: '自社情報を入力', text: '納品元の会社名・住所・電話番号を入力します。' },
      { name: '納品先情報を入力', text: '納品先の会社名と担当者名を入力します。' },
      { name: '納品番号と納品日を確認', text: '納品番号・発行日・納品日を入力します。' },
      { name: '納品品目を追加', text: '品名・単価・数量・税区分を入力すると合計が自動計算されます。' },
      { name: 'PDFをダウンロード', text: '受領印スペース付きの納品書PDFを即出力します。' },
    ],
    faq: [
      {
        question: '納品書と請求書の違いは何ですか？',
        answer: '納品書は「商品・サービスを納品しました」という事実を伝える書類、請求書は「代金をお支払いください」という支払いを求める書類です。納品書には受領印スペースを設けるのが一般的で、請求書には振込先口座を記載します。',
      },
      {
        question: '納品書には押印が必要ですか？',
        answer: '法的義務はありませんが、商慣習として発行元の社印を押す/印影を入れることが一般的です。本テンプレートでは印鑑欄を確保していますので、印刷後に押印するか、画像として印影を貼り付けてください。',
      },
      {
        question: '納品書と検収書、受領書はどう使い分けますか？',
        answer: '納品書は発行元（売り手）が発行する書類、受領書（検収書）は受領者（買い手）が「確かに受け取った」と返送する書類です。本テンプレートは納品書側のみ対応しています。',
      },
      {
        question: '電子納品の場合もこのテンプレートは使えますか？',
        answer: '使えます。PDFのままメール添付してお送りいただけます。電子帳簿保存法に対応する場合は、AI事務員プラン（月¥3,000）の証憑保管機能をご利用ください。',
      },
      {
        question: '納品書を発行するタイミングはいつですか？',
        answer: '商品・サービスの納品と同時、もしくは納品直後（同日〜翌営業日まで）が一般的です。請求書は月末締め・翌月末払いなどのサイクルで発行するため、納品書とは別タイミングで発行されます。',
      },
    ],
  },

  '/tools/hatchu': {
    path: '/tools/hatchu',
    title: '発注書テンプレート 無料｜PDF即出力・会員登録不要 - おしごとAI',
    description:
      '発注書を無料で作成・PDFダウンロード。会員登録不要、納品希望日・納品場所対応、税区分（10%/8%/0%）対応。月¥3,000でAI事務員に進化。',
    ogTitle: '発注書テンプレート 無料｜PDF即出力 - おしごとAI',
    breadcrumbName: '発注書',
    applicationName: 'おしごとAI 発注書テンプレート',
    lastmod: '2026-04-29',
    priority: 0.9,
    changefreq: 'weekly',
    howToSteps: [
      { name: '発注元情報を入力', text: '発注する側（自社）の会社名・住所・電話番号を入力します。' },
      { name: '発注先情報を入力', text: '発注する相手（受注者）の会社名と担当者名を入力します。' },
      { name: '発注番号と納品希望日を入力', text: '発注番号・発行日・納品希望日・納品場所を入力します。' },
      { name: '発注品目を追加', text: '品名・単価・数量・税区分を入力すると合計が自動計算されます。' },
      { name: 'PDFをダウンロード', text: '発注者と受注者を間違えないラベル付きの発注書PDFを即出力します。' },
    ],
    faq: [
      {
        question: '発注書と注文書の違いは何ですか？',
        answer: '実務上はほぼ同義です。「発注書」は買い手側の表現、「注文書」も買い手が書く点で同じです。本テンプレートはどちらの呼称でもそのままご利用いただけます（PDFのタイトルは「発注書」と表示されます）。',
      },
      {
        question: '発注書に印鑑は必要ですか？',
        answer: '法的には不要ですが、契約効力を明確にするため発注元の社印または角印を押すことが一般的です。100万円以上の発注では印紙税が必要となるケースもありますので、税理士・社内経理にご確認ください。',
      },
      {
        question: '下請法（下請代金支払遅延等防止法）対応はしていますか？',
        answer: '下請法では発注書面に12項目の必須記載事項があります。本テンプレートは品名・数量・単価・納期・支払期日など主要項目を網羅していますが、「下請事業者の給付の受領場所」「検査を完了する期日」など案件特性に応じた追加記入が必要です。詳細はAI事務員プラン（月¥3,000）の下請法チェック機能をご利用ください。',
      },
      {
        question: '納品場所はどう書けばいいですか？',
        answer: '「弊社○○事業所」「貴社指定先（電子納品）」「メール送付」など具体的に記入してください。複数納品の場合は備考欄に補足を記入できます。',
      },
      {
        question: '発注書の保存期間はどれくらいですか？',
        answer: '法人の場合、法人税法上は7年間（一部書類は10年間）の保存が必要です。個人事業主は青色申告で7年間、白色申告で5年間が原則です。電子保存する場合は電子帳簿保存法の要件を満たす必要があります。',
      },
    ],
  },

  '/tools/soufu': {
    path: '/tools/soufu',
    title: '送付状テンプレート 無料｜PDF即出力・会員登録不要 - おしごとAI',
    description:
      '送付状（添え状）を無料で作成・PDFダウンロード。会員登録不要、ビジネス書類用フォーマット、同封書類リスト対応。月¥3,000でAI事務員に進化。',
    ogTitle: '送付状テンプレート 無料｜ビジネス書類用 - おしごとAI',
    breadcrumbName: '送付状',
    applicationName: 'おしごとAI 送付状テンプレート',
    lastmod: '2026-04-29',
    priority: 0.9,
    changefreq: 'weekly',
    howToSteps: [
      { name: '自社情報・代表者名を入力', text: '送付元の会社名・住所・電話番号・代表者名を入力します。' },
      { name: '宛先情報を入力', text: '送付先の会社名と担当者名を入力します。' },
      { name: '件名と本文を確認', text: '件名と挨拶文（初期値で標準的なビジネス文面が入ります）を確認します。' },
      { name: '同封書類リストを追加', text: '同封する書類（請求書・見積書・契約書など）をリスト形式で追加します。' },
      { name: 'PDFをダウンロード', text: 'ビジネス書類同封用の送付状PDFを即出力します。' },
    ],
    faq: [
      {
        question: '送付状（添え状）はそもそも必要ですか？',
        answer: '法的に必須ではありませんが、ビジネスマナーとして請求書・見積書・契約書を郵送・FAX・メール添付する際に同封するのが一般的です。「誰が、何を、何枚、なぜ送ったか」を相手に明示する役割があります。',
      },
      {
        question: '本テンプレートは履歴書の送付状にも使えますか？',
        answer: '本テンプレートはビジネス書類（請求書・見積書・契約書など）同封専用のフォーマットです。履歴書・職務経歴書の送付状は別の文面慣習があるため、就職支援サイトのテンプレートをお使いいただくことをおすすめします。',
      },
      {
        question: 'メール添付でも送付状は必要ですか？',
        answer: 'メール本文が送付状の役割を兼ねるため、PDF送付状の同封は省略するのが一般的です。郵送・FAX・宅配便で書類をお送りする際にご利用ください。',
      },
      {
        question: '同封書類リストには何を書けばいいですか？',
        answer: '送付する書類の名称と部数を記入します。例：「請求書 1部」「見積書 1部」「契約書 2部（捺印後1部ご返送ください）」など、相手のアクションが必要な場合は併せて記載します。',
      },
      {
        question: '本文の挨拶文はカスタマイズできますか？',
        answer: 'はい、本文欄を直接編集できます。初期値として「平素より格別のお引き立てを賜り...」の標準文面が入りますが、取引相手・状況に応じて自由に書き換えてください。',
      },
    ],
  },
};

/** All routes that the prerender script should generate static HTML for. */
export const PRERENDER_ROUTES: ReadonlyArray<keyof typeof TOOLS_SEO> = [
  '/tools',
  '/tools/seikyusho',
  '/tools/mitsumori',
  '/tools/nouhin',
  '/tools/hatchu',
  '/tools/soufu',
] as const;

/* ------------------------------------------------------------------ */
/*  JSON-LD builders                                                   */
/* ------------------------------------------------------------------ */

export function buildBreadcrumbJsonLd(
  config: ToolSeoConfig,
): Record<string, unknown> {
  const items: Array<Record<string, unknown>> = [
    { '@type': 'ListItem', position: 1, name: 'ホーム', item: `${CANONICAL_ORIGIN}/` },
    { '@type': 'ListItem', position: 2, name: '無料ツール', item: `${CANONICAL_ORIGIN}/tools` },
  ];
  if (config.path !== '/tools') {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: config.breadcrumbName,
      item: `${CANONICAL_ORIGIN}${config.path}`,
    });
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

export function buildWebPageJsonLd(
  config: ToolSeoConfig,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: config.title,
    url: `${CANONICAL_ORIGIN}${config.path}`,
    description: config.description,
    inLanguage: 'ja-JP',
    isPartOf: {
      '@type': 'WebSite',
      name: 'おしごとAI / FujiTrace',
      url: CANONICAL_ORIGIN,
    },
  };
}

export function buildFaqJsonLd(config: ToolSeoConfig): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: config.faq.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };
}

export function buildHowToJsonLd(config: ToolSeoConfig): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: config.title,
    description: config.description,
    inLanguage: 'ja-JP',
    totalTime: 'PT3M',
    step: config.howToSteps.map((step, idx) => ({
      '@type': 'HowToStep',
      position: idx + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

export function buildSoftwareApplicationJsonLd(
  config: ToolSeoConfig,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: config.applicationName,
    description: config.description,
    url: `${CANONICAL_ORIGIN}${config.path}`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web Browser',
    inLanguage: 'ja-JP',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
    },
    publisher: {
      '@type': 'Organization',
      name: '合同会社Reminis',
      url: `${CANONICAL_ORIGIN}/company`,
    },
  };
}

/**
 * Returns the full set of JSON-LD entries (with stable IDs for useSeo
 * de-duplication) for a given route.
 */
export function buildAllJsonLd(
  config: ToolSeoConfig,
): Array<{ id: string; data: Record<string, unknown> }> {
  const slug = config.path === '/tools' ? 'index' : config.path.replace('/tools/', '');
  return [
    { id: `jsonld-${slug}-webpage`, data: buildWebPageJsonLd(config) },
    { id: `jsonld-${slug}-breadcrumb`, data: buildBreadcrumbJsonLd(config) },
    { id: `jsonld-${slug}-faq`, data: buildFaqJsonLd(config) },
    { id: `jsonld-${slug}-howto`, data: buildHowToJsonLd(config) },
    { id: `jsonld-${slug}-software`, data: buildSoftwareApplicationJsonLd(config) },
  ];
}
