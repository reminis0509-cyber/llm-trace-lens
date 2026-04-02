import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shield, Building2, TrendingUp, Activity,
  ChevronRight, X, Search, Users, Calendar,
  ArrowUpDown, Clock, Edit3, Check, Save,
} from 'lucide-react';
import { adminApi, type AdminOverviewStats, type AdminWorkspace, type WorkspaceStatus } from '../api/admin';

// ---- Helpers ----

function getPlanLabel(planType: string): string {
  const labels: Record<string, string> = {
    'free': 'フリー',
    'pro': 'プロ',
    'enterprise': 'エンタープライズ',
  };
  return labels[planType] || planType;
}

function formatNumber(n: number): string {
  if (n === Infinity || n >= 999999999) return '無制限';
  return n.toLocaleString('ja-JP');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function getPlanBadgeColor(planType: string): string {
  switch (planType) {
    case 'enterprise': return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
    case 'pro': return 'bg-accent/20 text-accent border-accent/30';
    default: return 'bg-base-elevated text-text-muted border-border';
  }
}

function getStatusBadge(status: WorkspaceStatus, trialDays: number | null): { className: string; label: string } {
  switch (status) {
    case 'trial':
      return {
        className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        label: trialDays !== null ? `トライアル (残${trialDays}日)` : 'トライアル',
      };
    case 'active':
      return {
        className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        label: '有料',
      };
    case 'expired':
      return {
        className: 'bg-status-fail/20 text-status-fail border-status-fail/30',
        label: '期限切れ',
      };
    case 'free':
    default:
      return {
        className: 'bg-base-elevated text-text-muted border-border',
        label: 'フリー',
      };
  }
}

type PlanType = 'free' | 'pro' | 'enterprise';
type StatusFilter = 'all' | 'trial' | 'active' | 'free' | 'expired';
type SortKey = 'createdAt' | 'trialDaysRemaining' | 'name';

// ---- Local storage notes ----

function getAdminNote(workspaceId: string): string {
  try {
    const notes = JSON.parse(localStorage.getItem('admin_notes') || '{}') as Record<string, string>;
    return notes[workspaceId] || '';
  } catch {
    return '';
  }
}

function setAdminNote(workspaceId: string, note: string): void {
  try {
    const notes = JSON.parse(localStorage.getItem('admin_notes') || '{}') as Record<string, string>;
    notes[workspaceId] = note;
    localStorage.setItem('admin_notes', JSON.stringify(notes));
  } catch {
    // Ignore localStorage errors
  }
}

// ---- Component ----

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail modal
  const [selectedWsId, setSelectedWsId] = useState<string | null>(null);
  const [editingCompanyName, setEditingCompanyName] = useState(false);
  const [companyNameDraft, setCompanyNameDraft] = useState('');
  const [companyNameSaving, setCompanyNameSaving] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Plan change confirmation
  const [changingPlan, setChangingPlan] = useState<{ wsId: string; plan: PlanType } | null>(null);
  const [planChangeLoading, setPlanChangeLoading] = useState(false);

  // Filters and sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsData, workspacesData] = await Promise.all([
        adminApi.getOverviewStats(),
        adminApi.getWorkspaces(),
      ]);
      setStats(statsData);
      setWorkspaces(workspacesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Computed stats
  const computedStats = useMemo(() => {
    const trialCount = workspaces.filter(w => w.status === 'trial').length;
    const paidCount = workspaces.filter(w => w.status === 'active').length;
    return { trialCount, paidCount };
  }, [workspaces]);

  // Filtered and sorted workspaces
  const filteredWorkspaces = useMemo(() => {
    let result = [...workspaces];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(w => w.status === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(w =>
        w.name.toLowerCase().includes(q) ||
        (w.companyName && w.companyName.toLowerCase().includes(q)) ||
        w.id.toLowerCase().includes(q) ||
        w.members.some(m => m.email.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortKey) {
        case 'createdAt': {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        }
        case 'trialDaysRemaining': {
          const daysA = a.trialDaysRemaining ?? Infinity;
          const daysB = b.trialDaysRemaining ?? Infinity;
          return daysA - daysB;
        }
        case 'name':
          return a.name.localeCompare(b.name, 'ja');
        default:
          return 0;
      }
    });

    return result;
  }, [workspaces, statusFilter, searchQuery, sortKey]);

  // Detail modal workspace
  const selectedWs = useMemo(() => {
    if (!selectedWsId) return null;
    return workspaces.find(w => w.id === selectedWsId) || null;
  }, [selectedWsId, workspaces]);

  // When opening detail modal, load note
  const openDetail = useCallback((wsId: string) => {
    setSelectedWsId(wsId);
    setNoteText(getAdminNote(wsId));
    setEditingCompanyName(false);
    const ws = workspaces.find(w => w.id === wsId);
    setCompanyNameDraft(ws?.companyName || '');
  }, [workspaces]);

  const closeDetail = useCallback(() => {
    setSelectedWsId(null);
    setEditingCompanyName(false);
  }, []);

  const handleSaveCompanyName = async () => {
    if (!selectedWsId) return;
    setCompanyNameSaving(true);
    try {
      await adminApi.updateCompanyName(selectedWsId, companyNameDraft);
      setEditingCompanyName(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '会社名の更新に失敗しました');
    } finally {
      setCompanyNameSaving(false);
    }
  };

  const handleSaveNote = useCallback(() => {
    if (selectedWsId) {
      setAdminNote(selectedWsId, noteText);
    }
  }, [selectedWsId, noteText]);

  const handlePlanChange = async () => {
    if (!changingPlan) return;
    setPlanChangeLoading(true);
    try {
      await adminApi.updatePlan(changingPlan.wsId, changingPlan.plan);
      setChangingPlan(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'プラン変更に失敗しました');
    } finally {
      setPlanChangeLoading(false);
    }
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-card bg-violet-500/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-violet-400" strokeWidth={1.5} />
          </div>
          <div>
            <div className="h-5 bg-base-elevated rounded w-32 animate-pulse mb-1" />
            <div className="h-4 bg-base-elevated rounded w-48 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="surface-card p-4 animate-pulse">
              <div className="h-4 bg-base-elevated rounded w-20 mb-3" />
              <div className="h-7 bg-base-elevated rounded w-16" />
            </div>
          ))}
        </div>
        <div className="surface-card p-6 animate-pulse">
          <div className="h-5 bg-base-elevated rounded w-40 mb-4" />
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-12 bg-base-elevated rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div className="max-w-7xl">
        <div className="surface-card p-6">
          <p className="text-status-fail text-sm mb-3">{error}</p>
          <button
            onClick={() => { setError(null); fetchData(); }}
            className="text-sm text-accent hover:text-accent/80 transition-colors duration-120"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: '全て' },
    { key: 'trial', label: 'トライアル' },
    { key: 'active', label: '有料' },
    { key: 'free', label: 'フリー' },
    { key: 'expired', label: '期限切れ' },
  ];

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'createdAt', label: '登録日' },
    { key: 'trialDaysRemaining', label: 'トライアル残日数' },
    { key: 'name', label: '名前' },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-card bg-violet-500/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-violet-400" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-lg font-medium text-text-primary">顧客管理</h2>
          <p className="text-sm text-text-muted">ワークスペース・プラン・使用状況の管理</p>
        </div>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="surface-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-text-muted" strokeWidth={1.5} />
              <span className="text-xs text-text-muted">総顧客数</span>
            </div>
            <p className="text-2xl font-mono tabular-nums text-text-primary">
              {stats.totalWorkspaces}
            </p>
          </div>
          <div className="surface-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
              <span className="text-xs text-text-muted">トライアル中</span>
            </div>
            <p className="text-2xl font-mono tabular-nums text-blue-400">
              {computedStats.trialCount}
            </p>
          </div>
          <div className="surface-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
              <span className="text-xs text-text-muted">有料プラン</span>
            </div>
            <p className="text-2xl font-mono tabular-nums text-emerald-400">
              {computedStats.paidCount}
            </p>
          </div>
          <div className="surface-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-accent" strokeWidth={1.5} />
              <span className="text-xs text-text-muted">MRR</span>
            </div>
            <p className="text-2xl font-mono tabular-nums text-text-primary">
              ¥{formatNumber(stats.mrr)}
            </p>
          </div>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="surface-card p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" strokeWidth={1.5} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ワークスペース名、会社名、メールアドレスで検索..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-base-elevated border border-border rounded-card text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors duration-120"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Status filter buttons */}
          <div className="flex flex-wrap gap-1.5">
            {statusFilters.map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 text-xs rounded-card border transition-colors duration-120 ${
                  statusFilter === f.key
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-text-secondary hover:text-text-primary hover:bg-base-elevated'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.5} />
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              className="text-xs bg-base-elevated border border-border rounded-card px-2 py-1.5 text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-120"
            >
              {sortOptions.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Customer Table */}
      <div className="surface-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-medium text-text-primary">
            顧客一覧
            <span className="text-text-muted ml-2 font-mono text-xs">({filteredWorkspaces.length})</span>
          </h3>
        </div>

        {filteredWorkspaces.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-muted">
            {searchQuery || statusFilter !== 'all'
              ? '条件に一致する顧客が見つかりません'
              : '顧客がありません'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">顧客名</th>
                  <th className="text-left px-6 py-3 text-xs text-text-muted font-medium">ステータス</th>
                  <th className="text-left px-6 py-3 text-xs text-text-muted font-medium hidden md:table-cell">プラン</th>
                  <th className="text-left px-6 py-3 text-xs text-text-muted font-medium hidden lg:table-cell">メンバー</th>
                  <th className="text-left px-6 py-3 text-xs text-text-muted font-medium hidden sm:table-cell">登録日</th>
                  <th className="text-right px-6 py-3 text-xs text-text-muted font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkspaces.map(ws => {
                  const statusBadge = getStatusBadge(ws.status, ws.trialDaysRemaining);
                  return (
                    <tr
                      key={ws.id}
                      className="border-b border-border last:border-0 hover:bg-base-elevated/50 transition-colors duration-120 cursor-pointer"
                      onClick={() => openDetail(ws.id)}
                    >
                      <td className="px-6 py-3">
                        <div>
                          <p className="text-text-primary text-sm">{ws.name}</p>
                          {ws.companyName && (
                            <p className="text-text-secondary text-xs mt-0.5">{ws.companyName}</p>
                          )}
                          <p className="text-text-muted text-xs font-mono mt-0.5">{ws.id}</p>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs rounded border whitespace-nowrap ${statusBadge.className}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-3 hidden md:table-cell">
                        <span className={`inline-flex px-2 py-0.5 text-xs rounded border ${getPlanBadgeColor(ws.plan.type)}`}>
                          {getPlanLabel(ws.plan.type)}
                        </span>
                      </td>
                      <td className="px-6 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.5} />
                          <span className="text-xs text-text-secondary font-mono tabular-nums">
                            {ws.members.length}
                          </span>
                          {ws.members.length > 0 && (
                            <span className="text-xs text-text-muted truncate max-w-[120px]">
                              {ws.members[0].email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 hidden sm:table-cell">
                        <span className="text-xs text-text-muted font-mono tabular-nums">
                          {formatDate(ws.createdAt)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); openDetail(ws.id); }}
                          className="text-text-muted hover:text-text-primary p-1 rounded-card hover:bg-base-elevated transition-colors duration-120"
                          aria-label="詳細を表示"
                        >
                          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Detail Modal */}
      {selectedWs && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={closeDetail}
        >
          <div
            className="surface-card w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-base-surface z-10">
              <h3 className="text-sm font-medium text-text-primary">顧客詳細</h3>
              <button
                onClick={closeDetail}
                className="p-1 text-text-muted hover:text-text-primary rounded-card hover:bg-base-elevated transition-colors duration-120"
                aria-label="閉じる"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Workspace Info */}
              <div>
                <p className="text-text-primary font-medium">{selectedWs.name}</p>
                <p className="text-xs text-text-muted font-mono mt-1">{selectedWs.id}</p>

                {/* Company name (editable) */}
                <div className="mt-3">
                  <p className="text-xs text-text-muted mb-1">会社名</p>
                  {editingCompanyName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={companyNameDraft}
                        onChange={e => setCompanyNameDraft(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm bg-base-elevated border border-border rounded-card text-text-primary focus:outline-none focus:border-accent/50 transition-colors duration-120"
                        placeholder="会社名を入力"
                      />
                      <button
                        onClick={handleSaveCompanyName}
                        disabled={companyNameSaving}
                        className="p-1.5 text-accent hover:bg-accent/10 rounded-card transition-colors duration-120 disabled:opacity-50"
                        aria-label="保存"
                      >
                        <Check className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => setEditingCompanyName(false)}
                        className="p-1.5 text-text-muted hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
                        aria-label="キャンセル"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-secondary">
                        {selectedWs.companyName || '未設定'}
                      </span>
                      <button
                        onClick={() => {
                          setCompanyNameDraft(selectedWs.companyName || '');
                          setEditingCompanyName(true);
                        }}
                        className="p-1 text-text-muted hover:text-text-primary hover:bg-base-elevated rounded-card transition-colors duration-120"
                        aria-label="会社名を編集"
                      >
                        <Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  )}
                </div>

                {selectedWs.createdAt && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Calendar className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.5} />
                    <p className="text-xs text-text-muted">
                      登録日: {formatDate(selectedWs.createdAt)}
                    </p>
                  </div>
                )}
              </div>

              {/* Plan Info */}
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-text-muted mb-2">プラン情報</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded border ${getPlanBadgeColor(selectedWs.plan.type)}`}>
                      {getPlanLabel(selectedWs.plan.type)}
                    </span>
                    {(() => {
                      const badge = getStatusBadge(selectedWs.status, selectedWs.trialDaysRemaining);
                      return (
                        <span className={`px-2 py-0.5 text-xs rounded border ${badge.className}`}>
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-text-muted">開始日</span>
                      <p className="text-text-secondary font-mono tabular-nums mt-0.5">
                        {formatDate(selectedWs.plan.startedAt)}
                      </p>
                    </div>
                    {selectedWs.plan.expiresAt && (
                      <div>
                        <span className="text-text-muted">有効期限</span>
                        <p className="text-text-secondary font-mono tabular-nums mt-0.5">
                          {formatDate(selectedWs.plan.expiresAt)}
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedWs.trialDaysRemaining !== null && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-card">
                      <Clock className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
                      <span className="text-xs text-blue-400">
                        トライアル残り <span className="font-mono tabular-nums font-medium">{selectedWs.trialDaysRemaining}</span> 日
                      </span>
                    </div>
                  )}

                  {selectedWs.plan.subscriptionId && (
                    <p className="text-xs text-text-muted font-mono">
                      Subscription: {selectedWs.plan.subscriptionId}
                    </p>
                  )}
                </div>
              </div>

              {/* Members */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-text-muted" strokeWidth={1.5} />
                  <p className="text-xs text-text-muted">
                    メンバー
                    <span className="font-mono tabular-nums ml-1">({selectedWs.members.length})</span>
                  </p>
                </div>
                {selectedWs.members.length === 0 ? (
                  <p className="text-xs text-text-muted">メンバーがいません</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {selectedWs.members.map((member, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-base-elevated rounded-card">
                        <span className="text-xs text-text-secondary truncate mr-2">{member.email}</span>
                        <span className="text-xs text-text-muted px-1.5 py-0.5 border border-border rounded text-[10px] uppercase tracking-wider">
                          {member.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Plan Change */}
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-text-muted mb-3">プラン変更</p>
                <div className="flex gap-2">
                  {(['free', 'pro', 'enterprise'] as PlanType[]).map(pt => (
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
                      {getPlanLabel(pt)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Admin Notes */}
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-text-muted mb-2">管理メモ (ローカル保存)</p>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-base-elevated border border-border rounded-card text-text-secondary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors duration-120 resize-none"
                  placeholder="メモを入力..."
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSaveNote}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary border border-border rounded-card hover:text-text-primary hover:bg-base-elevated transition-colors duration-120"
                  >
                    <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
                    保存
                  </button>
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
            <h4 className="text-sm font-medium text-text-primary mb-2">プラン変更の確認</h4>
            <p className="text-xs text-text-secondary mb-4">
              ワークスペース <span className="font-mono text-text-primary">{changingPlan.wsId}</span> のプランを{' '}
              <span className={`font-medium ${
                changingPlan.plan === 'pro' ? 'text-accent' :
                changingPlan.plan === 'enterprise' ? 'text-violet-400' : 'text-text-primary'
              }`}>
                {getPlanLabel(changingPlan.plan)}
              </span>{' '}
              に変更しますか？
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setChangingPlan(null)}
                disabled={planChangeLoading}
                className="px-4 py-2 text-xs text-text-secondary border border-border rounded-card hover:bg-base-elevated transition-colors duration-120"
              >
                キャンセル
              </button>
              <button
                onClick={handlePlanChange}
                disabled={planChangeLoading}
                className="px-4 py-2 text-xs bg-accent text-base rounded-card font-medium hover:bg-accent/90 transition-colors duration-120 disabled:opacity-50"
              >
                {planChangeLoading ? '変更中...' : '変更する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
