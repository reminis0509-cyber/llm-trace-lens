import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Label,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fetchStats, fetchTraces } from '../api/client';
import type { ProviderStats, Trace } from '../types';

// ─── Color constants (matching tailwind.config.js status tokens) ────────────

const STATUS_COLORS: Record<string, string> = {
  PASS: '#4ade80',
  WARN: '#fbbf24',
  FAIL: '#f87171',
  BLOCK: '#a78bfa',
};

const CHART_GRID_COLOR = 'rgba(63, 63, 70, 0.3)';

const TOOLTIP_STYLE = {
  backgroundColor: '#111113',
  border: '1px solid #27272a',
  borderRadius: '6px',
  color: '#f4f4f5',
  fontSize: '12px',
  fontFamily: 'Geist Mono, monospace',
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface StatsPanelProps {
  refreshTrigger?: number;
}

interface SummaryCardProps {
  title: string;
  value: number;
  suffix?: string;
  colorTier?: 'good' | 'warning' | 'danger' | 'neutral';
  trendDirection?: 'up' | 'down' | 'flat';
}

interface ValidationSlice {
  name: string;
  label: string;
  value: number;
  color: string;
  percent: number;
}

interface ProviderChartDatum {
  name: string;
  score: number;
  latency: number;
  count: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveColorTier(value: number, thresholds: { good: number; warn: number }): 'good' | 'warning' | 'danger' {
  if (value >= thresholds.good) return 'good';
  if (value >= thresholds.warn) return 'warning';
  return 'danger';
}

const TIER_TEXT_CLASSES: Record<string, string> = {
  good: 'text-status-pass',
  warning: 'text-status-warn',
  danger: 'text-status-fail',
  neutral: 'text-text-primary',
};

// ─── Custom Pie Label ───────────────────────────────────────────────────────

interface PieLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
}

function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: PieLabelProps) {
  if (percent === 0) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 24;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#a1a1aa"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={11}
      fontFamily="Geist Mono, monospace"
    >
      {name} {(percent * 100).toFixed(0)}%
    </text>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function StatsPanel({ refreshTrigger = 0 }: StatsPanelProps) {
  const [stats, setStats] = useState<ProviderStats[]>([]);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadData();
  }, [refreshTrigger, loadData]);

  // ── Derived data ────────────────────────────────────────────────────────

  const validationDistribution = useMemo(() => {
    return traces.reduce(
      (acc, trace) => {
        const level = trace.validation.overall;
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [traces]);

  const hasData = traces.length > 0;

  const passRate = useMemo(() => {
    return hasData
      ? Math.round(((validationDistribution['PASS'] || 0) / traces.length) * 100)
      : 0;
  }, [hasData, validationDistribution, traces.length]);

  const avgScore = useMemo(() => {
    return hasData
      ? Math.round((traces.reduce((sum, t) => sum + t.validation.score, 0) / traces.length) * 100)
      : 0;
  }, [hasData, traces]);

  const avgLatency = useMemo(() => {
    return hasData
      ? Math.round(traces.reduce((sum, t) => sum + t.latencyMs, 0) / traces.length)
      : 0;
  }, [hasData, traces]);

  const pieData: ValidationSlice[] = useMemo(() => {
    const total = traces.length || 1;
    return (['PASS', 'WARN', 'FAIL', 'BLOCK'] as const).map((key) => ({
      name: key,
      label: { PASS: '合格', WARN: '警告', FAIL: '失敗', BLOCK: 'ブロック' }[key],
      value: validationDistribution[key] || 0,
      color: STATUS_COLORS[key],
      percent: ((validationDistribution[key] || 0) / total) * 100,
    }));
  }, [validationDistribution, traces.length]);

  const confidenceByProvider: ProviderChartDatum[] = useMemo(() => {
    return stats.map((s) => ({
      name: `${s.provider}/${s.model.split('-').slice(-2).join('-')}`,
      score: s.avgScore,
      latency: s.avgLatency,
      count: s.count,
    }));
  }, [stats]);

  // ── Loading state ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="surface-card p-5 animate-pulse">
              <div className="h-3 w-20 bg-base-elevated rounded mb-4" />
              <div className="h-9 w-24 bg-base-elevated rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="surface-card p-6 animate-pulse">
              <div className="h-3 w-32 bg-base-elevated rounded mb-4" />
              <div className="h-[280px] bg-base-elevated rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      <section aria-label="サマリー統計">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="総トレース数"
            value={traces.length}
            colorTier="neutral"
            trendDirection="flat"
          />
          <SummaryCard
            title="平均スコア"
            value={avgScore}
            suffix="/100"
            colorTier={resolveColorTier(avgScore, { good: 80, warn: 60 })}
            trendDirection="up"
          />
          <SummaryCard
            title="合格率"
            value={passRate}
            suffix="%"
            colorTier={resolveColorTier(passRate, { good: 90, warn: 70 })}
            trendDirection="up"
          />
          <SummaryCard
            title="平均レイテンシ"
            value={avgLatency}
            suffix="ms"
            colorTier={avgLatency <= 500 ? 'good' : avgLatency <= 1500 ? 'warning' : 'danger'}
            trendDirection="down"
          />
        </div>
      </section>

      {/* ── Separator ─────────────────────────────────────────────────── */}
      <div className="border-t border-border-subtle" />

      {/* ── Charts Section ────────────────────────────────────────────── */}
      <section aria-label="チャート">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Validation Distribution — Pie Chart */}
          <div className="surface-card p-6">
            <h3 className="text-sm text-text-secondary mb-4 label-spacing uppercase">
              バリデーション分布
            </h3>
            {hasData ? (
              <div>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      label={renderPieLabel}
                      labelLine={false}
                      strokeWidth={0}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                      <Label
                        value={`${passRate}%`}
                        position="center"
                        fill="#f4f4f5"
                        fontSize={24}
                        fontWeight={700}
                        fontFamily="Geist Mono, monospace"
                      />
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: number, name: string) => [`${value} 件`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend with counts and percentages */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-2 px-2">
                  {pieData.map((slice) => (
                    <div key={slice.name} className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: slice.color }}
                          aria-hidden="true"
                        />
                        <span className="text-text-secondary">{slice.label}</span>
                      </span>
                      <span className="text-text-primary">
                        {slice.value}
                        <span className="text-text-muted ml-1">({slice.percent.toFixed(0)}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState message="トレースデータがありません" />
            )}
          </div>

          {/* Score by Provider — Bar Chart */}
          <div className="surface-card p-6">
            <h3 className="text-sm text-text-secondary mb-4 label-spacing uppercase">
              プロバイダー別スコア
            </h3>
            {stats.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={confidenceByProvider} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                  <XAxis
                    dataKey="name"
                    angle={-35}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
                    axisLine={{ stroke: CHART_GRID_COLOR }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: 'rgba(110, 231, 183, 0.08)' }}
                    formatter={(value: number) => [`${value}`, '平均スコア']}
                  />
                  <Bar dataKey="score" name="平均スコア" radius={[3, 3, 0, 0]}>
                    {confidenceByProvider.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.score >= 80 ? '#4ade80' : entry.score >= 60 ? '#fbbf24' : '#f87171'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="プロバイダー統計がありません" />
            )}
          </div>
        </div>

        {/* Latency by Provider — full-width bar chart */}
        <div className="surface-card p-6 mt-6">
          <h3 className="text-sm text-text-secondary mb-4 label-spacing uppercase">
            プロバイダー別レイテンシ
          </h3>
          {stats.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={confidenceByProvider} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="name"
                  angle={-35}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tick={{ fill: '#a1a1aa', fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
                  axisLine={{ stroke: CHART_GRID_COLOR }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v: number) => `${v}ms`}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'rgba(110, 231, 183, 0.08)' }}
                  formatter={(value: number) => [`${value}ms`, '平均レイテンシ']}
                />
                <Bar dataKey="latency" name="平均レイテンシ (ms)" radius={[3, 3, 0, 0]}>
                  {confidenceByProvider.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.latency <= 500 ? '#4ade80' : entry.latency <= 1500 ? '#fbbf24' : '#f87171'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="レイテンシデータがありません" />
          )}
        </div>
      </section>

      {/* ── Provider Stats Table ──────────────────────────────────────── */}
      <section aria-label="プロバイダー統計テーブル">
        <div className="surface-card p-6">
          <h3 className="text-sm text-text-secondary mb-4 label-spacing uppercase">
            プロバイダー統計
          </h3>
          {stats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-xs font-medium text-text-muted label-spacing uppercase">
                      プロバイダー
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-text-muted label-spacing uppercase">
                      モデル
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-text-muted label-spacing uppercase">
                      件数
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-text-muted label-spacing uppercase">
                      平均スコア
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-text-muted label-spacing uppercase">
                      平均レイテンシ
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-text-muted label-spacing uppercase">
                      総トークン
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((stat, i) => {
                    const scoreTier = resolveColorTier(stat.avgScore, { good: 80, warn: 60 });
                    return (
                      <tr
                        key={i}
                        className="border-b border-border-subtle hover:bg-base-elevated transition-colors duration-120"
                      >
                        <td className="py-3 px-4 text-sm text-text-primary">{stat.provider}</td>
                        <td className="py-3 px-4 font-mono text-sm text-text-secondary">{stat.model}</td>
                        <td className="py-3 px-4 text-right font-mono text-sm tabular-nums text-text-primary">
                          {stat.count}
                        </td>
                        <td className={`py-3 px-4 text-right font-mono text-sm tabular-nums ${TIER_TEXT_CLASSES[scoreTier]}`}>
                          {stat.avgScore}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm tabular-nums text-text-secondary">
                          {stat.avgLatency}ms
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sm tabular-nums text-text-secondary">
                          {(stat.totalTokens ?? 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="プロバイダー統計がありません" />
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Summary Card ───────────────────────────────────────────────────────────

function SummaryCard({ title, value, suffix = '', colorTier = 'neutral', trendDirection = 'flat' }: SummaryCardProps) {
  const valueColorClass = TIER_TEXT_CLASSES[colorTier];
  const { displayValue, hasChanged } = useAnimatedValue(value);

  const TrendIcon = trendDirection === 'up'
    ? TrendingUp
    : trendDirection === 'down'
      ? TrendingDown
      : Minus;

  // For latency, "down" is good. For scores/rates, "up" is good.
  const trendColorClass =
    trendDirection === 'flat'
      ? 'text-text-muted'
      : 'text-text-muted';

  return (
    <div
      className={`surface-card p-5 group transition-colors duration-300 ${
        hasChanged ? 'animate-value-highlight' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-text-muted label-spacing uppercase">{title}</p>
        <span className={trendColorClass} aria-label={`トレンド: ${trendDirection}`}>
          <TrendIcon className="w-3.5 h-3.5" strokeWidth={2} />
        </span>
      </div>
      <p className={`text-4xl font-bold font-mono tabular-nums leading-none ${valueColorClass}`}>
        {displayValue.toLocaleString()}
        {suffix && <span className="text-base font-normal text-text-muted ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[200px] text-text-muted">
      <p className="text-sm">{message}</p>
    </div>
  );
}
