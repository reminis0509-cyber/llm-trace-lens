/**
 * Archetype definitions for office task patterns.
 *
 * Instead of building 130+ individual implementations, tasks are grouped
 * into archetypes (structural patterns). Each archetype provides:
 *   - Structured input/output field definitions
 *   - Validation rules applied before LLM invocation
 *   - Path to a specialised prompt template
 *
 * Individual tasks map to one archetype and may add task-specific fields,
 * validation rules, and domain knowledge.
 */

// ── Type definitions ────────────────────────────────────────────────

export type ArchetypeId =
  | 'document_create'
  | 'document_check'
  | 'checklist'
  | 'data_extract'
  | 'report'
  | 'compliance_check'
  | 'reminder'
  | 'master_data'
  | 'forbidden';

export interface ArchetypeField {
  name: string;
  /** Japanese label shown in the UI / schema description */
  label: string;
  /** 'text' = long string (textarea), 'array' = JSON array */
  type: 'string' | 'number' | 'boolean' | 'array' | 'text';
  required: boolean;
  description?: string;
  placeholder?: string;
}

export interface ValidationRule {
  field: string;
  rule:
    | 'required'
    | 'positive_number'
    | 'date_format'
    | 'not_empty_array'
    | 'max_length'
    | 'min_length';
  message: string;
  params?: Record<string, unknown>;
}

export interface ArchetypeDefinition {
  id: ArchetypeId;
  /** Fields that appear in the input schema for tasks of this archetype */
  inputFields: ArchetypeField[];
  /** Fields that appear in the structured output */
  outputFields: ArchetypeField[];
  /** Validation rules applied before LLM call */
  validationRules: ValidationRule[];
  /** Relative path under src/prompts/tools/office-task/ */
  promptTemplate: string;
}

// ── Archetype definitions ───────────────────────────────────────────

const documentCreate: ArchetypeDefinition = {
  id: 'document_create',
  inputFields: [
    { name: 'title', label: 'タイトル', type: 'string', required: true, placeholder: '○○見積書' },
    { name: 'recipient', label: '宛先', type: 'string', required: false, placeholder: '株式会社○○ 御中' },
    { name: 'items', label: '明細', type: 'array', required: false, description: '配列 [{name, quantity, unit_price, description}]' },
    { name: 'notes', label: '備考', type: 'text', required: false },
    { name: 'deadline', label: '期限', type: 'string', required: false, placeholder: '2026-05-01' },
    { name: 'purpose', label: '目的・背景', type: 'text', required: false },
  ],
  outputFields: [
    { name: 'document', label: '作成文書', type: 'text', required: true },
    { name: 'summary', label: '概要', type: 'string', required: true },
    { name: 'warnings', label: '注意事項', type: 'array', required: false },
  ],
  validationRules: [
    { field: 'title', rule: 'required', message: 'タイトルは必須です' },
  ],
  promptTemplate: 'document-create.md',
};

const documentCheck: ArchetypeDefinition = {
  id: 'document_check',
  inputFields: [
    { name: 'document_text', label: '書類内容', type: 'text', required: true, placeholder: '書類の全文を貼り付けてください' },
    { name: 'document_type', label: '書類種別', type: 'string', required: false, placeholder: '請求書' },
    { name: 'check_focus', label: 'チェック重点', type: 'string', required: false, placeholder: '算術チェック' },
    { name: 'reference_data', label: '参考データ', type: 'text', required: false, description: '比較元のデータがあれば貼り付けてください' },
  ],
  outputFields: [
    { name: 'status', label: '判定', type: 'string', required: true, description: '"ok" | "warning" | "error"' },
    { name: 'critical_issues', label: '重大問題', type: 'array', required: false, description: '[{field, severity, message}]' },
    { name: 'warnings', label: '警告', type: 'array', required: false },
    { name: 'suggestions', label: '提案', type: 'array', required: false },
  ],
  validationRules: [
    { field: 'document_text', rule: 'required', message: '書類内容は必須です' },
    { field: 'document_text', rule: 'min_length', message: '書類内容が短すぎます（10文字以上）', params: { min: 10 } },
  ],
  promptTemplate: 'document-check.md',
};

const checklist: ArchetypeDefinition = {
  id: 'checklist',
  inputFields: [
    { name: 'context', label: '状況説明', type: 'text', required: true, placeholder: '新入社員（正社員）の入社手続きに必要な書類を洗い出したい' },
    { name: 'category', label: 'カテゴリ', type: 'string', required: false, placeholder: '入社手続き' },
    { name: 'role', label: '対象者の役割', type: 'string', required: false, placeholder: '正社員' },
    { name: 'department', label: '部門', type: 'string', required: false },
  ],
  outputFields: [
    { name: 'checklist', label: 'チェックリスト', type: 'array', required: true, description: '[{category, items: [{item, required, notes, deadline}]}]' },
    { name: 'total_items', label: '合計項目数', type: 'number', required: true },
  ],
  validationRules: [
    { field: 'context', rule: 'required', message: '状況説明は必須です' },
  ],
  promptTemplate: 'checklist.md',
};

const dataExtract: ArchetypeDefinition = {
  id: 'data_extract',
  inputFields: [
    { name: 'source_text', label: '元テキスト', type: 'text', required: true, placeholder: 'データを貼り付けてください' },
    { name: 'extract_type', label: '抽出対象', type: 'string', required: false, placeholder: '要点' },
    { name: 'output_format', label: '出力形式', type: 'string', required: false, placeholder: 'テーブル形式' },
  ],
  outputFields: [
    { name: 'extracted', label: '抽出結果', type: 'text', required: true },
    { name: 'confidence', label: '信頼度', type: 'string', required: false, description: '"high" | "medium" | "low"' },
    { name: 'missing_info', label: '不足情報', type: 'array', required: false },
  ],
  validationRules: [
    { field: 'source_text', rule: 'required', message: '元テキストは必須です' },
    { field: 'source_text', rule: 'min_length', message: '元テキストが短すぎます（20文字以上）', params: { min: 20 } },
  ],
  promptTemplate: 'data-extract.md',
};

const report: ArchetypeDefinition = {
  id: 'report',
  inputFields: [
    { name: 'data', label: 'データ・数値', type: 'text', required: true, placeholder: '売上データ・KPI数値等を貼り付けてください' },
    { name: 'report_type', label: 'レポート種別', type: 'string', required: false, placeholder: '月次売上レポート' },
    { name: 'period', label: '対象期間', type: 'string', required: false, placeholder: '2026年3月' },
    { name: 'audience', label: '読者', type: 'string', required: false, placeholder: '経営陣' },
  ],
  outputFields: [
    { name: 'report', label: 'レポート本文', type: 'text', required: true },
    { name: 'key_findings', label: '主要な発見', type: 'array', required: false },
    { name: 'recommendations', label: '推奨事項', type: 'array', required: false },
  ],
  validationRules: [
    { field: 'data', rule: 'required', message: 'データ・数値は必須です' },
  ],
  promptTemplate: 'report.md',
};

const complianceCheck: ArchetypeDefinition = {
  id: 'compliance_check',
  inputFields: [
    { name: 'document_text', label: '書類内容', type: 'text', required: true, placeholder: '検査対象の書類内容を貼り付けてください' },
    { name: 'regulation', label: '対象法令・規制', type: 'string', required: true, placeholder: '下請法' },
    { name: 'check_items', label: 'チェック項目', type: 'text', required: false, description: '特にチェックしたい項目があれば記載' },
  ],
  outputFields: [
    { name: 'compliance_status', label: '準拠判定', type: 'string', required: true, description: '"compliant" | "non_compliant" | "needs_review"' },
    { name: 'findings', label: '検出事項', type: 'array', required: true, description: '[{item, status, regulation_ref, detail}]' },
    { name: 'expert_review_required', label: '専門家確認要否', type: 'boolean', required: true },
    { name: 'disclaimer', label: '免責事項', type: 'string', required: true },
  ],
  validationRules: [
    { field: 'document_text', rule: 'required', message: '書類内容は必須です' },
    { field: 'regulation', rule: 'required', message: '対象法令・規制の指定は必須です' },
  ],
  promptTemplate: 'compliance-check.md',
};

const reminder: ArchetypeDefinition = {
  id: 'reminder',
  inputFields: [
    { name: 'items', label: '管理対象', type: 'text', required: true, placeholder: '管理したい項目を記載してください' },
    { name: 'deadlines', label: '期限情報', type: 'text', required: false },
    { name: 'priority', label: '優先度', type: 'string', required: false, placeholder: '高' },
  ],
  outputFields: [
    { name: 'reminders', label: 'リマインダー一覧', type: 'array', required: true, description: '[{item, deadline, priority, action_required, notes}]' },
    { name: 'overdue', label: '期限超過', type: 'array', required: false },
  ],
  validationRules: [
    { field: 'items', rule: 'required', message: '管理対象は必須です' },
  ],
  promptTemplate: 'reminder.md',
};

const masterData: ArchetypeDefinition = {
  id: 'master_data',
  inputFields: [
    { name: 'data_set', label: 'データセット', type: 'text', required: true, placeholder: '分析対象のデータを貼り付けてください' },
    { name: 'operation', label: '操作種別', type: 'string', required: false, description: '"dedup" | "audit" | "reconcile"' },
    { name: 'reference_data', label: '参照データ', type: 'text', required: false },
  ],
  outputFields: [
    { name: 'findings', label: '検出結果', type: 'array', required: true, description: '[{type, detail, severity}]' },
    { name: 'summary', label: '概要', type: 'string', required: true },
    { name: 'action_items', label: 'アクション項目', type: 'array', required: false },
  ],
  validationRules: [
    { field: 'data_set', rule: 'required', message: 'データセットは必須です' },
  ],
  promptTemplate: 'master-data.md',
};

const forbidden: ArchetypeDefinition = {
  id: 'forbidden',
  inputFields: [],
  outputFields: [],
  validationRules: [],
  promptTemplate: '',
};

// ── Registry ────────────────────────────────────────────────────────

export const archetypeDefinitions: ReadonlyMap<ArchetypeId, ArchetypeDefinition> = new Map([
  ['document_create', documentCreate],
  ['document_check', documentCheck],
  ['checklist', checklist],
  ['data_extract', dataExtract],
  ['report', report],
  ['compliance_check', complianceCheck],
  ['reminder', reminder],
  ['master_data', masterData],
  ['forbidden', forbidden],
]);

/**
 * Look up an archetype definition by id.
 * Throws if the id is not registered (programming error).
 */
export function getArchetype(id: ArchetypeId): ArchetypeDefinition {
  const def = archetypeDefinitions.get(id);
  if (!def) {
    throw new Error(`Unknown archetype: ${id}`);
  }
  return def;
}
