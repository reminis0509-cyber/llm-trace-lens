import { useState, useEffect } from 'react';
import { CreditCard, Database, Users, Shield, Clock, CheckCircle2, ArrowUpRight, Mail, Settings, Loader2 } from 'lucide-react';
import { billingApi, type BillingStatus } from '../api/billing';

interface PlanLimits {
  monthlyTraces: number;
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
    workspaceId: string;
    planType: string;
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

function formatNumber(n: number): string {
  if (n === Infinity || n >= 999999999) return '\u7121\u5236\u9650';
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
        <p className="text-status-fail text-sm">{error}</p>
      </div>
    );
  }

  if (!currentPlan) return null;

  const { plan, limits, usage } = currentPlan;
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
                  {plan.planType === 'free' ? 'Free' : plan.planType === 'pro' ? 'Pro' : 'Enterprise'}
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
                  {upgrading ? '\u51e6\u7406\u4e2d...' : 'Pro\u306b\u30a2\u30c3\u30d7\u30b0\u30ec\u30fc\u30c9'}
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
                  Enterprise{'\u76f8\u8ac7'}
                </a>
              </>
            )}
          </div>
        </div>

        {/* Usage Bars */}
        <div className="space-y-4">
          {/* Trace Usage */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-text-secondary">{'\u6708\u9593\u30c8\u30ec\u30fc\u30b9'}</span>
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
              <p className="text-xs text-status-fail mt-1">{'\u4e0a\u9650\u306b\u8fd1\u3065\u3044\u3066\u3044\u307e\u3059\u3002\u30a2\u30c3\u30d7\u30b0\u30ec\u30fc\u30c9\u3092\u691c\u8a0e\u3057\u3066\u304f\u3060\u3055\u3044\u3002'}</p>
            )}
          </div>

          {/* Evaluation Usage */}
          {limits.monthlyEvaluations > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-text-secondary">LLM-as-Judge {'\u8a55\u4fa1'}</span>
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
          {usage.month} {'\u306e\u4f7f\u7528\u72b6\u6cc1 \u30fb \u6708\u521d\u306b\u30ea\u30bb\u30c3\u30c8'}
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
                    `\u6708\u9593 ${formatNumber(p.limits.monthlyTraces)} \u30c8\u30ec\u30fc\u30b9`,
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
                      {upgrading ? '\u51e6\u7406\u4e2d...' : 'Pro\u306b\u30a2\u30c3\u30d7\u30b0\u30ec\u30fc\u30c9'}
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
                      {p.type === 'pro' ? 'Pro\u306b\u30a2\u30c3\u30d7\u30b0\u30ec\u30fc\u30c9' : '\u304a\u554f\u3044\u5408\u308f\u305b'}
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
