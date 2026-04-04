import { useState, useEffect } from 'react';
import { CreditCard, Database, Users, Shield, Clock, CheckCircle2, ArrowUpRight, Mail, Settings, Loader2, AlertTriangle, Calendar, RefreshCw } from 'lucide-react';
import { billingApi, type BillingStatus } from '../api/billing';
import type { DailyUsage, MonthlyUsage } from '../api/client';

interface PlanLimits {
  monthlyTraces: number;
  dailyTraces: number;
  maxWorkspaces: number;
  maxMembers: number;
  retentionDays: number;
  customRules: boolean;
  monthlyEvaluations: number;
  sso: boolean;
  sla: number | null;
  prioritySupport: boolean;
}

interface PlanDefinition {
  type: string;
  name: string;
  priceMonthly: number | null;
  limits: PlanLimits;
}

interface PlanInfo {
  plan: {
    workspaceId?: string;
    planType?: string;
    type?: string;
    startedAt: string;
    expiresAt?: string;
  };
  limits: PlanLimits;
  usage: {
    traceCount: number;
    traceLimit: number;
    tracePercentage: number;
    evaluationCount: number;
    evaluationLimit: number;
    month: string;
    daily?: DailyUsage;
    monthly?: MonthlyUsage;
  };
}

const API_BASE = '';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import('../lib/supabase');
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.user) {
    headers['X-User-ID'] = session.user.id;
    headers['X-User-Email'] = session.user.email || '';
  }
  return headers;
}

function formatNumber(n: number | null | undefined): string {
  if (n == null || n === Infinity || n >= 999999999 || n === -1) return '\u7121\u5236\u9650';
  return n.toLocaleString('ja-JP');
}

function getUsageColor(percentage: number): string {
  if (percentage >= 90) return 'bg-status-fail';
  if (percentage >= 70) return 'bg-status-warn';
  return 'bg-status-pass';
}

function getUsageTextColor(percentage: number): string {
  if (percentage >= 90) return 'text-status-fail';
  if (percentage >= 70) return 'text-status-warn';
  return 'text-status-pass';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

type PlanStatus = 'trial' | 'paid' | 'expired' | 'free';

function computePlanStatus(planType: string, expiresAt?: string, subscriptionId?: string): PlanStatus {
  if (planType === 'free') return 'free';
  if (expiresAt) {
    const remaining = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (remaining <= 0) return 'expired';
    if (!subscriptionId) return 'trial';
  }
  if (planType === 'pro' || planType === 'enterprise') return 'paid';
  return 'free';
}

function getTrialRemainingDays(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getTrialProgressPercent(startedAt: string, expiresAt: string): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(expiresAt).getTime();
  const now = Date.now();
  const total = end - start;
  if (total <= 0) return 100;
  const elapsed = now - start;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

function getPlanLabel(planType: string): string {
  const labels: Record<string, string> = {
    'free': 'フリー',
    'pro': 'プロ',
    'enterprise': 'エンタープライズ',
  };
  return labels[planType] || planType;
}

function getPlanBadgeColor(planType: string): string {
  switch (planType) {
    case 'enterprise': return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
    case 'pro': return 'bg-accent/20 text-accent border-accent/30';
    default: return 'bg-base-elevated text-text-muted border-border';
  }
}

export function PlanUsage() {
  const [currentPlan, setCurrentPlan] = useState<PlanInfo | null>(null);
  const [allPlans, setAllPlans] = useState<PlanDefinition[]>([]);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [managingBilling, setManagingBilling] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const headers = await getAuthHeaders();

        const [planRes, plansRes, billing] = await Promise.all([
          fetch(`${API_BASE}/api/plan`, { headers, credentials: 'include' }),
          fetch(`${API_BASE}/api/plans`),
          billingApi.getStatus().catch(() => ({ configured: false } as BillingStatus)),
        ]);

        if (!planRes.ok) throw new Error('\u30d7\u30e9\u30f3\u60c5\u5831\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f');
        if (!plansRes.ok) throw new Error('\u30d7\u30e9\u30f3\u4e00\u89a7\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f');

        const [planData, plansData] = await Promise.all([
          planRes.json(),
          plansRes.json(),
        ]);

        setCurrentPlan(planData);
        setAllPlans(plansData.plans || []);
        setBillingStatus(billing);
      } catch (err) {
        setError(err instanceof Error ? err.message : '\u4e0d\u660e\u306a\u30a8\u30e9\u30fc');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const { checkoutUrl } = await billingApi.createCheckout();
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '\u30a2\u30c3\u30d7\u30b0\u30ec\u30fc\u30c9\u306b\u5931\u6557\u3057\u307e\u3057\u305f');
      setUpgrading(false);
    }
  };

  const handleManageBilling = async () => {
    setManagingBilling(true);
    try {
      const { portalUrl } = await billingApi.createPortal();
      if (portalUrl) {
        window.location.href = portalUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '\u8ab2\u91d1\u7ba1\u7406\u30da\u30fc\u30b8\u3092\u958b\u3051\u307e\u305b\u3093\u3067\u3057\u305f');
      setManagingBilling(false);
    }
  };

  const stripeConfigured = billingStatus?.configured === true;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="surface-card p-6 animate-pulse">
          <div className="h-6 bg-base-elevated rounded w-48 mb-4" />
          <div className="h-4 bg-base-elevated rounded w-32" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-lg font-medium text-text-primary">{'\u30d7\u30e9\u30f3'}</h2>
        </div>
        <p className="text-status-warn text-sm">{error}</p>
        <p className="text-xs text-text-muted mt-2">{'\u30da\u30fc\u30b8\u3092\u518d\u8aad\u307f\u8fbc\u307f\u3057\u3066\u304f\u3060\u3055\u3044\u3002\u554f\u984c\u304c\u7d9a\u304f\u5834\u5408\u306f\u30b5\u30dd\u30fc\u30c8\u306b\u304a\u554f\u3044\u5408\u308f\u305b\u304f\u3060\u3055\u3044\u3002'}</p>
      </div>
    );
  }

  if (!currentPlan) return null;

  const { plan: rawPlan, limits, usage } = currentPlan;
  // API returns plan.type, frontend expects plan.planType — normalize
  const plan = { ...rawPlan, planType: rawPlan.planType || rawPlan.type || 'free' };
  const tracePercentage = limits.monthlyTraces === Infinity ? 0 : Math.min(100, (usage.traceCount / limits.monthlyTraces) * 100);
  const evalPercentage = limits.monthlyEvaluations === Infinity ? 0 :
    limits.monthlyEvaluations === 0 ? 0 : Math.min(100, (usage.evaluationCount / limits.monthlyEvaluations) * 100);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Current Plan Card */}
      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-card bg-accent/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-accent" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-medium text-text-primary">{'\u73fe\u5728\u306e\u30d7\u30e9\u30f3'}</h2>
                <span className={`px-2 py-0.5 text-xs rounded border ${getPlanBadgeColor(plan.planType)}`}>
                  {getPlanLabel(plan.planType)}
                </span>
              </div>
              <p className="text-sm text-text-muted">
                {plan.planType === 'free' ? '\u7121\u6599' :
                  plan.planType === 'pro' ? '\u00a59,800 / \u6708' : '\u500b\u5225\u898b\u7a4d'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Free → Pro: Upgrade button */}
            {plan.planType === 'free' && (
              stripeConfigured ? (
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="flex items-center gap-2 px-4 py-2 bg-accent text-base rounded-card text-sm font-medium hover:bg-accent/90 transition-colors duration-120 disabled:opacity-50"
                >
                  {upgrading ? (
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
                  )}
                  {upgrading ? '\u51e6\u7406\u4e2d...' : '\u30d7\u30ed\u306b\u30a2\u30c3\u30d7\u30b0\u30ec\u30fc\u30c9'}
                </button>
              ) : (
                <a
                  href="mailto:contact@fujitrace.com?subject=FujiTrace%20Pro%E3%83%97%E3%83%A9%E3%83%B3%E3%81%AE%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B"
                  className="flex items-center gap-2 px-4 py-2 bg-accent text-base rounded-card text-sm font-medium hover:bg-accent/90 transition-colors duration-120"
                >
                  <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
                  {'\u30a2\u30c3\u30d7\u30b0\u30ec\u30fc\u30c9'}
                </a>
              )
            )}
            {/* Pro: Manage billing + Enterprise inquiry */}
            {plan.planType === 'pro' && (
              <>
                {stripeConfigured && billingStatus?.hasCustomer && (
                  <button
                    onClick={handleManageBilling}
                    disabled={managingBilling}
                    className="flex items-center gap-2 px-4 py-2 border border-border text-text-secondary rounded-card text-sm font-medium hover:text-text-primary hover:bg-base-elevated transition-colors duration-120 disabled:opacity-50"
                  >
                    {managingBilling ? (
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                    ) : (
                      <Settings className="w-4 h-4" strokeWidth={1.5} />
                    )}
                    {'\u30d7\u30e9\u30f3\u3092\u7ba1\u7406'}
                  </button>
                )}
                <a
                  href="mailto:contact@fujitrace.com?subject=FujiTrace%20Enterprise%E3%83%97%E3%83%A9%E3%83%B3%E3%81%AE%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B"
                  className="flex items-center gap-2 px-4 py-2 border border-border text-text-secondary rounded-card text-sm font-medium hover:text-text-primary hover:bg-base-elevated transition-colors duration-120"
                >
                  <Mail className="w-4 h-4" strokeWidth={1.5} />
                  {'\u30a8\u30f3\u30bf\u30fc\u30d7\u30e9\u30a4\u30ba\u76f8\u8ac7'}
                </a>
              </>
            )}
          </div>
        </div>

        {/* Subscription Status */}
        {(() => {
          const subscriptionId = billingStatus?.hasCustomer ? 'active' : undefined;
          const status = computePlanStatus(plan.planType, plan.expiresAt, subscriptionId);
          const remainingDays = plan.expiresAt ? getTrialRemainingDays(plan.expiresAt) : null;
          const trialProgress = (plan.expiresAt && plan.startedAt)
            ? getTrialProgressPercent(plan.startedAt, plan.expiresAt)
            : null;

          return (
            <div className="mb-6 space-y-3">
              {/* Status row with dates */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                {/* Status badge */}
                {status === 'trial' && remainingDays !== null && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border bg-accent/10 text-accent border-accent/30 font-medium">
                    <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                    {'\u30c8\u30e9\u30a4\u30a2\u30eb\u4e2d'}
                    <span className="text-text-muted font-normal ml-1">
                      {'\u6b8b\u308a'}{remainingDays}{'\u65e5'}
                    </span>
                  </span>
                )}
                {status === 'paid' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border bg-status-pass/10 text-status-pass border-status-pass/30 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    {'\u6709\u6599\u5951\u7d04'}
                  </span>
                )}
                {status === 'expired' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border bg-status-fail/10 text-status-fail border-status-fail/30 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} />
                    {'\u671f\u9650\u5207\u308c'}
                  </span>
                )}
                {status === 'free' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border bg-base-elevated text-text-muted border-border font-medium">
                    {'\u7121\u6599\u30d7\u30e9\u30f3'}
                  </span>
                )}

                {/* Key dates */}
                <span className="inline-flex items-center gap-1 text-text-muted">
                  <Calendar className="w-3 h-3" strokeWidth={1.5} />
                  {'\u958b\u59cb\u65e5'}: {formatDate(plan.startedAt)}
                </span>
                {plan.expiresAt && (
                  <span className="inline-flex items-center gap-1 text-text-muted">
                    <Clock className="w-3 h-3" strokeWidth={1.5} />
                    {'\u6709\u52b9\u671f\u9650'}: {formatDate(plan.expiresAt)}
                  </span>
                )}
              </div>

              {/* Trial progress bar */}
              {status === 'trial' && trialProgress !== null && (
                <div>
                  <div className="h-1.5 bg-base-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent/60 transition-all duration-500"
                      style={{ width: `${trialProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-text-muted mt-1 text-right">
                    {'\u30c8\u30e9\u30a4\u30a2\u30eb\u671f\u9593\u306e'}{Math.round(trialProgress)}%{'\u304c\u7d4c\u904e'}
                  </p>
                </div>
              )}

              {/* Trial urgency warnings */}
              {status === 'trial' && remainingDays !== null && remainingDays <= 7 && remainingDays > 3 && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-card bg-status-warn/10 border border-status-warn/20">
                  <AlertTriangle className="w-4 h-4 text-status-warn flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-xs text-status-warn">
                    {'\u30c8\u30e9\u30a4\u30a2\u30eb\u7d42\u4e86\u307e\u3067\u3042\u3068'}{remainingDays}{'\u65e5\u3002\u30d7\u30ed\u30d7\u30e9\u30f3\u3078\u306e\u79fb\u884c\u3092\u3054\u691c\u8a0e\u304f\u3060\u3055\u3044\u3002'}
                  </p>
                </div>
              )}
              {status === 'trial' && remainingDays !== null && remainingDays <= 3 && remainingDays > 0 && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-card bg-status-fail/10 border border-status-fail/20">
                  <AlertTriangle className="w-4 h-4 text-status-fail flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-xs text-status-fail">
                    {'\u30c8\u30e9\u30a4\u30a2\u30eb\u304c\u9593\u3082\u306a\u304f\u7d42\u4e86\u3057\u307e\u3059\u3002'}
                  </p>
                </div>
              )}
              {status === 'expired' && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-card bg-status-fail/10 border border-status-fail/20">
                  <AlertTriangle className="w-4 h-4 text-status-fail flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-xs text-status-fail">
                    {'\u30c8\u30e9\u30a4\u30a2\u30eb\u304c\u7d42\u4e86\u3057\u307e\u3057\u305f\u3002\u7121\u6599\u30d7\u30e9\u30f3\u306b\u79fb\u884c\u3055\u308c\u3066\u3044\u307e\u3059\u3002'}
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Usage Bars */}
        <div className="space-y-4">
          {/* Trace Usage — Daily for Free, Monthly for paid */}
          {plan.planType === 'free' && usage.daily ? (
            (() => {
              const dailyPercentage = usage.daily.dailyLimit > 0
                ? Math.min(100, (usage.daily.dailyUsage / usage.daily.dailyLimit) * 100)
                : 0;
              const dailyLimitReached = usage.daily.dailyUsage >= usage.daily.dailyLimit;
              return (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-text-secondary">本日のトレース</span>
                    <span className={`text-sm font-mono tabular-nums ${getUsageTextColor(dailyPercentage)}`}>
                      {formatNumber(usage.daily.dailyUsage)} / {formatNumber(usage.daily.dailyLimit)}
                    </span>
                  </div>
                  <div className="h-2 bg-base-elevated rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getUsageColor(dailyPercentage)}`}
                      style={{ width: `${Math.max(1, dailyPercentage)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <RefreshCw className="w-3 h-3 text-text-muted" strokeWidth={1.5} />
                    <span className="text-xs text-text-muted">
                      リセット: 明日 0:00 (JST)
                    </span>
                  </div>
                  {dailyLimitReached && (
                    <div className="mt-3 p-3 rounded-card bg-status-fail/10 border border-status-fail/20">
                      <p className="text-xs text-status-fail mb-2">
                        本日の上限に達しました。明日のリセットまでお待ちいただくか、プロプランへのアップグレードで無制限にご利用いただけます。
                      </p>
                      {stripeConfigured ? (
                        <button
                          onClick={handleUpgrade}
                          disabled={upgrading}
                          className="flex items-center gap-2 px-4 py-2 bg-accent text-base rounded-card text-sm font-medium hover:bg-accent/90 transition-colors duration-120 disabled:opacity-50"
                        >
                          {upgrading ? (
                            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
                          )}
                          {upgrading ? '処理中...' : 'プロにアップグレード'}
                        </button>
                      ) : (
                        <a
                          href="mailto:contact@fujitrace.com?subject=FujiTrace%20Pro%E3%83%97%E3%83%A9%E3%83%B3%E3%81%AE%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-base rounded-card text-sm font-medium hover:bg-accent/90 transition-colors duration-120"
                        >
                          <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
                          アップグレード
                        </a>
                      )}
                    </div>
                  )}
                  {!dailyLimitReached && dailyPercentage >= 90 && (
                    <p className="text-xs text-status-fail mt-1">上限に近づいています。アップグレードを検討してください。</p>
                  )}
                </div>
              );
            })()
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-text-secondary">月間トレース</span>
                <span className={`text-sm font-mono tabular-nums ${getUsageTextColor(tracePercentage)}`}>
                  {formatNumber(usage.traceCount)} / {formatNumber(limits.monthlyTraces)}
                </span>
              </div>
              <div className="h-2 bg-base-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getUsageColor(tracePercentage)}`}
                  style={{ width: `${Math.max(1, tracePercentage)}%` }}
                />
              </div>
              {tracePercentage >= 90 && (
                <p className="text-xs text-status-fail mt-1">上限に近づいています。アップグレードを検討してください。</p>
              )}
            </div>
          )}

          {/* Evaluation Usage */}
          {limits.monthlyEvaluations > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-text-secondary">LLM-as-Judge 評価</span>
                <span className={`text-sm font-mono tabular-nums ${getUsageTextColor(evalPercentage)}`}>
                  {formatNumber(usage.evaluationCount)} / {formatNumber(limits.monthlyEvaluations)}
                </span>
              </div>
              <div className="h-2 bg-base-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getUsageColor(evalPercentage)}`}
                  style={{ width: `${Math.max(1, evalPercentage)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Plan Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
          <div className="flex items-start gap-2">
            <Database className="w-4 h-4 text-text-muted mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-xs text-text-muted">{'\u30c7\u30fc\u30bf\u4fdd\u6301'}</p>
              <p className="text-sm text-text-primary font-mono">{limits.retentionDays}{'\u65e5'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 text-text-muted mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-xs text-text-muted">{'\u30e1\u30f3\u30d0\u30fc'}</p>
              <p className="text-sm text-text-primary font-mono">{formatNumber(limits.maxMembers)}{'\u540d'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-text-muted mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-xs text-text-muted">SSO</p>
              <p className="text-sm text-text-primary">{limits.sso ? '\u5bfe\u5fdc' : '\u975e\u5bfe\u5fdc'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-text-muted mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-xs text-text-muted">SLA</p>
              <p className="text-sm text-text-primary">{limits.sla ? `${limits.sla}%` : '\u306a\u3057'}</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-text-muted mt-4">
          {plan.planType === 'free'
            ? '日次使用状況 -- 毎日 0:00 (JST) にリセット'
            : `${usage.month} の使用状況 -- 月初にリセット`}
        </p>
      </div>

      {/* Plan Comparison */}
      <div className="surface-card p-6">
        <h3 className="text-sm font-medium text-text-primary mb-4">{'\u30d7\u30e9\u30f3\u6bd4\u8f03'}</h3>
        <div className="grid lg:grid-cols-3 gap-4">
          {allPlans.map((p) => {
            const isCurrent = p.type === plan.planType;
            return (
              <div
                key={p.type}
                className={`rounded-card border p-5 ${
                  isCurrent
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-base-surface'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-text-primary">{p.name}</h4>
                  {isCurrent && (
                    <span className="px-2 py-0.5 text-[10px] text-accent bg-accent/20 rounded font-mono">
                      {'\u73fe\u5728\u306e\u30d7\u30e9\u30f3'}
                    </span>
                  )}
                </div>
                <div className="mb-4">
                  <span className="text-xl font-mono tabular-nums text-text-primary">
                    {p.priceMonthly === null ? '\u500b\u5225\u898b\u7a4d' : p.priceMonthly === 0 ? '\u00a50' : `\u00a5${p.priceMonthly.toLocaleString()}`}
                  </span>
                  {p.priceMonthly !== null && (
                    <span className="text-sm text-text-muted ml-1">/ {'\u6708'}</span>
                  )}
                </div>
                <ul className="space-y-2">
                  {[
                    p.type === 'free'
                      ? `日次 ${formatNumber(p.limits.dailyTraces ?? 30)} トレース`
                      : `月間 ${formatNumber(p.limits.monthlyTraces)} トレース`,
                    p.limits.monthlyEvaluations === 0
                      ? 'LLM-as-Judge: \u306a\u3057'
                      : `LLM-as-Judge: ${formatNumber(p.limits.monthlyEvaluations)}\u56de/\u6708`,
                    `\u30c7\u30fc\u30bf\u4fdd\u6301 ${p.limits.retentionDays}\u65e5`,
                    `\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9 ${formatNumber(p.limits.maxWorkspaces)}`,
                    `\u30e1\u30f3\u30d0\u30fc ${formatNumber(p.limits.maxMembers)}\u540d`,
                    p.limits.sla ? `SLA ${p.limits.sla}%` : null,
                    p.limits.sso ? 'SSO / SAML \u5bfe\u5fdc' : null,
                    p.limits.customRules ? '\u30ab\u30b9\u30bf\u30e0\u30eb\u30fc\u30eb' : null,
                    p.limits.prioritySupport ? '\u5c02\u4efb\u30b5\u30dd\u30fc\u30c8' : null,
                  ].filter(Boolean).map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-text-secondary">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0" strokeWidth={1.5} />
                      {feature}
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  p.type === 'pro' && plan.planType === 'free' && stripeConfigured ? (
                    <button
                      onClick={handleUpgrade}
                      disabled={upgrading}
                      className="block w-full mt-4 py-2 px-4 rounded-card text-sm font-medium text-center transition-colors duration-120 bg-accent text-base hover:bg-accent/90 disabled:opacity-50"
                    >
                      {upgrading ? '\u51e6\u7406\u4e2d...' : '\u30d7\u30ed\u306b\u30a2\u30c3\u30d7\u30b0\u30ec\u30fc\u30c9'}
                    </button>
                  ) : !isCurrent ? (
                    <a
                      href="mailto:contact@fujitrace.com"
                      className={`block w-full mt-4 py-2 px-4 rounded-card text-sm font-medium text-center transition-colors duration-120 ${
                        p.type === 'pro'
                          ? 'bg-accent text-base hover:bg-accent/90'
                          : 'bg-base-elevated text-text-secondary border border-border hover:text-text-primary'
                      }`}
                    >
                      {p.type === 'pro' ? '\u30d7\u30ed\u306b\u30a2\u30c3\u30d7\u30b0\u30ec\u30fc\u30c9' : '\u304a\u554f\u3044\u5408\u308f\u305b'}
                    </a>
                  ) : null
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-text-muted mt-4 text-center">
          OSS{'\u30bb\u30eb\u30d5\u30db\u30b9\u30c8\u7248\u306f\u5168\u6a5f\u80fd\u7121\u6599\u3067\u5229\u7528\u53ef\u80fd\u3067\u3059'}
        </p>
      </div>
    </div>
  );
}
