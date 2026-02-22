import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
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
} from 'recharts';
import { fetchStats, fetchTraces } from '../api/client';
import type { ProviderStats, Trace } from '../types';

const CHART_COLORS = {
  cyan: '#00d4ff',
  emerald: '#00ff9d',
  purple: '#a855f7',
  amber: '#fbbf24',
};

const LEVEL_COLORS: Record<string, string> = {
  PASS: '#00ff9d',
  WARN: '#fbbf24',
  FAIL: '#f97316',
  BLOCK: '#6b7280',
};

export function StatsPanel() {
  const [stats, setStats] = useState<ProviderStats[]>([]);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

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
      <div className="text-center py-12 text-gray-400">Loading stats...</div>
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

  const pieData = Object.entries(validationDistribution).map(([name, value]) => ({
    name,
    value,
  }));

  const confidenceByProvider = stats.map((s) => ({
    name: `${s.provider}/${s.model.split('-').slice(-2).join('-')}`,
    score: s.avgScore,
    latency: s.avgLatency,
    count: s.count,
  }));

  const hasData = traces.length > 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          title="Total Traces"
          value={traces.length}
          gradient="from-accent-cyan to-blue-500"
        />
        <SummaryCard
          title="Avg Score"
          value={
            hasData
              ? Math.round(
                  traces.reduce((sum, t) => sum + t.validation.score, 0) /
                    traces.length
                )
              : 0
          }
          suffix="/100"
          gradient="from-accent-emerald to-green-500"
        />
        <SummaryCard
          title="Pass Rate"
          value={
            hasData
              ? Math.round(
                  (traces.filter((t) => t.validation.overall === 'PASS').length /
                    traces.length) *
                    100
                )
              : 0
          }
          suffix="%"
          gradient="from-emerald-400 to-teal-500"
        />
        <SummaryCard
          title="Avg Latency"
          value={
            hasData
              ? Math.round(
                  traces.reduce((sum, t) => sum + t.latencyMs, 0) / traces.length
                )
              : 0
          }
          suffix="ms"
          gradient="from-accent-purple to-purple-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Validation Distribution */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Validation Distribution</h3>
          {hasData ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  stroke="#0f1629"
                  strokeWidth={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={LEVEL_COLORS[entry.name] || CHART_COLORS.cyan}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a2035',
                    border: '1px solid #252d45',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No trace data available" />
          )}
        </div>

        {/* Score by Provider */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Score by Provider/Model</h3>
          {stats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={confidenceByProvider}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252d45" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#6b7280' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a2035',
                    border: '1px solid #252d45',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="score" fill={CHART_COLORS.cyan} name="Avg Score" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No provider stats available" />
          )}
        </div>

        {/* Latency by Provider */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Latency by Provider/Model</h3>
          {stats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={confidenceByProvider}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252d45" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a2035',
                    border: '1px solid #252d45',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="latency" fill={CHART_COLORS.purple} name="Avg Latency (ms)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No latency data available" />
          )}
        </div>

        {/* Request Count by Provider */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Request Count</h3>
          {stats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={confidenceByProvider}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252d45" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a2035',
                    border: '1px solid #252d45',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="count" fill={CHART_COLORS.emerald} name="Request Count" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No request data available" />
          )}
        </div>
      </div>

      {/* Provider Stats Table */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Provider Statistics</h3>
        {stats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-400">Provider</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-400">Model</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-400">Count</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-400">Avg Score</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-400">Avg Latency</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-400">Total Tokens</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat, i) => (
                  <tr key={i} className="border-b border-navy-800 hover:bg-navy-800/50 transition">
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-navy-700 rounded text-sm text-gray-200">
                        {stat.provider}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-sm text-gray-300">{stat.model}</td>
                    <td className="py-3 px-4 text-right font-mono text-gray-200">{stat.count}</td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`px-2 py-1 rounded text-sm font-mono ${
                          stat.avgScore >= 80
                            ? 'bg-status-pass/10 text-status-pass'
                            : stat.avgScore >= 60
                              ? 'bg-status-warn/10 text-status-warn'
                              : 'bg-status-fail/10 text-status-fail'
                        }`}
                      >
                        {stat.avgScore}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-gray-300">{stat.avgLatency}ms</td>
                    <td className="py-3 px-4 text-right font-mono text-gray-300">
                      {stat.totalTokens.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No provider statistics available" />
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  suffix = '',
  gradient,
}: {
  title: string;
  value: number;
  suffix?: string;
  gradient: string;
}) {
  return (
    <div className="gradient-border p-4">
      <p className="text-sm text-gray-400 mb-1">{title}</p>
      <p className="text-3xl font-bold font-mono text-gray-100">
        {value}
        <span className="text-lg text-gray-500">{suffix}</span>
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
      <BarChart3 className="w-12 h-12 mb-3 opacity-50" />
      <p>{message}</p>
    </div>
  );
}
