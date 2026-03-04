import { useState, useEffect } from 'react';
import { Shield, Building2, TrendingUp, Activity, ChevronRight, X } from 'lucide-react';
import { adminApi, type AdminOverviewStats, type AdminWorkspace } from '../api/admin';

function formatNumber(n: number): string {
  if (n === Infinity || n >= 999999999) return '\u7121\u5236\u9650';
  return n.toLocaleString('ja-JP');
}

function getPlanBadgeColor(planType: string): string {
  switch (planType) {
    case 'enterprise': return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
    case 'pro': return 'bg-accent/20 text-accent border-accent/30';
    default: return 'bg-base-elevated text-text-muted border-border';
  }
}

function getUsageColor(percentage: number): string {
  if (percentage >= 90) return 'bg-status-fail';
  if (percentage >= 70) return 'bg-status-warn';
  return 'bg-status-pass';
}

type PlanType = 'free' | 'pro' | 'enterprise';

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWsId, setSelectedWsId] = useState<string | null>(null);
  const [changingPlan, setChangingPlan] = useState<{ wsId: string; plan: PlanType } | null>(null);
  const [planChangeLoading, setPlanChangeLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, workspacesData] = await Promise.all([
        adminApi.getOverviewStats(),
        adminApi.getWorkspaces(),
      ]);
      setStats(statsData);
      setWorkspaces(workspacesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '\u4e0d\u660e\u306a\u30a8\u30e9\u30fc');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePlanChange = async () => {
    if (!changingPlan) return;

    setPlanChangeLoading(true);
    try {
      await adminApi.updatePlan(changingPlan.wsId, changingPlan.plan);
      setChangingPlan(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '\u30d7\u30e9\u30f3\u5909\u66f4\u306b\u5931\u6557\u3057\u307e\u3057\u305f');
    } finally {
      setPlanChangeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl">
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

  const selectedWs = selectedWsId
    ? workspaces.find(w => w.id === selectedWsId)
    : null;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-card bg-violet-500/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-violet-400" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-lg font-medium text-text-primary">\u7ba1\u7406\u8005\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9</h2>
          <p className="text-sm text-text-muted">\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u30fb\u30d7\u30e9\u30f3\u30fb\u4f7f\u7528\u72b6\u6cc1\u306e\u7ba1\u7406</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="surface-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-text-muted" strokeWidth={1.5} />
              <span className="text-xs text-text-muted">\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9</span>
            </div>
            <p className="text-2xl font-mono tabular-nums text-text-primary">{stats.totalWorkspaces}</p>
          </div>
          <div className="surface-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-text-muted" strokeWidth={1.5} />
              <span className="text-xs text-text-muted">MRR</span>
            </div>
            <p className="text-2xl font-mono tabular-nums text-text-primary">
              \u00a5{formatNumber(stats.mrr)}
            </p>
          </div>
          <div className="surface-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-text-muted" strokeWidth={1.5} />
              <span className="text-xs text-text-muted">\u5f53\u6708\u30c8\u30ec\u30fc\u30b9</span>
            </div>
            <p className="text-2xl font-mono tabular-nums text-text-primary">
              {formatNumber(stats.totalTraces)}
            </p>
          </div>
          <div className="surface-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-text-muted" strokeWidth={1.5} />
              <span className="text-xs text-text-muted">\u30d7\u30e9\u30f3\u5206\u5e03</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-muted">F:{stats.planDistribution.free || 0}</span>
              <span className="text-accent">P:{stats.planDistribution.pro || 0}</span>
              <span className="text-violet-400">E:{stats.planDistribution.enterprise || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Table */}
      <div className="surface-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-medium text-text-primary">
            \u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u4e00\u89a7
            <span className="text-text-muted ml-2 font-mono text-xs">({workspaces.length})</span>
          </h3>
        </div>

        {workspaces.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-muted">
            \u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u304c\u3042\u308a\u307e\u305b\u3093
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">\u540d\u524d</th>
                  <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">\u30d7\u30e9\u30f3</th>
                  <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">\u30c8\u30ec\u30fc\u30b9\u4f7f\u7528\u91cf</th>
                  <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">\u8a55\u4fa1</th>
                  <th className="text-right px-6 py-3 text-xs text-text-muted font-medium">\u64cd\u4f5c</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((ws) => (
                  <tr
                    key={ws.id}
                    className="border-b border-border last:border-0 hover:bg-base-elevated/50 transition-colors duration-120"
                  >
                    <td className="px-6 py-3">
                      <div>
                        <p className="text-text-primary text-sm">{ws.name}</p>
                        <p className="text-text-muted text-xs font-mono">{ws.id}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs rounded border ${getPlanBadgeColor(ws.plan.type)}`}>
                        {ws.plan.type === 'free' ? 'Free' : ws.plan.type === 'pro' ? 'Pro' : 'Enterprise'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3 min-w-[180px]">
                        <div className="flex-1 h-1.5 bg-base-elevated rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getUsageColor(ws.usage.tracePercentage)}`}
                            style={{ width: `${Math.max(1, Math.min(100, ws.usage.tracePercentage))}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-muted font-mono tabular-nums whitespace-nowrap">
                          {formatNumber(ws.usage.traceCount)}
                          {ws.usage.traceLimit !== null ? ` / ${formatNumber(ws.usage.traceLimit)}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className="text-xs text-text-muted font-mono tabular-nums">
                        {formatNumber(ws.usage.evaluationCount)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => setSelectedWsId(ws.id)}
                        className="text-text-muted hover:text-text-primary p-1 rounded-card hover:bg-base-elevated transition-colors duration-120"
                      >
                        <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Workspace Detail Modal */}
      {selectedWs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="surface-card w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-base-surface z-10">
              <h3 className="text-sm font-medium text-text-primary">\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u8a73\u7d30</h3>
              <button
                onClick={() => setSelectedWsId(null)}
                className="p-1 text-text-muted hover:text-text-primary rounded-card hover:bg-base-elevated transition-colors duration-120"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Info */}
              <div>
                <p className="text-text-primary font-medium">{selectedWs.name}</p>
                <p className="text-xs text-text-muted font-mono mt-1">{selectedWs.id}</p>
                {selectedWs.createdAt && (
                  <p className="text-xs text-text-muted mt-1">
                    \u4f5c\u6210: {new Date(selectedWs.createdAt).toLocaleDateString('ja-JP')}
                  </p>
                )}
              </div>

              {/* Current Plan */}
              <div>
                <p className="text-xs text-text-muted mb-2">\u73fe\u5728\u306e\u30d7\u30e9\u30f3</p>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded border ${getPlanBadgeColor(selectedWs.plan.type)}`}>
                    {selectedWs.plan.type === 'free' ? 'Free' : selectedWs.plan.type === 'pro' ? 'Pro' : 'Enterprise'}
                  </span>
                  {selectedWs.plan.subscriptionId && (
                    <span className="text-xs text-text-muted font-mono">
                      {selectedWs.plan.subscriptionId}
                    </span>
                  )}
                </div>
              </div>

              {/* Usage */}
              <div>
                <p className="text-xs text-text-muted mb-2">
                  \u4f7f\u7528\u72b6\u6cc1 ({selectedWs.usage.month})
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">\u30c8\u30ec\u30fc\u30b9</span>
                    <span className="font-mono tabular-nums text-text-primary">
                      {formatNumber(selectedWs.usage.traceCount)}
                      {selectedWs.usage.traceLimit !== null ? ` / ${formatNumber(selectedWs.usage.traceLimit)}` : ''}
                    </span>
                  </div>
                  <div className="h-1.5 bg-base-elevated rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getUsageColor(selectedWs.usage.tracePercentage)}`}
                      style={{ width: `${Math.max(1, Math.min(100, selectedWs.usage.tracePercentage))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">\u8a55\u4fa1</span>
                    <span className="font-mono tabular-nums text-text-primary">
                      {formatNumber(selectedWs.usage.evaluationCount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Plan Change */}
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-text-muted mb-3">\u30d7\u30e9\u30f3\u5909\u66f4</p>
                <div className="flex gap-2">
                  {(['free', 'pro', 'enterprise'] as PlanType[]).map((pt) => (
                    <button
                      key={pt}
                      disabled={selectedWs.plan.type === pt}
                      onClick={() => setChangingPlan({ wsId: selectedWs.id, plan: pt })}
                      className={`flex-1 py-2 text-xs rounded-card border transition-colors duration-120 ${
                        selectedWs.plan.type === pt
                          ? 'border-accent bg-accent/10 text-accent cursor-default'
                          : 'border-border text-text-secondary hover:text-text-primary hover:bg-base-elevated'
                      }`}
                    >
                      {pt === 'free' ? 'Free' : pt === 'pro' ? 'Pro' : 'Enterprise'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Change Confirmation */}
      {changingPlan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="surface-card w-full max-w-sm mx-4 p-6">
            <h4 className="text-sm font-medium text-text-primary mb-2">\u30d7\u30e9\u30f3\u5909\u66f4\u306e\u78ba\u8a8d</h4>
            <p className="text-xs text-text-secondary mb-4">
              \u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9 <span className="font-mono text-text-primary">{changingPlan.wsId}</span> \u306e\u30d7\u30e9\u30f3\u3092{' '}
              <span className={`font-medium ${
                changingPlan.plan === 'pro' ? 'text-accent' :
                changingPlan.plan === 'enterprise' ? 'text-violet-400' : 'text-text-primary'
              }`}>
                {changingPlan.plan === 'free' ? 'Free' : changingPlan.plan === 'pro' ? 'Pro' : 'Enterprise'}
              </span>{' '}
              \u306b\u5909\u66f4\u3057\u307e\u3059\u304b\uff1f
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setChangingPlan(null)}
                disabled={planChangeLoading}
                className="px-4 py-2 text-xs text-text-secondary border border-border rounded-card hover:bg-base-elevated transition-colors duration-120"
              >
                \u30ad\u30e3\u30f3\u30bb\u30eb
              </button>
              <button
                onClick={handlePlanChange}
                disabled={planChangeLoading}
                className="px-4 py-2 text-xs bg-accent text-base rounded-card font-medium hover:bg-accent/90 transition-colors duration-120 disabled:opacity-50"
              >
                {planChangeLoading ? '\u5909\u66f4\u4e2d...' : '\u5909\u66f4\u3059\u308b'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
