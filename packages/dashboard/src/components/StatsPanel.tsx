import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fetchStats, fetchTraces } from '../api/client';
import type { ProviderStats, Trace } from '../types';

const CHART_BAR_COLOR = '#3f3f46';
const CHART_BAR_HOVER = '#6ee7b7';
const CHART_GRID_COLOR = 'rgba(63, 63, 70, 0.3)';

interface StatsPanelProps {
  refreshTrigger?: number;
}

export function StatsPanel({ refreshTrigger = 0 }: StatsPanelProps) {
  const [stats, setStats] = useState<ProviderStats[]>([]);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  async function loadData() {
    setLoading(true);
    try {
      const [statsResult, tracesResult] = await Promise.all([
        fetchStats(),
        fetchTraces({ limit: 100 }),
      ]);
      setStats(statsResult.stats);
      setTraces(tracesResult.traces);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-text-muted">統計を読み込み中...</div>
    );
  }

  const validationDistribution = traces.reduce(
    (acc, trace) => {
      const level = trace.validation.overall;
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const passRate = traces.length > 0
    ? Math.round((validationDistribution['PASS'] || 0) / traces.length * 100)
    : 0;

  const confidenceByProvider = stats.map((s) => ({
    name: `${s.provider}/${s.model.split('-').slice(-2).join('-')}`,
    score: s.avgScore,
    latency: s.avgLatency,
    count: s.count,
  }));

  const hasData = traces.length > 0;

  const tooltipStyle = {
    backgroundColor: '#111113',
    border: '1px solid #27272a',
    borderRadius: '6px',
    color: '#f4f4f5',
    fontSize: '12px',
    fontFamily: 'Geist Mono, monospace',
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards - unified bg, no accent colors */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="総トレース数"
          value={traces.length}
        />
        <SummaryCard
          title="平均スコア"
          value={
            hasData
              ? Math.round(
                  traces.reduce((sum, t) => sum + t.validation.score, 0) /
                    traces.length
                )
              : 0
          }
          suffix="/100"
        />
        <SummaryCard
          title="合格率"
          value={passRate}
          suffix="%"
        />
        <SummaryCard
          title="平均レイテンシ"
          value={
            hasData
              ? Math.round(
                  traces.reduce((sum, t) => sum + t.latencyMs, 0) / traces.length
                )
              : 0
          }
          suffix="ms"
        />
      </div>

      {/* Pass Rate Bar - replaces pie chart */}
      <div className="surface-card p-6">
        <h3 className="text-sm text-text-secondary mb-4 label-spacing uppercase">バリデーション分布</h3>
        {hasData ? (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-secondary">合格率</span>
              <span className="font-mono tabular-nums text-text-primary">{passRate}%</span>
            </div>
            <div className="w-full h-2 bg-base-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-status-pass transition-all duration-300"
                style={{ width: `${passRate}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-text-muted mt-3 font-mono tabular-nums">
              <span>合格: {validationDistribution['PASS'] || 0}</span>
              <span>警告: {validationDistribution['WARN'] || 0}</span>
              <span>失敗: {validationDistribution['FAIL'] || 0}</span>
              <span>ブロック: {validationDistribution['BLOCK'] || 0}</span>
            </div>
          </div>
        ) : (
          <EmptyState message="トレースデータがありません" />
        )}
      </div>

      {/* Charts - single gray color, minimal styling */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score by Provider */}
        <div className="surface-card p-6">
          <h3 className="text-sm text-text-secondary mb-4 label-spacing uppercase">プロバイダー別スコア</h3>
          {stats.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={confidenceByProvider}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
                  axisLine={{ stroke: CHART_GRID_COLOR }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(110, 231, 183, 0.08)' }} />
                <Bar dataKey="score" fill={CHART_BAR_COLOR} name="平均スコア" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="プロバイダー統計がありません" />
          )}
        </div>

        {/* Latency by Provider */}
        <div className="surface-card p-6">
          <h3 className="text-sm text-text-secondary mb-4 label-spacing uppercase">プロバイダー別レイテンシ</h3>
          {stats.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={confidenceByProvider}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
                  axisLine={{ stroke: CHART_GRID_COLOR }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(110, 231, 183, 0.08)' }} />
                <Bar dataKey="latency" fill={CHART_BAR_COLOR} name="平均レイテンシ (ms)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="レイテンシデータがありません" />
          )}
        </div>
      </div>

      {/* Provider Stats Table */}
      <div className="surface-card p-6">
        <h3 className="text-sm text-text-secondary mb-4 label-spacing uppercase">プロバイダー統計</h3>
        {stats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-medium text-text-muted label-spacing uppercase">プロバイダー</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-text-muted label-spacing uppercase">モデル</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-text-muted label-spacing uppercase">件数</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-text-muted label-spacing uppercase">平均スコア</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-text-muted label-spacing uppercase">平均レイテンシ</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-text-muted label-spacing uppercase">総トークン</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat, i) => (
                  <tr key={i} className="border-b border-border-subtle hover:bg-base-elevated transition-colors duration-120">
                    <td className="py-3 px-4 text-sm text-text-primary">{stat.provider}</td>
                    <td className="py-3 px-4 font-mono text-sm text-text-secondary">{stat.model}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm tabular-nums text-text-primary">{stat.count}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm tabular-nums text-text-primary">{stat.avgScore}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm tabular-nums text-text-secondary">{stat.avgLatency}ms</td>
                    <td className="py-3 px-4 text-right font-mono text-sm tabular-nums text-text-secondary">
                      {stat.totalTokens.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="プロバイダー統計がありません" />
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  suffix = '',
}: {
  title: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs text-text-muted mb-2 label-spacing uppercase">{title}</p>
      <p className="text-[32px] font-mono tabular-nums text-text-primary leading-none">
        {value}
        {suffix && <span className="text-base text-text-muted ml-0.5">{suffix}</span>}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[200px] text-text-muted">
      <p className="text-sm">{message}</p>
    </div>
  );
}
