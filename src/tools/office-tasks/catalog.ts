/**
 * FujiTrace AI Office Task Catalog — all 130 task entries from
 * docs/事務作業カタログ_v2.md (excluding estimate.create and estimate.check
 * which have their own dedicated schemas in src/tools/estimate/).
 *
 * Each entry maps to a single ToolSchema for the AI clerk's Layer 1
 * exact matching. Forbidden tasks (士業独占業務) are registered but
 * the endpoint returns a structured refusal.
 *
 * Source of truth: docs/事務作業カタログ_v2.md (v2, 2026-04-09)
 */

import type { ArchetypeId, ArchetypeField, ValidationRule } from './archetypes.js';

export interface OfficeTaskEntry {
  /** Unique ID: category.action_name format */
  id: string;
  /** Japanese task name (from catalog) */
  name: string;
  /** Japanese description (30-60 chars for GPT-4o matching) */
  description: string;
  /** Top-level category */
  category: string;
  /** Responsibility level */
  responsibilityLevel: 'high' | 'medium' | 'low';
  /** Whether this task is forbidden (士業独占業務) */
  forbidden: boolean;
  /** The law that forbids this task (if forbidden) */
  forbiddenLaw?: string;
  /** Caution note for tasks marked as 'caution' in 士業独占 */
  cautionNote?: string;
  /** Archetype pattern this task belongs to */
  archetype: ArchetypeId;
  /** Task-specific fields to ADD to the archetype's default fields */
  taskSpecificFields?: ArchetypeField[];
  /** Task-specific validation rules to ADD to the archetype's defaults */
  taskSpecificValidation?: ValidationRule[];
  /** Task-specific prompt additions (domain knowledge injected into the prompt) */
  domainKnowledge?: string;
}

export const officeTaskCatalog: OfficeTaskEntry[] = [
  // ─────────────────────────────────────────────────────────
  // 1. 経理・財務
  // ─────────────────────────────────────────────────────────

  // 1.1 見積業務
  // NOTE: estimate.create is registered separately in src/tools/estimate/
  // (dedicated route /api/tools/estimate/create).
  // accounting.estimate_check is registered below, routed through the
  // document_check archetype. The specialized /api/tools/estimate/check
  // route with market-rate logic is still used by in-form verification
  // (src/routes/tools/estimate-create.ts).
  {
    id: 'accounting.estimate_check',
    name: '見積書検証（受領・社内レビュー）',
    description: '受領または提出前の見積書を算術・税率・記載事項・書類成立性の観点で自動検証する',
    category: '経理・財務',
    responsibilityLevel: 'high',
    forbidden: false,
    archetype: 'document_check',
    domainKnowledge: '見積書を検証する。チェック項目: (1) 算術チェック（明細小計=数量×単価×(1+税率)、合計=小計+税）、(2) 記載事項の網羅性（発行者/宛先/件名/見積番号/発行日/有効期限/品目/金額/税率/合計/支払条件/納期）、(3) 書類成立性（誤字脱字・テスト入力「aaa」等の検出、押印欄/署名欄の空白）、(4) 税率の整合（軽減税率対象品の混在時の税率別小計）、(5) 有効期限・支払条件・納期の整合。相場乖離の警告は抑制的に扱い、critical/warning には入れない',
  },
  {
    id: 'accounting.estimate_template_unify',
    name: '見積書テンプレート統一',
    description: '社内バラバラの見積書フォーマットを統一テンプレートに流し込む',
    category: '経理・財務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'accounting.estimate_agreement_record',
    name: '見積合意記録（口頭→文書化）',
    description: 'メール・議事録の断片から見積条件を抽出し文書化する',
    category: '経理・財務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'data_extract',
  },

  // 1.2 請求業務
  {
    id: 'accounting.invoice_create',
    name: '請求書作成',
    description: '取引情報から日本語の請求書を生成する',
    category: '経理・財務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'accounting.invoice_check',
    name: '請求書検証（受領側チェッカー）',
    description: '算術・税率・インボイス登録番号・記載事項を自動検証する',
    category: '経理・財務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'document_check',
    domainKnowledge: '受領した請求書を検証する。チェック項目: (1) 算術チェック（明細小計=数量×単価、合計=小計+税）、(2) インボイス制度対応（適格請求書発行事業者番号の存在、T+13桁形式）、(3) 源泉徴収の要否判定、(4) 支払サイトと契約の整合、(5) 記載事項の網羅性（発行者名/日付/品目/金額/税率/合計/振込先）',
  },
  // 1.2.1 納品書・発注書・送付状（コア事務作業）
  {
    id: 'accounting.delivery_note_create',
    name: '納品書作成',
    description: '取引情報から日本語の納品書を生成する',
    category: '経理・財務',
    responsibilityLevel: 'medium',
    forbidden: false,
    archetype: 'document_create',
  },
  {
    id: 'accounting.purchase_order_create',
    name: '発注書作成',
    description: '取引情報から日本語の発注書を生成する',
    category: '経理・財務',
    responsibilityLevel: 'high',
    forbidden: false,
    archetype: 'document_create',
  },
  {
    id: 'general_affairs.cover_letter_create',
    name: '送付状作成',
    description: '書類送付時の送付状を自動生成する',
    category: '総務・庶務',
    responsibilityLevel: 'low',
    forbidden: false,
    archetype: 'document_create',
  },
  {
    id: 'accounting.invoice_pdf_digitize',
    name: '請求書PDF読み取り・データ化',
    description: 'OCR+LLMで請求書PDFを構造化データに変換する',
    category: '経理・財務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'accounting.payment_term_check',
    name: '支払サイト・期日チェック',
    description: '契約と請求書の支払サイト不整合を自動検出する',
    category: '経理・財務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'document_check',
  },
  {
    id: 'accounting.payment_reconciliation',
    name: '入金消込の突合提案',
    description: '銀行明細と請求書の照合・突合提案を生成する',
    category: '経理・財務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'accounting.invoice_number_verify',
    name: 'インボイス登録番号の有効性チェック',
    description: '国税庁APIでインボイス登録番号を照合し適格要件を確認する',
    category: '経理・財務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'compliance_check',
  },

  // 1.3 経費・精算
  {
    id: 'accounting.expense_check',
    name: '経費申請内容チェック',
    description: '経費申請の規程違反・勘定科目誤り・按分ミスを検出する',
    category: '経理・財務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'document_check',
    domainKnowledge: '経費申請を検証する。チェック項目: (1) 勘定科目の妥当性、(2) 金額の上限チェック（社内規程準拠）、(3) 按分計算の整合性、(4) 領収書の必須要件（日付/宛名/金額/発行者/但書）、(5) 交際費5,000円基準',
  },
  {
    id: 'accounting.receipt_ocr_classify',
    name: '領収書OCR+勘定科目推定',
    description: '領収書をOCRで読み取り勘定科目を推定する',
    category: '経理・財務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'accounting.travel_expense_check',
    name: '出張旅費精算の整合チェック',
    description: '日当・交通費・宿泊費の規程準拠をチェックする',
    category: '経理・財務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_check',
  },
  {
    id: 'accounting.entertainment_expense_classify',
    name: '交際費・会議費の按分判定',
    description: '交際費と会議費の按分を判定する（税務判断は税理士確認必須）',
    category: '経理・財務',
    responsibilityLevel: 'medium',
    forbidden: false,
    cautionNote: '税務判断に踏み込み過ぎると税理士法抵触リスクがあります。最終判断は税理士にご確認ください。',
  
    archetype: 'document_check',
  },
  {
    id: 'accounting.reimbursement_create',
    name: '立替経費の清算書作成',
    description: '領収書群から立替精算書を自動組成し按分記録を付与する',
    category: '経理・財務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_create',
  },

  // 1.4 発注・支払
  {
    id: 'accounting.purchase_order_check',
    name: '発注書/注文請書の整合チェック',
    description: '発注と受注の金額・数量・納期の不一致を検出する',
    category: '経理・財務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'document_check',
    domainKnowledge: '発注書と注文請書の整合をチェック。チェック項目: (1) 品名・数量・単価の一致、(2) 納期の整合、(3) 支払条件の一致、(4) 消費税率・税額の整合',
  },
  {
    id: 'accounting.duplicate_order_detect',
    name: '二重発注・重複支払検知',
    description: '過去発注履歴との照合で二重発注・重複支払を検知する',
    category: '経理・財務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'document_check',
  },
  {
    id: 'accounting.payment_schedule_create',
    name: '支払予定表の作成',
    description: '請求書群から月次支払スケジュールを自動生成する',
    category: '経理・財務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'reminder',
  },
  {
    id: 'accounting.withholding_tax_calc',
    name: '源泉徴収額の計算補助',
    description: '源泉徴収額を機械的に計算する（税額判断は税理士確認必須）',
    category: '経理・財務',
    responsibilityLevel: 'medium',
    forbidden: false,
    cautionNote: '機械的計算のみです。税額判断は税理士にご確認ください。',
  
    archetype: 'document_create',
  },
  {
    id: 'accounting.direct_debit_form',
    name: '口座振替依頼書の作成',
    description: '取引先情報から口座振替依頼書テンプレートを作成する',
    category: '経理・財務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'document_create',
  },

  // 1.5 決算・申告関連
  {
    id: 'accounting.trial_balance_review',
    name: '月次試算表の数値レビュー',
    description: '月次試算表の数値を機械的にレビューする（税務解釈は含まない）',
    category: '経理・財務',
    responsibilityLevel: 'medium',
    forbidden: false,
    cautionNote: '税務解釈に踏み込まないでください。最終判断は税理士にご確認ください。',
  
    archetype: 'report',
  },
  {
    id: 'accounting.financial_statements_create',
    name: '決算書作成',
    description: '[対応不可] 決算書の作成代行は士業独占業務です',
    category: '経理・財務',
    responsibilityLevel: 'high',
    forbidden: true,
    forbiddenLaw: '税理士法第52条',
  
    archetype: 'forbidden',
  },
  {
    id: 'accounting.tax_return_create',
    name: '確定申告書作成',
    description: '[対応不可] 確定申告書の作成は士業独占業務です',
    category: '経理・財務',
    responsibilityLevel: 'high',
    forbidden: true,
    forbiddenLaw: '税理士法第52条',
  
    archetype: 'forbidden',
  },
  {
    id: 'accounting.corporate_tax_return_create',
    name: '法人税・消費税申告書作成',
    description: '[対応不可] 法人税・消費税申告書の作成は士業独占業務です',
    category: '経理・財務',
    responsibilityLevel: 'high',
    forbidden: true,
    forbiddenLaw: '税理士法第52条',
  
    archetype: 'forbidden',
  },
  {
    id: 'accounting.balance_cert_reminder',
    name: '預金残高証明書の取得リマインダー',
    description: '決算期・融資更新期に必要な残高証明の取得を事前通知する',
    category: '経理・財務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'reminder',
  },
  {
    id: 'accounting.fixed_asset_inventory',
    name: '固定資産の棚卸記録作成',
    description: '固定資産台帳と実地棚卸結果の突合・増減を記録化する',
    category: '経理・財務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'master_data',
  },

  // ─────────────────────────────────────────────────────────
  // 2. 人事・労務
  // ─────────────────────────────────────────────────────────

  // 2.1 採用
  {
    id: 'hr.job_posting_check',
    name: '求人票の表現チェック',
    description: '求人票の男女雇用機会均等法・年齢差別等の違反表現を検出する',
    category: '人事・労務',
    responsibilityLevel: 'medium',
    forbidden: false,
    cautionNote: '法的助言ではなく機械的なチェックです。最終判断は社労士にご確認ください。',
  
    archetype: 'document_check',
  },
  {
    id: 'hr.resume_summary',
    name: '職務経歴書の要約・評価補助',
    description: '応募者の経歴を構造化し要約する（最終判断は人間）',
    category: '人事・労務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'hr.interview_feedback_format',
    name: '面接フィードバック整形',
    description: '複数面接官のメモを統合し評価項目ごとに整理・矛盾を検出する',
    category: '人事・労務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'hr.offer_letter_draft',
    name: 'オファーレター下書き',
    description: 'オファーレターの初稿を作成する（労働条件通知書の法定記載事項は社労士確認必須）',
    category: '人事・労務',
    responsibilityLevel: 'medium',
    forbidden: false,
    cautionNote: '労働条件通知書の法定記載事項は社労士にご確認ください。',
  
    archetype: 'document_create',
  },
  {
    id: 'hr.new_hire_contact_schedule',
    name: '入社内定者への連絡スケジュール管理',
    description: '内定から入社までの連絡タイミングをトラッキングする',
    category: '人事・労務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'reminder',
  },

  // 2.2 入社・退社
  {
    id: 'hr.onboarding_checklist',
    name: '入社書類チェックリスト生成',
    description: '業種・雇用形態別の必要書類リストを自動生成する',
    category: '人事・労務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'checklist',
  },
  {
    id: 'hr.labor_conditions_create',
    name: '労働条件通知書の作成補助',
    description: '[対応不可] 労働条件通知書の作成代行は士業独占業務です',
    category: '人事・労務',
    responsibilityLevel: 'high',
    forbidden: true,
    forbiddenLaw: '社労士法第27条',
  
    archetype: 'forbidden',
  },
  {
    id: 'hr.offboarding_checklist',
    name: '退職手続きチェックリスト',
    description: '貸与物回収・保険・有給精算の抜け漏れを検出する',
    category: '人事・労務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'checklist',
  },
  {
    id: 'hr.onboarding_progress',
    name: '入社オンボーディング進捗管理',
    description: '提出物と研修進捗の追跡・管理を行う',
    category: '人事・労務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'checklist',
  },
  {
    id: 'hr.employment_contract_check',
    name: '雇用契約書の記載項目チェック（機械的）',
    description: '労働基準法15条の法定記載事項の有無を機械的にチェックする（作成は禁止）',
    category: '人事・労務',
    responsibilityLevel: 'high',
    forbidden: false,
    cautionNote: '機械的なチェックのみです。契約書の作成・修正は行いません。最終判断は社労士にご確認ください。',
  
    archetype: 'document_check',
  },

  // 2.3 勤怠・給与
  {
    id: 'hr.attendance_anomaly_detect',
    name: '勤怠打刻の異常検知',
    description: '打刻漏れ・長時間労働・連続勤務の警告を行う',
    category: '人事・労務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_check',
  },
  {
    id: 'hr.payroll_calc',
    name: '給与計算',
    description: '[対応不可] 給与計算の代行は士業独占業務です',
    category: '人事・労務',
    responsibilityLevel: 'high',
    forbidden: true,
    forbiddenLaw: '社労士法第27条',
  
    archetype: 'forbidden',
  },
  {
    id: 'hr.article36_agreement_create',
    name: '36協定の作成代行',
    description: '[対応不可] 36協定の作成代行は士業独占業務です',
    category: '人事・労務',
    responsibilityLevel: 'high',
    forbidden: true,
    forbiddenLaw: '社労士法第27条',
  
    archetype: 'forbidden',
  },
  {
    id: 'hr.paid_leave_notification',
    name: '有給残日数の通知文面作成',
    description: '残日数に応じたリマインド文面の下書きを作成する',
    category: '人事・労務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'hr.shift_schedule_aggregate',
    name: 'アルバイト・パートのシフト希望集計',
    description: 'LINE・メール・紙のシフト希望を一覧化する',
    category: '人事・労務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'master_data',
  },

  // 2.4 人事評価・1on1
  {
    id: 'hr.one_on_one_summary',
    name: '1on1議事録の要約・タグ付け',
    description: '1on1の音声・文字起こしから要点を抽出しタグ付けする',
    category: '人事・労務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'hr.performance_review_draft',
    name: '人事考課コメントの下書き',
    description: '評価項目から定性コメントの初稿を生成する',
    category: '人事・労務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'hr.training_record_organize',
    name: '研修受講履歴の整理',
    description: '複数システムの研修ログを統合・整理する',
    category: '人事・労務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'hr.promotion_notice_draft',
    name: '昇格・昇進通知書の下書き',
    description: '辞令文面の初稿を生成する（最終確認は人事責任者）',
    category: '人事・労務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'hr.certification_renewal_reminder',
    name: '資格取得・更新のリマインダー管理',
    description: '業務上必要な資格の有効期限を通知・管理する',
    category: '人事・労務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'reminder',
  },

  // ─────────────────────────────────────────────────────────
  // 3. 総務・庶務
  // ─────────────────────────────────────────────────────────

  // 3.1 稟議・ワークフロー
  {
    id: 'general_affairs.approval_request_draft',
    name: '稟議書の下書き作成',
    description: '目的・金額・効果から稟議文書を生成する',
    category: '総務・庶務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'general_affairs.approval_request_check',
    name: '稟議書の妥当性チェック',
    description: '金額と決裁権限マトリクスの整合をチェックする',
    category: '総務・庶務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'document_check',
  },
  {
    id: 'general_affairs.approval_route_suggest',
    name: '決裁ルート提案',
    description: '金額・部門別の決裁ルートを自動提示する',
    category: '総務・庶務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'general_affairs.stamp_approval_tracker',
    name: '押印・決裁が必要な書類の一覧管理',
    description: '進行中の書類の押印状況・決裁状況を可視化する',
    category: '総務・庶務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'master_data',
  },

  // 3.2 備品・発注
  {
    id: 'general_affairs.supply_order_create',
    name: '備品発注書作成',
    description: '在庫閾値に応じた備品発注案を作成する',
    category: '総務・庶務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'general_affairs.consumable_reorder_remind',
    name: '消耗品の定期発注リマインド',
    description: '消耗品の定期発注タイミングをリマインドする',
    category: '総務・庶務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'reminder',
  },
  {
    id: 'general_affairs.business_card_order',
    name: '名刺発注依頼書作成',
    description: '氏名・役職から名刺発注依頼書テンプレートを作成する',
    category: '総務・庶務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'general_affairs.office_cleaning_remind',
    name: 'オフィス清掃・備品補充の発注リマインダー',
    description: '固定ベンダーへの発注タイミングを通知する',
    category: '総務・庶務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'reminder',
  },

  // 3.3 社内通知・告知
  {
    id: 'general_affairs.internal_notice_draft',
    name: '社内通知メールの下書き',
    description: '就業時間変更・休業日等のアナウンスメール下書きを作成する',
    category: '総務・庶務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'general_affairs.minutes_distribution_draft',
    name: '議事録の配布文面作成',
    description: '議事録と配布先選定のドラフトを作成する',
    category: '総務・庶務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'general_affairs.external_notice_draft',
    name: '社外向け案内状の下書き',
    description: '年末年始・移転・休業等の社外向け案内文面を下書きする',
    category: '総務・庶務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'general_affairs.disaster_drill_notice',
    name: '防災訓練・避難訓練の案内作成',
    description: '法定訓練の実施案内と参加記録テンプレートを作成する',
    category: '総務・庶務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'general_affairs.company_newsletter_draft',
    name: '社内報の下書き（月次）',
    description: '部門トピックを統合した月次社内報の下書きを作成する',
    category: '総務・庶務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'document_create',
  },

  // 3.4 会議・予約
  {
    id: 'general_affairs.meeting_room_booking',
    name: '会議室予約',
    description: 'カレンダーAPI統合による会議室予約を支援する',
    category: '総務・庶務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'master_data',
  },
  {
    id: 'general_affairs.meeting_agenda_create',
    name: '会議アジェンダ作成',
    description: '前回議事録から継続議題を抽出しアジェンダを作成する',
    category: '総務・庶務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'general_affairs.meeting_minutes_create',
    name: '議事録作成（文字起こし→要点）',
    description: '文字起こしから要点を抽出し議事録を作成する',
    category: '総務・庶務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'general_affairs.visitor_reception_log',
    name: '来客受付記録・入退館管理補助',
    description: '来訪者リストと入退館ログの整合を管理する',
    category: '総務・庶務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'master_data',
  },
  {
    id: 'general_affairs.company_car_booking',
    name: '社用車の予約管理',
    description: '社用車の予約衝突検出とドライバー割当を管理する',
    category: '総務・庶務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'master_data',
  },

  // 3.5 郵便・ファイリング
  {
    id: 'general_affairs.mail_reception_log',
    name: '郵便物受付記録',
    description: 'OCR+分類による郵便物の受付記録を管理する',
    category: '総務・庶務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'general_affairs.filename_normalize',
    name: 'ファイル名の命名規則統一',
    description: 'ファイル名を命名規則に沿って統一する',
    category: '総務・庶務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'general_affairs.document_auto_classify',
    name: '書類のカテゴリ自動振り分け',
    description: 'PDF群を勘定科目・契約種別に自動分類する',
    category: '総務・庶務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'data_extract',
  },

  // ─────────────────────────────────────────────────────────
  // 4. 法務・契約
  // ─────────────────────────────────────────────────────────

  // 4.1 契約書（機械的チェックに限定）
  {
    id: 'legal.subcontract_act_check',
    name: '契約書の記載事項チェック（下請法限定）',
    description: '下請法3条書面の必須記載事項を機械的にチェックする',
    category: '法務・契約',
    responsibilityLevel: 'high',
    forbidden: false,
    cautionNote: '機械的チェックのみです。法的助言ではありません。最終判断は弁護士にご確認ください。',
  
    archetype: 'compliance_check',
    domainKnowledge: '下請法第3条書面の必須記載事項を機械的にチェック。必須項目: (1) 親事業者の名称、(2) 下請事業者の名称、(3) 委託日、(4) 目的物・役務の内容、(5) 数量、(6) 下請代金の額、(7) 支払期日、(8) 支払方法。注意: 法的助言は禁止、記載事項の有無チェックのみ',
  },
  {
    id: 'legal.freelance_act_check',
    name: 'フリーランス新法チェッカー',
    description: 'フリーランス新法の発注書面の必須項目を機械的に確認する',
    category: '法務・契約',
    responsibilityLevel: 'high',
    forbidden: false,
    cautionNote: '機械的チェックのみです。法的助言ではありません。最終判断は弁護士にご確認ください。',
  
    archetype: 'compliance_check',
    domainKnowledge: 'フリーランス新法の発注書面必須項目を機械的にチェック。必須項目: (1) 業務内容、(2) 報酬額、(3) 支払期日、(4) 発注日、(5) 発注者の名称。60日以内支払ルールの計算チェック',
  },
  {
    id: 'legal.contract_consistency_check',
    name: '契約書の日付・当事者名整合チェック',
    description: '表紙・本文・別紙の当事者名・日付・金額の不一致を検出する',
    category: '法務・契約',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_check',
  },
  {
    id: 'legal.contract_diff_extract',
    name: '契約書の改定前後差分抽出',
    description: '契約書の新旧バージョンの差分を構造化表示する',
    category: '法務・契約',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'legal.contract_risk_alert',
    name: '契約書のリスクある条項の一般的注意喚起',
    description: 'リスクのある条項を検出し弁護士確認を促す（助言は禁止）',
    category: '法務・契約',
    responsibilityLevel: 'medium',
    forbidden: false,
    cautionNote: '法的助言は行いません。「この条項は弁護士確認を」の警告のみです。最終判断は弁護士にご確認ください。',
  
    archetype: 'compliance_check',
  },
  {
    id: 'legal.contract_review',
    name: '契約書レビュー（個別助言）',
    description: '[対応不可] 契約書の個別具体的な法的助言は士業独占業務です',
    category: '法務・契約',
    responsibilityLevel: 'high',
    forbidden: true,
    forbiddenLaw: '弁護士法第72条',
  
    archetype: 'forbidden',
  },
  {
    id: 'legal.contract_revision_propose',
    name: '契約書修正提案（具体）',
    description: '[対応不可] 契約書の具体的な修正提案は士業独占業務です',
    category: '法務・契約',
    responsibilityLevel: 'high',
    forbidden: true,
    forbiddenLaw: '弁護士法第72条',
  
    archetype: 'forbidden',
  },
  {
    id: 'legal.nda_template_select',
    name: '秘密保持契約書（NDA）の雛形選択支援',
    description: '用途別NDA雛形を提示する（選択のみ、修正は禁止）',
    category: '法務・契約',
    responsibilityLevel: 'medium',
    forbidden: false,
    cautionNote: '雛形の選択支援のみです。修正は行いません。最終確認は弁護士にご確認ください。',
  
    archetype: 'document_create',
  },
  {
    id: 'legal.memorandum_format_create',
    name: '覚書・確認書のフォーマット作成',
    description: '既存雛形からのフォーマット整形のみ行う（内容判断はしない）',
    category: '法務・契約',
    responsibilityLevel: 'medium',
    forbidden: false,
    cautionNote: 'フォーマット整形のみです。内容判断は行いません。最終判断は弁護士にご確認ください。',
  
    archetype: 'document_create',
  },

  // 4.2 コンプライアンス
  {
    id: 'legal.privacy_policy_check',
    name: '個人情報取扱規程の記載チェック',
    description: '個人情報取扱規程の必須項目の存在を確認する（内容判断は専門家へ）',
    category: '法務・契約',
    responsibilityLevel: 'medium',
    forbidden: false,
    cautionNote: '必須項目の存在確認のみです。内容判断は専門家にご確認ください。',
  
    archetype: 'compliance_check',
  },
  {
    id: 'legal.nda_required_items_check',
    name: 'NDAの必須項目チェック',
    description: 'NDAの目的・範囲・期間・違反時条項の存在を確認する',
    category: '法務・契約',
    responsibilityLevel: 'medium',
    forbidden: false,
    cautionNote: '必須項目の存在確認のみです。内容判断は専門家にご確認ください。',
  
    archetype: 'compliance_check',
  },
  {
    id: 'legal.my_number_processing',
    name: 'マイナンバー関連処理',
    description: '[対応不可] マイナンバー取扱代行は士業独占業務です',
    category: '法務・契約',
    responsibilityLevel: 'high',
    forbidden: true,
    forbiddenLaw: '個人情報保護法+マイナンバー法',
  
    archetype: 'forbidden',
  },
  {
    id: 'legal.litigation_evidence_list',
    name: '訴訟対応の証拠資料一覧作成',
    description: '時系列・当事者・メール等の証拠リストを構造化する（内容判断は弁護士）',
    category: '法務・契約',
    responsibilityLevel: 'high',
    forbidden: false,
    cautionNote: '証拠リストの構造化のみです。内容判断は弁護士にご確認ください。',
  
    archetype: 'master_data',
  },
  {
    id: 'legal.insider_info_list_update',
    name: 'インサイダー情報管理リストの更新',
    description: '上場企業の重要事実管理台帳の更新を補助する',
    category: '法務・契約',
    responsibilityLevel: 'high',
    forbidden: false,
    cautionNote: '台帳更新の補助のみです。最終判断は専門家にご確認ください。',
  
    archetype: 'master_data',
  },
  {
    id: 'legal.export_control_check',
    name: '輸出管理の該非判定補助',
    description: 'リスト規制該当可能性フラグのみ出力する（最終判断は人間）',
    category: '法務・契約',
    responsibilityLevel: 'high',
    forbidden: false,
    cautionNote: '該当可能性のフラグ付けのみです。最終判断は人間が行ってください。',
  
    archetype: 'compliance_check',
  },

  // 4.3 登記・許認可
  {
    id: 'legal.company_registration_create',
    name: '会社設立登記書類作成',
    description: '[対応不可] 会社設立登記書類の作成は士業独占業務です',
    category: '法務・契約',
    responsibilityLevel: 'high',
    forbidden: true,
    forbiddenLaw: '司法書士法第73条',
  
    archetype: 'forbidden',
  },
  {
    id: 'legal.permit_application_create',
    name: '各種許認可申請書作成',
    description: '[対応不可] 各種許認可申請書の作成は士業独占業務です',
    category: '法務・契約',
    responsibilityLevel: 'high',
    forbidden: true,
    forbiddenLaw: '行政書士法第1条の2',
  
    archetype: 'forbidden',
  },
  {
    id: 'legal.registry_extract_organize',
    name: '登記簿の記載内容の読み取り・整理',
    description: '既存登記簿を構造化するのみ（申請書作成はしない）',
    category: '法務・契約',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'data_extract',
  },

  // ─────────────────────────────────────────────────────────
  // 5. 営業事務
  // ─────────────────────────────────────────────────────────

  // 5.1 見積・受注
  {
    id: 'sales.proposal_draft',
    name: '提案書（企画書）下書き生成',
    description: '顧客ヒアリングから提案書雛形を生成する',
    category: '営業事務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'sales.order_acceptance_issue',
    name: '注文請書の発行',
    description: '発注書を受けて注文請書を自動生成し条件不一致を検出する',
    category: '営業事務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'sales.order_condition_check',
    name: '受注条件チェック',
    description: '契約条件・支払条件・納期の整合を検証する',
    category: '営業事務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'document_check',
  },
  {
    id: 'sales.rfp_summary',
    name: 'RFP（提案依頼書）の要点抽出',
    description: '長文RFPを要件一覧に構造化する',
    category: '営業事務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'sales.hearing_sheet_create',
    name: '顧客ヒアリングシートの自動作成',
    description: '業種・商材別のヒアリング項目を自動生成する',
    category: '営業事務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_create',
  },

  // 5.2 顧客対応
  {
    id: 'sales.sales_email_draft',
    name: '営業メールの下書き',
    description: '用途別テンプレからの営業メールドラフトを作成する',
    category: '営業事務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'sales.complaint_email_draft',
    name: 'クレーム対応メール下書き',
    description: '言葉選びに注意したクレーム対応メールの下書きを作成する',
    category: '営業事務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'sales.faq_answer_generate',
    name: 'FAQ回答の生成',
    description: 'よくある問い合わせへの回答を生成する',
    category: '営業事務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'sales.inquiry_classify',
    name: '問い合わせ内容の分類・優先度付け',
    description: 'メール本文から問い合わせの緊急度を判定し分類する',
    category: '営業事務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'sales.competitor_price_summary',
    name: '競合他社の価格動向メモの要約',
    description: '公開情報から競合動向を要約し営業ミーティング素材化する',
    category: '営業事務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'report',
  },

  // 5.3 売掛・債権管理
  {
    id: 'sales.unbilled_check',
    name: '請求漏れチェック',
    description: '受注と請求の突合により未請求を検出する',
    category: '営業事務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'document_check',
  },
  {
    id: 'sales.dunning_letter_draft',
    name: '督促状の下書き',
    description: '支払遅延に対する督促状の下書きを作成する（注意文言必須）',
    category: '営業事務',
    responsibilityLevel: 'high',
    forbidden: false,
    cautionNote: '文面によっては違法取立に触れるリスクがあります。最終確認は弁護士にご確認ください。',
  
    archetype: 'document_create',
  },
  {
    id: 'sales.accounts_receivable_report',
    name: '顧客別売掛残高レポート',
    description: '顧客別の売掛残高をレポート化する',
    category: '営業事務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'report',
  },
  {
    id: 'sales.prospect_follow_list',
    name: '見込み客のフォローリスト生成',
    description: '商談ステータスから次アクション必要リストを生成する',
    category: '営業事務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'reminder',
  },

  // 5.4 顧客マスタ
  {
    id: 'sales.business_card_digitize',
    name: '名刺データのデータ化',
    description: '名刺をOCRでデータ化する',
    category: '営業事務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'sales.customer_master_dedup',
    name: '取引先マスタの重複検出',
    description: '表記ゆれ・住所ゆれの正規化で取引先マスタの重複を検出する',
    category: '営業事務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'master_data',
  },
  {
    id: 'sales.credit_info_summary',
    name: '与信情報の要約整理',
    description: '与信情報を要約・整理する（与信判断そのものは行わない）',
    category: '営業事務',
    responsibilityLevel: 'medium',
    forbidden: false,
    cautionNote: '情報の要約のみです。与信判断そのものは行いません。',
  
    archetype: 'data_extract',
  },
  {
    id: 'sales.deal_record_crm_assist',
    name: '商談記録のCRM入力補助',
    description: 'メール・議事録から商談ログをCRMフォーマットに整形する',
    category: '営業事務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'sales.promo_material_inventory',
    name: '販促資料の在庫管理・発注リマインド',
    description: 'カタログ・パンフレットの在庫閾値を監視しリマインドする',
    category: '営業事務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'reminder',
  },

  // ─────────────────────────────────────────────────────────
  // 6. 情シス・IT事務
  // ─────────────────────────────────────────────────────────

  // 6.1 資産管理
  {
    id: 'it.device_lending_ledger',
    name: 'PC・デバイス貸与台帳の管理',
    description: 'PC・デバイスの貸与・返却履歴を追跡・管理する',
    category: '情シス・IT事務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'master_data',
  },
  {
    id: 'it.software_license_audit',
    name: 'ソフトウェアライセンス棚卸',
    description: 'ソフトウェアライセンスの棚卸を行いコンプライアンスを確認する',
    category: '情シス・IT事務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'master_data',
  },
  {
    id: 'it.saas_duplicate_detect',
    name: 'SaaS契約の重複・未使用検出',
    description: 'SaaS契約の重複や未使用を検出しコスト削減を提案する',
    category: '情シス・IT事務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'master_data',
  },
  {
    id: 'it.device_disposal_checklist',
    name: 'IT機器の廃棄手続きチェックリスト',
    description: 'データ消去・廃棄証明書・資産台帳からの除却をチェックする',
    category: '情シス・IT事務',
    responsibilityLevel: 'medium',
    forbidden: false,
    cautionNote: 'データ消去の完全性は人間が確認してください。',
  
    archetype: 'checklist',
  },
  {
    id: 'it.software_update_status',
    name: 'ソフトウェアアップデートの適用状況一覧',
    description: '各端末のパッチ適用状況を可視化する',
    category: '情シス・IT事務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'report',
  },

  // 6.2 アカウント・権限管理
  {
    id: 'it.account_provision_format',
    name: 'アカウント発行依頼の受付・整形',
    description: 'アカウント発行依頼を受付・整形する',
    category: '情シス・IT事務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'it.offboarding_account_delete',
    name: '退職者アカウント削除チェックリスト',
    description: '退職者のSaaS・オンプレ・VPN等のアカウント削除を一括リスト化する',
    category: '情シス・IT事務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'checklist',
  },
  {
    id: 'it.access_permission_review',
    name: 'アクセス権限レビュー',
    description: '役職・部門・プロジェクト参加状況から過剰権限を検出する',
    category: '情シス・IT事務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'master_data',
  },
  {
    id: 'it.password_policy_alert',
    name: 'パスワードポリシー違反の警告',
    description: 'パスワードの長さ・複雑性・有効期限のポリシー違反を検出する',
    category: '情シス・IT事務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'document_check',
  },
  {
    id: 'it.vpn_access_log_review',
    name: 'VPN・リモートアクセスのログ確認依頼',
    description: '異常アクセスの月次レビュー依頼文を生成する',
    category: '情シス・IT事務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_create',
  },

  // 6.3 情シス問い合わせ対応
  {
    id: 'it.internal_support_draft',
    name: '社内IT問い合わせの一次対応下書き',
    description: '社内IT問い合わせへの一次対応文面を下書きする',
    category: '情シス・IT事務',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'it.incident_report_draft',
    name: '障害報告書の下書き',
    description: '時系列・影響範囲・原因仮説を構造化した障害報告書を作成する',
    category: '情シス・IT事務',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'it.security_incident_checklist',
    name: 'セキュリティインシデント初動チェックリスト',
    description: 'セキュリティインシデント発生時の初動チェックリストを生成する',
    category: '情シス・IT事務',
    responsibilityLevel: 'high',
    forbidden: false,
    cautionNote: '法令報告要否の判断は専門家にご確認ください。',
  
    archetype: 'checklist',
  },
  {
    id: 'it.backup_confirmation_report',
    name: 'バックアップ実施確認レポート',
    description: '各システムのバックアップ成功ログを集約しレポート化する',
    category: '情シス・IT事務',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'report',
  },

  // ─────────────────────────────────────────────────────────
  // 7. 経営企画・レポーティング
  // ─────────────────────────────────────────────────────────

  // 7.1 レポート作成
  {
    id: 'management.monthly_sales_report',
    name: '月次売上レポートの下書き',
    description: '数値とコメントを統合した月次売上レポートの下書きを作成する',
    category: '経営企画・レポーティング',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'report',
  },
  {
    id: 'management.kpi_dashboard_narrative',
    name: 'KPIダッシュボード説明文の生成',
    description: 'KPI数値変動に対する定性説明文を生成する',
    category: '経営企画・レポーティング',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'report',
  },
  {
    id: 'management.weekly_progress_report',
    name: '週次進捗レポート統合',
    description: '各チームの報告を集約した週次進捗レポートを作成する',
    category: '経営企画・レポーティング',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'report',
  },
  {
    id: 'management.board_meeting_material',
    name: '取締役会資料の下書き',
    description: '経営判断材料となる取締役会資料の下書きを作成する',
    category: '経営企画・レポーティング',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'report',
  },
  {
    id: 'management.survey_result_aggregate',
    name: 'アンケート結果の集計・可視化',
    description: '自由記述の分類タグ付けと定量項目のグラフ化を行う',
    category: '経営企画・レポーティング',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'management.news_clipping_summary',
    name: '業界紙・ニュースのクリッピング要約',
    description: '指定キーワードの記事を日次・週次で要約配信する',
    category: '経営企画・レポーティング',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'data_extract',
  },

  // 7.2 予算・計画
  {
    id: 'management.budget_variance_summary',
    name: '予算実績差異の要約',
    description: '予算と実績の差異要因の初期仮説を提示する',
    category: '経営企画・レポーティング',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'report',
  },
  {
    id: 'management.business_plan_draft',
    name: '事業計画書の下書き（社内用）',
    description: '社内用の事業計画書の下書きを作成する（投資家向けは注意）',
    category: '経営企画・レポーティング',
    responsibilityLevel: 'medium',
    forbidden: false,
    cautionNote: '金融機関・投資家向けは投資助言リスクに注意してください。社内用途に限定してください。',
  
    archetype: 'report',
  },
  {
    id: 'management.investment_advice',
    name: '投資助言・個別推奨',
    description: '[対応不可] 投資助言・個別銘柄推奨は士業独占業務です',
    category: '経営企画・レポーティング',
    responsibilityLevel: 'high',
    forbidden: true,
    forbiddenLaw: '金融商品取引法第29条',
  
    archetype: 'forbidden',
  },
  {
    id: 'management.mid_term_plan_tracking',
    name: '中期経営計画の進捗トラッキング',
    description: 'マイルストーン達成度と未達要因を構造化する',
    category: '経営企画・レポーティング',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'report',
  },

  // 7.3 社外報告
  {
    id: 'management.shareholder_meeting_notice',
    name: '株主総会招集通知の下書き',
    description: '株主総会招集通知の下書きを作成する（会社法定記載事項は司法書士確認必須）',
    category: '経営企画・レポーティング',
    responsibilityLevel: 'high',
    forbidden: false,
    cautionNote: '会社法定記載事項は司法書士にご確認ください。',
  
    archetype: 'compliance_check',
  },
  {
    id: 'management.press_release_draft',
    name: 'プレスリリース下書き',
    description: 'プレスリリースの下書きを作成する',
    category: '経営企画・レポーティング',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'management.risk_register_update',
    name: 'リスク管理台帳の更新補助',
    description: '事業・財務・法務リスクの台帳更新を補助する（判断は人間）',
    category: '経営企画・レポーティング',
    responsibilityLevel: 'high',
    forbidden: false,
    cautionNote: 'リスク評価の判断は人間が行ってください。',
  
    archetype: 'master_data',
  },
  {
    id: 'management.esg_data_collection',
    name: 'ESGレポートのデータ収集補助',
    description: 'ESG開示項目に必要な各部門データの収集・集約を補助する',
    category: '経営企画・レポーティング',
    responsibilityLevel: 'medium',
    forbidden: false,
    cautionNote: '開示内容の判断は専門家にご確認ください。',
  
    archetype: 'data_extract',
  },

  // ─────────────────────────────────────────────────────────
  // 付録B: 申請・承認フロー横断ツール群
  // ─────────────────────────────────────────────────────────
  {
    id: 'workflow.application_status_track',
    name: '申請書のステータス追跡',
    description: '稟議・経費・発注申請の停滞箇所を可視化し催促タイミングを検出する',
    category: '申請・承認フロー',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'master_data',
  },
  {
    id: 'workflow.approver_reminder_draft',
    name: '承認者へのリマインダー下書き',
    description: '承認保留が3日経過した申請に対し催促メール下書きを自動生成する',
    category: '申請・承認フロー',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'workflow.rejection_reason_structure',
    name: '差し戻し理由の構造化',
    description: '承認者の短文コメントを該当行・期待値・根拠・修正点に構造化する',
    category: '申請・承認フロー',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'workflow.approval_template_suggest',
    name: '稟議書テンプレート選択支援',
    description: '過去の類似稟議からテンプレートを提案し通過率の高い構成を参考表示する',
    category: '申請・承認フロー',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'workflow.approval_route_suggest',
    name: '承認ルート提案',
    description: '金額・部門・案件種別から必要な承認者チェーンを提示する（最終承認は人間）',
    category: '申請・承認フロー',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'data_extract',
  },

  // ─────────────────────────────────────────────────────────
  // 付録C: ライフサイクル終端処理
  // ─────────────────────────────────────────────────────────
  {
    id: 'lifecycle.contract_end_document_return',
    name: '契約終了時の書類返却チェック',
    description: '契約終了時の貸与資料・書類・データの返却漏れを検出し台帳化する',
    category: 'ライフサイクル終端処理',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'checklist',
  },
  {
    id: 'lifecycle.offboarding_account_workflow',
    name: '退職者アカウント削除ワークフロー',
    description: '各種SaaS・オンプレ・VPN・ICカードの削除を一括リスト化し完了記録する',
    category: 'ライフサイクル終端処理',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'checklist',
  },
  {
    id: 'lifecycle.project_archive_instruction',
    name: 'プロジェクト終了後の資料アーカイブ指示',
    description: 'ドキュメントの保存場所・保管期間・削除期限を構造化し通知する',
    category: 'ライフサイクル終端処理',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'checklist',
  },
  {
    id: 'lifecycle.lease_device_return_checklist',
    name: 'リース機器の返却チェックリスト',
    description: 'リース契約満了時のデータ消去・付属品・備品チェックリストを生成する',
    category: 'ライフサイクル終端処理',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'checklist',
  },
  {
    id: 'lifecycle.leave_access_suspend_restore',
    name: '長期休職者のアクセス一時停止・復帰手続き',
    description: '休職時のアカウント一時停止と復帰時の再有効化を管理する',
    category: 'ライフサイクル終端処理',
    responsibilityLevel: 'high',
    forbidden: false,
  
    archetype: 'checklist',
  },

  // ─────────────────────────────────────────────────────────
  // 付録D: 物理書類デジタル化補助
  // ─────────────────────────────────────────────────────────
  {
    id: 'digitization.envelope_address_assist',
    name: '封筒の宛名書き補助',
    description: 'CSVから宛名ラベルを生成し敬称・役職を自動付与する',
    category: '物理書類デジタル化補助',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'document_create',
  },
  {
    id: 'digitization.stamp_location_mark',
    name: '押印箇所の指摘',
    description: 'PDF上で社印・代表印・割印の押印箇所をマーキングする',
    category: '物理書類デジタル化補助',
    responsibilityLevel: 'medium',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'digitization.fax_list_manage',
    name: 'FAX送信リストの管理',
    description: 'FAX送付先・送付日・送信結果の記録を管理する',
    category: '物理書類デジタル化補助',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'master_data',
  },
  {
    id: 'digitization.scan_filename_generate',
    name: '紙書類のスキャン時のファイル名自動生成',
    description: 'スキャン画像からOCRで日付・文書種別・取引先名を抽出しファイル名化する',
    category: '物理書類デジタル化補助',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'data_extract',
  },
  {
    id: 'digitization.mail_ledger_create',
    name: '郵送台帳の作成',
    description: '送付先・送付日・書留番号・追跡番号の記録を補助する',
    category: '物理書類デジタル化補助',
    responsibilityLevel: 'low',
    forbidden: false,
  
    archetype: 'master_data',
  },
];
