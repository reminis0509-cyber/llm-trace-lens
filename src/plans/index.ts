/**
 * Plan Management
 * 5プラン体系: Free / Pro / Team / Max / Enterprise
 *
 * 価格体系は Founder 承認済み (2026-04-20):
 *   - Free    ¥0        個人/試用
 *   - Pro     ¥3,000    個人/SOHO
 *   - Team    ¥6,000/seat (最低2席 = ¥12,000)  中小企業 5-20名
 *   - Max     ¥15,000   パワーユーザー
 *   - Enterprise ¥50,000〜  大企業/稟議対応
 *
 * 金額は全て JPY (整数円). 浮動小数は使用しない.
 */

// ===========================
// プラン定義
// ===========================

export type PlanType = 'free' | 'pro' | 'team' | 'max' | 'enterprise';

/**
 * 5プランの列挙順 (UI / iteration 用の標準順序)
 */
export const PLAN_ORDER: readonly PlanType[] = ['free', 'pro', 'team', 'max', 'enterprise'] as const;

/**
 * Team プランの最低席数 (¥6,000/seat × 2 = ¥12,000 が実質最低月額)
 */
export const TEAM_MIN_SEATS = 2;

/**
 * Team プランの 1 席あたり月額 (JPY 税抜)
 */
export const TEAM_PRICE_PER_SEAT = 6000;

/**
 * Enterprise の下限月額 (JPY 税抜, 契約は個別交渉)
 */
export const ENTERPRISE_MIN_PRICE_MONTHLY = 50000;

export interface PlanLimits {
  /** 月間トレース数上限 (Pro/Team/Max/Enterprise 用。Free プランでは未使用: -1) */
  monthlyTraces: number;
  /** 日次トレース数上限 (Free プラン用。有料プランでは未使用: -1) */
  dailyTraces: number;
  /** ワークスペース数上限 */
  maxWorkspaces: number;
  /** メンバー数上限 (-1 = unlimited) */
  maxMembers: number;
  /** データ保持日数 */
  retentionDays: number;
  /** カスタムバリデーションルール */
  customRules: boolean;
  /** カスタム PII ルール上限数 (-1 = unlimited) */
  customPiiRuleLimit: number;
  /** LLM-as-Judge 月間評価回数 */
  monthlyEvaluations: number;
  /** SSO 対応 */
  sso: boolean;
  /** SLA 保証 (%, null = 保証なし) */
  sla: number | null;
  /** 優先サポート */
  prioritySupport: boolean;
  /** シート課金プランか (true = Team のように席数に応じて課金) */
  perSeat: boolean;
}

export interface PlanDefinition {
  type: PlanType;
  name: string;
  nameJa: string;
  /**
   * 月額 (JPY 税抜, 整数).
   * - Free: 0
   * - Pro / Max: 固定月額
   * - Team: 1 席あたりの単価 (実際の請求は seats × priceMonthly, 最低 TEAM_MIN_SEATS)
   * - Enterprise: ENTERPRISE_MIN_PRICE_MONTHLY (下限値, 契約は個別交渉 → 実際の金額は customLimits / subscription で管理)
   */
  priceMonthly: number;
  /** 個別見積かどうか (true = 実価格は契約ごとに決定, 表示上は「〜」付き) */
  customQuote: boolean;
  limits: PlanLimits;
}

/**
 * プラン定義マスタ
 *
 * limit 値決定の根拠:
 * - Free / Pro / Max は既存運用の継続 (2026-04-16 Claude 式 3 プラン決定の踏襲)
 * - Team は Pro の「中小企業拡張版」として, Pro × 5 人分程度のリソースを割り当て
 *   (monthlyTraces: Pro 50K × 5 = 250K, monthlyEvaluations: Pro 1K × 5 = 5K)
 * - Enterprise は Max の 3〜5 倍を基準に, unlimited 寄りの構成
 */
export const PLANS: Record<PlanType, PlanDefinition> = {
  free: {
    type: 'free',
    name: 'Free',
    nameJa: 'フリー',
    priceMonthly: 0,
    customQuote: false,
    limits: {
      monthlyTraces: -1,
      dailyTraces: 30,
      maxWorkspaces: 1,
      maxMembers: 2,
      retentionDays: 7,
      customRules: false,
      customPiiRuleLimit: 0,
      monthlyEvaluations: 0,
      sso: false,
      sla: null,
      prioritySupport: false,
      perSeat: false,
    },
  },
  pro: {
    type: 'pro',
    name: 'Pro',
    nameJa: 'プロ',
    priceMonthly: 3000,
    customQuote: false,
    limits: {
      monthlyTraces: 50000,
      dailyTraces: -1,
      maxWorkspaces: 3,
      maxMembers: 3,
      retentionDays: 90,
      customRules: true,
      customPiiRuleLimit: 5,
      monthlyEvaluations: 1000,
      sso: false,
      sla: null,
      prioritySupport: false,
      perSeat: false,
    },
  },
  team: {
    type: 'team',
    name: 'Team',
    nameJa: 'チーム',
    priceMonthly: TEAM_PRICE_PER_SEAT, // per seat. 実請求は seats × 6000, 最低 TEAM_MIN_SEATS seats.
    customQuote: false,
    limits: {
      monthlyTraces: 250000,
      dailyTraces: -1,
      maxWorkspaces: 5,
      maxMembers: 20,
      retentionDays: 180,
      customRules: true,
      customPiiRuleLimit: 15,
      monthlyEvaluations: 5000,
      sso: false,
      sla: 99.5,
      prioritySupport: false,
      perSeat: true,
    },
  },
  max: {
    type: 'max',
    name: 'Max',
    nameJa: 'マックス',
    priceMonthly: 15000,
    customQuote: false,
    limits: {
      monthlyTraces: 500000,
      dailyTraces: -1,
      maxWorkspaces: 10,
      maxMembers: 10,
      retentionDays: 365,
      customRules: true,
      customPiiRuleLimit: 30,
      monthlyEvaluations: 15000,
      sso: false,
      sla: 99.9,
      prioritySupport: true,
      perSeat: false,
    },
  },
  enterprise: {
    type: 'enterprise',
    name: 'Enterprise',
    nameJa: 'エンタープライズ',
    priceMonthly: ENTERPRISE_MIN_PRICE_MONTHLY, // 下限値. 実契約は個別見積 (customLimits で上書き可).
    customQuote: true,
    limits: {
      monthlyTraces: Infinity,
      dailyTraces: -1,
      maxWorkspaces: Infinity,
      maxMembers: -1,
      retentionDays: 365,
      customRules: true,
      customPiiRuleLimit: -1,
      monthlyEvaluations: Infinity,
      sso: true,
      sla: 99.95,
      prioritySupport: true,
      perSeat: false,
    },
  },
};

/**
 * プランの制限値を取得
 */
export function getPlanLimits(planType: PlanType): PlanLimits {
  return PLANS[planType].limits;
}

/**
 * プラン名を取得（日本語）
 */
export function getPlanNameJa(planType: PlanType): string {
  return PLANS[planType].nameJa;
}

/**
 * 指定された文字列が有効な PlanType かを判定する型ガード
 */
export function isValidPlanType(value: unknown): value is PlanType {
  return typeof value === 'string' && (PLAN_ORDER as readonly string[]).includes(value);
}

/**
 * プラン階段の次に推奨されるアップグレード先を返す.
 * 最上位 (enterprise) の場合は null.
 *
 * アップグレード経路:
 *   free -> pro -> team -> max -> enterprise
 *
 * 備考:
 * - pro/team の利用者が trace 上限超過した場合の「次のプラン提案」に使用
 * - 実際の推奨は利用パターン (人数 / トレース量 / LLM Judge 使用量) で分岐させることも可能
 */
export function getRecommendedUpgrade(planType: PlanType): PlanType | null {
  const idx = PLAN_ORDER.indexOf(planType);
  if (idx < 0) return null;
  const next = PLAN_ORDER[idx + 1];
  return next ?? null;
}

/**
 * Team プランの月額を席数から計算する
 * seats が TEAM_MIN_SEATS 未満の場合は TEAM_MIN_SEATS として扱う
 */
export function calculateTeamMonthlyPrice(seats: number): number {
  const effectiveSeats = Math.max(TEAM_MIN_SEATS, Math.floor(seats));
  return effectiveSeats * TEAM_PRICE_PER_SEAT;
}

// ===========================
// ワークスペースプラン情報
// ===========================

export interface WorkspacePlan {
  workspaceId: string;
  planType: PlanType;
  /** プラン開始日 */
  startedAt: string;
  /** プラン終了日（年間契約の場合） */
  expiresAt?: string;
  /** Stripe 等の課金 ID */
  subscriptionId?: string;
  /** カスタム制限値（Team の実席数 / Enterprise 向けオーバーライド） */
  customLimits?: Partial<PlanLimits>;
  /** Team プランの購入席数 (team プラン時のみ意味を持つ. 未指定時は TEAM_MIN_SEATS) */
  seats?: number;
  /** トライアル開始日 */
  trialStartedAt?: string;
}

/**
 * ワークスペースの実効プラン制限を取得
 * Enterprise のカスタム制限がある場合はそれを優先
 */
export function getEffectiveLimits(plan: WorkspacePlan): PlanLimits {
  const baseLimits = getPlanLimits(plan.planType);
  if (!plan.customLimits) return baseLimits;

  return {
    ...baseLimits,
    ...plan.customLimits,
  };
}
