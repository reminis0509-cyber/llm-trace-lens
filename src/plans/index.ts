/**
 * Plan Management
 * Free / Pro / Enterprise プランの定義と制限管理
 */

// ===========================
// プラン定義
// ===========================

export type PlanType = 'free' | 'pro' | 'enterprise';

export interface PlanLimits {
  /** 月間トレース数上限 */
  monthlyTraces: number;
  /** ワークスペース数上限 */
  maxWorkspaces: number;
  /** メンバー数上限 */
  maxMembers: number;
  /** データ保持日数 */
  retentionDays: number;
  /** カスタムバリデーションルール */
  customRules: boolean;
  /** LLM-as-Judge 月間評価回数 */
  monthlyEvaluations: number;
  /** SSO対応 */
  sso: boolean;
  /** SLA保証 */
  sla: number | null;
  /** 優先サポート */
  prioritySupport: boolean;
}

export interface PlanDefinition {
  type: PlanType;
  name: string;
  nameJa: string;
  priceMonthly: number | null; // null = 個別見積
  limits: PlanLimits;
}

/**
 * プラン定義マスタ
 */
export const PLANS: Record<PlanType, PlanDefinition> = {
  free: {
    type: 'free',
    name: 'Free',
    nameJa: 'フリー',
    priceMonthly: 0,
    limits: {
      monthlyTraces: 5000,
      maxWorkspaces: 1,
      maxMembers: 2,
      retentionDays: 7,
      customRules: false,
      monthlyEvaluations: 0,
      sso: false,
      sla: null,
      prioritySupport: false,
    },
  },
  pro: {
    type: 'pro',
    name: 'Pro',
    nameJa: 'プロ',
    priceMonthly: 9800,
    limits: {
      monthlyTraces: 50000,
      maxWorkspaces: 3,
      maxMembers: 10,
      retentionDays: 90,
      customRules: true,
      monthlyEvaluations: 1000,
      sso: false,
      sla: 99.5,
      prioritySupport: false,
    },
  },
  enterprise: {
    type: 'enterprise',
    name: 'Enterprise',
    nameJa: 'エンタープライズ',
    priceMonthly: null,
    limits: {
      monthlyTraces: Infinity,
      maxWorkspaces: Infinity,
      maxMembers: Infinity,
      retentionDays: 365,
      customRules: true,
      monthlyEvaluations: Infinity,
      sso: true,
      sla: 99.9,
      prioritySupport: true,
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
  /** Stripe等の課金ID */
  subscriptionId?: string;
  /** カスタム制限値（Enterprise向けオーバーライド） */
  customLimits?: Partial<PlanLimits>;
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
