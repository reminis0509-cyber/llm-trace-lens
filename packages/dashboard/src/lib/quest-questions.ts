/**
 * Quest question catalog — "応用クエスト" for the dashboard Learn tab.
 *
 * Purpose: after the 8-chapter /tutorial, users practice real AI 社員 tasks
 * against the live AI 社員 endpoint. Each quest copies a prompt into the
 * clipboard and switches the user to the AI 社員 tab.
 *
 * Clearing criteria: user reads the expected AI output (sampleAnswer) and
 * self-confirms by checking every step — deliberate, low-friction UX inherited
 * from the previous QuestSystem. No API call gates completion.
 */

export type QuestCategory =
  | 'documents'
  | 'minutes'
  | 'slides'
  | 'excel'
  | 'research'
  | 'proofread'
  | 'connectors'
  | 'integration';

export type QuestDifficulty = 1 | 2 | 3;

export interface QuestStep {
  instruction: string;
  /** Optional prompt/text to copy. When set, renders a copy button. */
  hint?: string;
  /** Intent — for analytics / future refinement only. */
  checkType: 'send_message' | 'receive_response' | 'download';
}

export interface Quest {
  id: string;
  category: QuestCategory;
  /** Global 1-based number used for display and progression. */
  number: number;
  title: string;
  description: string;
  /** Short "what you'll learn" line. */
  objective: string;
  /** 1 = ★, 2 = ★★, 3 = ★★★ */
  difficulty: QuestDifficulty;
  estimatedTime: string;
  /** Brief preview of what the AI social 社員 is expected to return. */
  sampleAnswer: string;
  steps: QuestStep[];
}

export interface QuestCategoryMeta {
  id: QuestCategory;
  label: string;
  summary: string;
  accentClass: string;
  badgeClass: string;
}

export const CATEGORY_META: readonly QuestCategoryMeta[] = [
  {
    id: 'documents',
    label: '書類作成',
    summary: '見積書・請求書・発注書・納品書・送付状を自然言語で組み立てる',
    accentClass: 'text-blue-700',
    badgeClass: 'bg-blue-100 text-blue-800',
  },
  {
    id: 'minutes',
    label: '議事録自動化',
    summary: '走り書きメモや音声を、決定事項・ToDo 付きの議事録に変換',
    accentClass: 'text-indigo-700',
    badgeClass: 'bg-indigo-100 text-indigo-800',
  },
  {
    id: 'slides',
    label: 'スライド生成',
    summary: '1 行指示から構成 + PPTX まで。営業・報告・提案に直結',
    accentClass: 'text-purple-700',
    badgeClass: 'bg-purple-100 text-purple-800',
  },
  {
    id: 'excel',
    label: 'Excel 分析',
    summary: 'シートを読み込ませて、傾向・集計・インサイトを言語化',
    accentClass: 'text-emerald-700',
    badgeClass: 'bg-emerald-100 text-emerald-800',
  },
  {
    id: 'research',
    label: 'Wide Research',
    summary: '出典付きの業界レポートを AI に作らせる',
    accentClass: 'text-cyan-700',
    badgeClass: 'bg-cyan-100 text-cyan-800',
  },
  {
    id: 'proofread',
    label: '文書校正',
    summary: 'ビジネス敬語・トーン・用語の統一を一括で',
    accentClass: 'text-rose-700',
    badgeClass: 'bg-rose-100 text-rose-800',
  },
  {
    id: 'connectors',
    label: 'Calendar / Gmail 連携',
    summary: '予定・メール下書き・資料共有を連携で自動化',
    accentClass: 'text-amber-700',
    badgeClass: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'integration',
    label: '複合タスク',
    summary: '複数ツールを横断する一発指示（提案一式・月次クロージング等）',
    accentClass: 'text-fuchsia-700',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-800',
  },
];

/**
 * Quest catalog — 23 questions distributed across 8 categories per CEO spec.
 * Numbering is globally sequential so users see clear progress.
 */
export const QUESTS: readonly Quest[] = [
  // ── 書類作成 (5) ──
  {
    id: 'doc-1',
    category: 'documents',
    number: 1,
    title: '120 万円の見積書を 30 秒で',
    description: '宛先・品目・金額を 1 文で渡し、見積書 PDF を出力。',
    objective: '自然言語での書類作成に慣れる',
    difficulty: 1,
    estimatedTime: '2分',
    sampleAnswer:
      '御見積書（JTC 体裁）を生成。宛先「株式会社山田商事 御中」、件名「新規Webサイト制作」、合計 ¥1,320,000（税込）。プレビューと PDF ダウンロードが可能。',
    steps: [
      {
        instruction: '以下のヒントをコピーして AI 社員に送信',
        hint: '株式会社山田商事に見積書を作って。件名: 新規Webサイト制作、金額: 120万円、支払: 月末締翌月末払い',
        checkType: 'send_message',
      },
      {
        instruction: '生成された見積書の内容を確認',
        checkType: 'receive_response',
      },
      {
        instruction: 'PDF をダウンロードして中身を確認',
        checkType: 'download',
      },
    ],
  },
  {
    id: 'doc-2',
    category: 'documents',
    number: 2,
    title: '振込先込みの請求書を作る',
    description: '振込先・支払期限・インボイス番号まで 1 回の指示で網羅。',
    objective: '条件情報を漏らさず指示する',
    difficulty: 2,
    estimatedTime: '3分',
    sampleAnswer:
      '請求書（JTC 体裁、PDF 出力）。文書番号 INV-2026-001、振込先「みずほ銀行 渋谷支店 普通 1234567」、支払期限 翌月末、登録番号 T1234567890123、合計 ¥165,000（税込）。',
    steps: [
      {
        instruction: '複合条件を 1 回で指示（下のヒントをコピー）',
        hint: '株式会社テストに請求書を作って。コンサル月額 5 万円 × 3 ヶ月、支払期限: 来月末、振込先: みずほ銀行 渋谷支店 普通 1234567、インボイス番号: T1234567890123',
        checkType: 'send_message',
      },
      {
        instruction: '振込先とインボイス番号が正しく反映されているか確認',
        checkType: 'receive_response',
      },
      {
        instruction: 'PDF をダウンロード',
        checkType: 'download',
      },
    ],
  },
  {
    id: 'doc-3',
    category: 'documents',
    number: 3,
    title: '見積書 → 発注書 → 送付状を連続作成',
    description: '1 つの会話の中で 3 書類をスイッチ。コンテキストの再利用が鍵。',
    objective: '会話の文脈を継続して使う',
    difficulty: 2,
    estimatedTime: '5分',
    sampleAnswer:
      '3 件の JTC 体裁 PDF。(1) 御見積書（株式会社ABC 田中様、ロゴデザイン 15 万円）/ (2) 同条件の発注書 / (3) 2 点同封の送付状。いずれもプレビュー + PDF ダウンロード可。',
    steps: [
      {
        instruction: 'まず見積書を作成',
        hint: '株式会社ABC 田中様に見積書を作って。品目: ロゴデザイン 1 式 15 万円',
        checkType: 'send_message',
      },
      {
        instruction: '同じ会話で発注書も依頼',
        hint: 'この案件の発注書も作って',
        checkType: 'send_message',
      },
      {
        instruction: '最後に送付状を',
        hint: '見積書と発注書を同封する送付状を作って',
        checkType: 'send_message',
      },
    ],
  },
  {
    id: 'doc-4',
    category: 'documents',
    number: 4,
    title: '下請法違反の発注書をチェックさせる',
    description: 'わざと問題のある発注書を作り、AI にリスクを指摘させる。',
    objective: 'AI を法務レビュアーとして使う',
    difficulty: 3,
    estimatedTime: '4分',
    sampleAnswer:
      'リスク指摘 3 点: (1) 支払期日 60 日は下請法 2 条の 2 に抵触の可能性 / (2) 書面交付事項の記載漏れ / (3) 品目記載の粒度不足。併せて、支払期日を 30 日以内に改めた修正版発注書（JTC 体裁 PDF）を出力。',
    steps: [
      {
        instruction: '下請法違反を含む発注書を AI に検証依頼',
        hint: '以下の発注書に下請法・フリーランス新法上の問題がないかチェックして。\n発注先: 個人事業主 佐藤太郎 / 品目: Webデザイン / 金額: 45万円 / 支払条件: 納品後60日以内',
        checkType: 'send_message',
      },
      {
        instruction: '指摘内容を確認（支払期日 60 日 = 下請法違反の可能性）',
        checkType: 'receive_response',
      },
      {
        instruction: '修正版の発注書を再生成させる',
        hint: '支払条件を「納品後30日以内」に修正した発注書を再作成して',
        checkType: 'send_message',
      },
    ],
  },
  {
    id: 'doc-5',
    category: 'documents',
    number: 5,
    title: 'メモリにデフォルト設定を保存',
    description: '敬称・支払条件・消費税などの定型をメモリに記憶させる。',
    objective: 'メモリで毎回の指示を省く',
    difficulty: 2,
    estimatedTime: '3分',
    sampleAnswer:
      'メモリ保存後は、新規会話で「見積書作って」だけでも敬称「御中」・支払条件「月末締翌月末払い」・消費税 10% が自動反映された御見積書（JTC 体裁 PDF）が出力される。',
    steps: [
      {
        instruction: 'デフォルト設定をメモリに保存',
        hint: 'メモリに保存して:\n・敬称は御中を使用\n・支払条件はデフォルトで月末締め翌月末払い\n・消費税は 10%',
        checkType: 'send_message',
      },
      {
        instruction: '新しい会話で見積書を作成',
        hint: '株式会社XYZに見積書を作って。内容: サイト改修 50 万円',
        checkType: 'send_message',
      },
      {
        instruction: 'メモリの設定が反映されているか確認',
        checkType: 'receive_response',
      },
    ],
  },

  // ── 議事録自動化 (3) ──
  {
    id: 'min-1',
    category: 'minutes',
    number: 6,
    title: '走り書きメモを議事録に',
    description: '箇条書きメモを、決定事項・ToDo・次回予定の 6 セクション議事録に。',
    objective: '非構造データを構造化させる',
    difficulty: 1,
    estimatedTime: '3分',
    sampleAnswer:
      'JTC Word 議事録体裁で出力（プレビュー + PDF 可）。構成は 1.日時 / 2.場所 / 3.参加者 / 4.議題 / 5.決定事項 / 6.懸案事項・ToDo（担当・期限を表形式）/ 7.次回開催。末尾に「以上」。',
    steps: [
      {
        instruction: '走り書きメモを AI 社員に渡す',
        hint: '以下の会議メモを議事録に整理して。\n4/22 定例 参加: 田中、佐藤、鈴木\n・売上 前月比 +15%\n・新規 A 社 来週提案\n・佐藤 見積書 / 鈴木 競合調査\n・次回 来週金曜',
        checkType: 'send_message',
      },
      {
        instruction: '6 セクション構造になっているか確認',
        checkType: 'receive_response',
      },
      {
        instruction: 'ToDo の担当者が明示されているか確認',
        checkType: 'receive_response',
      },
    ],
  },
  {
    id: 'min-2',
    category: 'minutes',
    number: 7,
    title: '音声ファイルから議事録',
    description: 'ダッシュボードの「議事録」ツールで mp3 / m4a をアップロード。',
    objective: '音声 → 文字起こし → 議事録の流れを掴む',
    difficulty: 2,
    estimatedTime: '5分',
    sampleAnswer:
      '文字起こし全文に加えて、JTC 議事録体裁の PDF を出力（プレビュー + ダウンロード可）。発言者別要約・決定事項・ToDo（担当・期限）を表形式で整理。',
    steps: [
      {
        instruction: 'ダッシュボードの「ツール > 議事録」を開く',
        checkType: 'send_message',
      },
      {
        instruction: '音声ファイルをアップロード（mp3 / m4a / wav 対応）',
        checkType: 'send_message',
      },
      {
        instruction: '生成された議事録の精度を確認',
        checkType: 'receive_response',
      },
    ],
  },
  {
    id: 'min-3',
    category: 'minutes',
    number: 8,
    title: '議事録から自分のタスクだけ抽出',
    description: '生成済み議事録に対して「佐藤の TODO だけ」等のフィルタ指示。',
    objective: '既存出力に対する後続加工を体験',
    difficulty: 2,
    estimatedTime: '3分',
    sampleAnswer:
      '佐藤担当の ToDo のみを抽出: (1) 見積書作成 / (2) 先方との日程調整。画面上に箇条書きで表示（紙化不要）。',
    steps: [
      {
        instruction: '議事録生成の後、自分宛の ToDo だけ抽出',
        hint: 'この議事録から、佐藤さんの ToDo だけ箇条書きで抜き出して',
        checkType: 'send_message',
      },
      {
        instruction: '担当者でフィルタされているか確認',
        checkType: 'receive_response',
      },
    ],
  },

  // ── スライド生成 (3) ──
  {
    id: 'slide-1',
    category: 'slides',
    number: 9,
    title: '新サービス紹介のスライド 10 枚',
    description: '1 行の指示で、表紙〜まとめまで 10 枚構成を自動生成。',
    objective: 'スライドの構成をスピード作成',
    difficulty: 1,
    estimatedTime: '3分',
    sampleAnswer:
      '16:9 PowerPoint 体裁のスライド 10 枚。表紙 / なぜ今 / 課題 / 解決策 / 機能 2 枚 / 事例 / 料金 / 導入フロー / まとめ。プレビュー + PDF ダウンロード（1 枚 1 ページ）可。',
    steps: [
      {
        instruction: 'ツール > スライド生成で新規生成',
        hint: '新サービス「AI 社員」紹介のスライドを 10 枚で作って。営業担当が中小企業社長に提案する場面で使う',
        checkType: 'send_message',
      },
      {
        instruction: '生成された構成を確認',
        checkType: 'receive_response',
      },
      {
        instruction: 'PPTX をダウンロード',
        checkType: 'download',
      },
    ],
  },
  {
    id: 'slide-2',
    category: 'slides',
    number: 10,
    title: '月次報告スライド（役員向け）',
    description: '数値データを渡して、役員レビュー向け 5 枚構成のスライドに。',
    objective: '数値データからストーリー化',
    difficulty: 2,
    estimatedTime: '5分',
    sampleAnswer:
      '16:9 PowerPoint 体裁のスライド 5 枚（プレビュー + PDF 可）。エグゼクティブサマリ / KPI ダッシュボード / 成果 / 課題と対策 / 次月アクション。',
    steps: [
      {
        instruction: '数値 + 構成指示を一度に',
        hint: '4 月の月次報告スライドを役員向けに 5 枚で作って。売上 350 万円（前月比 +15%）、新規 5 社、解約 1 社、主な成果: A 社受注 / B 社継続',
        checkType: 'send_message',
      },
      {
        instruction: '役員視点になっているか確認（数字・打ち手の論点）',
        checkType: 'receive_response',
      },
    ],
  },
  {
    id: 'slide-3',
    category: 'slides',
    number: 11,
    title: '議事録から提案スライドへ',
    description: '前工程で作った議事録を流用して、提案スライドに展開。',
    objective: '工程間の成果物を連鎖させる',
    difficulty: 3,
    estimatedTime: '6分',
    sampleAnswer:
      '議事録の「決定事項」と「ToDo」を材料に、提案背景 → 課題 → 提案内容 → スケジュール → 料金 → まとめ の 8 枚スライド（16:9 PowerPoint 体裁、PDF 可）。',
    steps: [
      {
        instruction: '既存の議事録を参照して依頼',
        hint: '先ほどの議事録に基づいて、A 社向けの提案スライドを 8 枚で作って。背景 → 課題 → 提案内容 → スケジュール → 料金 → まとめ',
        checkType: 'send_message',
      },
      {
        instruction: '議事録の内容が提案に反映されているか確認',
        checkType: 'receive_response',
      },
    ],
  },

  // ── Excel 分析 (3) ──
  {
    id: 'excel-1',
    category: 'excel',
    number: 12,
    title: '売上データから月次推移',
    description: 'Excel をアップロードして、月次の推移と前月比を言語化。',
    objective: '表 → インサイト変換',
    difficulty: 1,
    estimatedTime: '3分',
    sampleAnswer:
      '「売上データ分析報告書」（JTC 体裁、プレビュー + PDF 可）を出力。月次売上は 6 ヶ月で +44.6%、最高の伸びは 4 月（+15.7%）、最低は 1 月（-4.8%）等。',
    steps: [
      {
        instruction: 'ツール > Excel 分析で sales.xlsx をアップロード',
        checkType: 'send_message',
      },
      {
        instruction: '月次推移を質問',
        hint: 'このデータから月次の売上推移を教えて。前月比と特筆すべき点も含めて',
        checkType: 'send_message',
      },
      {
        instruction: 'インサイトの妥当性を確認',
        checkType: 'receive_response',
      },
    ],
  },
  {
    id: 'excel-2',
    category: 'excel',
    number: 13,
    title: '費目別の支出をランキング',
    description: '経費データから、金額が大きい費目を順に抽出。',
    objective: 'シートを集計軸で切り替えて読ませる',
    difficulty: 2,
    estimatedTime: '4分',
    sampleAnswer:
      '「費目別支出分析報告書」（JTC 体裁 PDF）を出力。順位表 1.人件費 / 2.外注費 / 3.SaaS 費、上位 3 費目で総額の 78% を占める等の所見を併記。',
    steps: [
      {
        instruction: '経費シートを Excel 分析にアップロード',
        checkType: 'send_message',
      },
      {
        instruction: '費目ランキングを依頼',
        hint: '費目別に合計金額が大きい順に TOP 5 を教えて。全体に占める割合も',
        checkType: 'send_message',
      },
      {
        instruction: '順位と比率が正しいか確認',
        checkType: 'receive_response',
      },
    ],
  },
  {
    id: 'excel-3',
    category: 'excel',
    number: 14,
    title: '2 シート比較で異常値検出',
    description: '予算と実績のシートを突き合わせて、差異が大きい項目を指摘させる。',
    objective: '複数シート読込 + 突合',
    difficulty: 3,
    estimatedTime: '5分',
    sampleAnswer:
      '「予実差異分析報告書」（JTC 体裁 PDF）。広告費 +43%、人件費 -8% など差異 3 点を表形式で、原因仮説と次アクション案を各項目ごとに併記。',
    steps: [
      {
        instruction: '予算シート + 実績シートの両方をアップロード',
        checkType: 'send_message',
      },
      {
        instruction: '予実差異を依頼',
        hint: '予算シートと実績シートを突き合わせて、差異が ±10% を超える項目を指摘して。原因仮説も添えて',
        checkType: 'send_message',
      },
      {
        instruction: '指摘された項目と仮説を確認',
        checkType: 'receive_response',
      },
    ],
  },

  // ── Wide Research (2) — 画面出力でOK、入力により出力が分岐 ──
  {
    id: 'res-1',
    category: 'research',
    number: 15,
    title: 'SaaS 業界の 2026 年動向',
    description: '複数ソースを横断して、出典付きの業界レポートを生成（画面表示）。',
    objective: 'Wide Research の所要時間と質感を体感',
    difficulty: 2,
    estimatedTime: '5分',
    sampleAnswer:
      '入力テーマにより出力構成が変化します。例えば「SaaS 業界動向」を指定した場合: 市場規模 / 主要プレイヤー / 競争軸の変化 / 日本市場の差別化要因 / 中小企業示唆 の 5 セクション + 出典 10 件。画面上の構造化レポートとして表示（紙化不要）。',
    steps: [
      {
        instruction: 'ツール > Wide Research に切り替え',
        checkType: 'send_message',
      },
      {
        instruction: '国内 SaaS 業界動向を依頼',
        hint: '国内 SaaS 業界の 2026 年動向を調べて。市場規模・主要プレイヤー・中小企業向けの示唆を含めて、出典付きで',
        checkType: 'send_message',
      },
      {
        instruction: '出典 URL が複数ついているか確認',
        checkType: 'receive_response',
      },
    ],
  },
  {
    id: 'res-2',
    category: 'research',
    number: 16,
    title: '競合 3 社の比較レポート',
    description: '指名した 3 社の機能・料金・強みを横並び比較（画面表示）。',
    objective: '比較軸を指定してリサーチを誘導',
    difficulty: 3,
    estimatedTime: '6分',
    sampleAnswer:
      '入力で指名した 3 社についての比較レポートを画面表示。機能マトリクス / 料金比較 / 強み弱み / 自社との差別化ポイント提案。紙化は不要（画面の構造化表示）。',
    steps: [
      {
        instruction: '比較対象を指名してリサーチ',
        hint: 'freee / マネーフォワード / Sansan の 3 社について、機能・料金・強み・弱みを比較したレポートを出典付きで作って',
        checkType: 'send_message',
      },
      {
        instruction: '比較表の形式で整っているか確認',
        checkType: 'receive_response',
      },
    ],
  },

  // ── 文書校正 (2) ──
  {
    id: 'proof-1',
    category: 'proofread',
    number: 17,
    title: 'ラフなメールを敬語に校正',
    description: 'カジュアルな文面を、社外向けビジネスメールに。',
    objective: '敬語レベルを指示する',
    difficulty: 1,
    estimatedTime: '2分',
    sampleAnswer:
      '画面に修正差分を表示（紙化不要）。「お疲れ様です」→「いつもお世話になっております」など 5 箇所を before/after 併記、修正理由を各項目に明記。',
    steps: [
      {
        instruction: 'ラフなメール原文で校正依頼',
        hint: '以下のメールを社外向けの丁寧な敬語に校正して。\n\nお疲れ様です。見積書の件ですが、明日出します。振込先は前と同じで大丈夫です。よろしく。',
        checkType: 'send_message',
      },
      {
        instruction: '修正理由が添えられているか確認',
        checkType: 'receive_response',
      },
    ],
  },
  {
    id: 'proof-2',
    category: 'proofread',
    number: 18,
    title: '契約書の用語統一',
    description: '揺れている用語（甲/乙、発注者/委託先）を統一させる。',
    objective: '文書全体の一貫性を保たせる',
    difficulty: 2,
    estimatedTime: '4分',
    sampleAnswer:
      '画面に差分を表示（紙化不要）。「発注者」と「甲」の混在を「甲」に統一、該当箇所 7 件を行単位の before/after で提示。',
    steps: [
      {
        instruction: '契約書のドラフトをコピペして校正依頼',
        hint: '以下の契約書の用語を「甲」「乙」に統一して。混在している「発注者」「委託先」などを全て置き換えて差分で教えて',
        checkType: 'send_message',
      },
      {
        instruction: '差分と置換箇所を確認',
        checkType: 'receive_response',
      },
    ],
  },

  // ── Calendar / Gmail 連携 (3) ──
  {
    id: 'conn-1',
    category: 'connectors',
    number: 19,
    title: '朝のブリーフィングを出す',
    description: 'Calendar と Gmail から、今日やるべきことを整理。',
    objective: '連携済み前提で日次運用',
    difficulty: 1,
    estimatedTime: '2分',
    sampleAnswer:
      '朝のブリーフィング画面（紙化不要）。今日の予定 3 件 + 未読メールから抽出したタスク 4 件を、優先度つきで表示。昨日完了と保留中（相手待ち）も併記。',
    steps: [
      {
        instruction: '設定 > 連携で Google Calendar / Gmail を接続',
        checkType: 'send_message',
      },
      {
        instruction: 'AI 社員に依頼',
        hint: '今日の朝のブリーフィングを出して。予定と未読メールから最優先タスクを 3 つ教えて',
        checkType: 'send_message',
      },
      {
        instruction: '実データが引けているか確認',
        checkType: 'receive_response',
      },
    ],
  },
  {
    id: 'conn-2',
    category: 'connectors',
    number: 20,
    title: 'メール下書きを Gmail に流す',
    description: '校正済み文面を Gmail の下書きとして保存する（送信は判断）。',
    objective: '出力を実アプリに届ける',
    difficulty: 2,
    estimatedTime: '3分',
    sampleAnswer:
      'Gmail 下書きフォルダに、宛先・件名・本文・添付予定を含んだ下書きが保存される。画面で内容を確認可能（紙化不要・送信は人が判断）。',
    steps: [
      {
        instruction: '下書きを依頼',
        hint: '株式会社サンプル商事の田中様宛に、来週火曜 14:00 〜 の打合せ依頼メールを、丁寧な敬語で Gmail の下書きに保存して',
        checkType: 'send_message',
      },
      {
        instruction: 'Gmail 下書きフォルダに実際に保存されたか確認',
        checkType: 'receive_response',
      },
    ],
  },
  {
    id: 'conn-3',
    category: 'connectors',
    number: 21,
    title: '会議資料をまとめてメール下書き',
    description: '明日の会議の議題 + 資料リンクを自動でメール本文に。',
    objective: '前日準備を一括で終わらせる',
    difficulty: 3,
    estimatedTime: '4分',
    sampleAnswer:
      'Calendar から明日の会議を特定 → 議題を箇条書き化 → Drive の関連ファイル 2 点をリンク添付したメール下書きを Gmail に保存。画面で確認（紙化不要）。',
    steps: [
      {
        instruction: '会議情報を元に依頼',
        hint: '明日 14:00 の会議について、参加者全員に向けて議題と関連資料のリンクをまとめたメール下書きを作って',
        checkType: 'send_message',
      },
      {
        instruction: '参加者・議題・資料が揃っているか確認',
        checkType: 'receive_response',
      },
    ],
  },

  // ── 複合タスク (2) ──
  {
    id: 'int-1',
    category: 'integration',
    number: 22,
    title: 'A 社提案の一式を 1 つの指示で',
    description: '調査 + スライド + メール下書きを 1 回の指示で。',
    objective: 'AI 社員の真価を体験する',
    difficulty: 3,
    estimatedTime: '8分',
    sampleAnswer:
      '4 成果物。紙化対象: (1) 提案スライド 12 枚（PDF 可）/ (2) 業界調査レポート（画面表示、紙化任意）。紙化不要: (3) 会議設定メール下書き / (4) Calendar 仮予定。各成果物はプレビュー or 詳細モーダルで確認できる。',
    steps: [
      {
        instruction: '複合指示を送信',
        hint: '株式会社ABC 向けの来週火曜の提案準備を全部お願い。\n1. 業界動向調査（出典付き）\n2. 提案スライド 12 枚\n3. 会議依頼メールの下書き\n4. Calendar に仮予定登録',
        checkType: 'send_message',
      },
      {
        instruction: '4 つの成果物が揃っているか確認',
        checkType: 'receive_response',
      },
      {
        instruction: 'スライドをダウンロード + Gmail 下書きを確認',
        checkType: 'download',
      },
    ],
  },
  {
    id: 'int-2',
    category: 'integration',
    number: 23,
    title: '月次クロージングを自動化',
    description: 'Excel 集計 → 月次報告書 → スライド → 送信先まで 1 指示で。',
    objective: 'ルーティン業務を丸ごと任せる',
    difficulty: 3,
    estimatedTime: '10分',
    sampleAnswer:
      '成果物 3 種。紙化対象: (1) 月次分析報告書（JTC 体裁 PDF）/ (2) 役員向けスライド 5 枚（16:9 PDF）。紙化不要: (3) 役員 3 名宛 Gmail 下書き（PDF・スライドを添付予定）。',
    steps: [
      {
        instruction: '月次の Excel を事前にアップロード',
        checkType: 'send_message',
      },
      {
        instruction: '複合指示を送信',
        hint: 'アップした 4 月の売上シートから月次クロージングをお願い。\n1. 月次報告書（文書）\n2. 役員向けスライド 5 枚\n3. 役員 3 名（代表・CFO・COO）宛のメール下書き（PDF + スライドを添付する前提）',
        checkType: 'send_message',
      },
      {
        instruction: '全成果物をダウンロード / 下書き確認',
        checkType: 'download',
      },
    ],
  },
];

/* ── Helpers ─────────────────────────────────────────────────── */

export function getQuestsByCategory(category: QuestCategory): Quest[] {
  return QUESTS.filter((q) => q.category === category);
}

export function getCategoryMeta(category: QuestCategory): QuestCategoryMeta {
  const meta = CATEGORY_META.find((m) => m.id === category);
  if (!meta) throw new Error(`Unknown category: ${String(category)}`);
  return meta;
}

export function difficultyLabel(d: QuestDifficulty): string {
  return d === 1 ? '★' : d === 2 ? '★★' : '★★★';
}
