import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { fetchStats, fetchTraces } from '../api/client';
import type { ProviderStats, Trace } from '../types';

const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899'];

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
      <div className="text-center py-12 text-gray-500">Loading stats...</div>
    );
  }

  // Prepare data for charts
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

  const LEVEL_COLORS: Record<string, string> = {
    PASS: '#10B981',
    WARN: '#F59E0B',
    FAIL: '#F97316',
    BLOCK: '#EF4444',
  };

  const confidenceByProvider = stats.map((s) => ({
    name: `${s.provider}/${s.model.split('-').slice(-2).join('-')}`,
    score: s.avgScore,
    latency: s.avgLatency,
    count: s.count,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard
          title="Total Traces"
          value={traces.length}
          color="blue"
        />
        <SummaryCard
          title="Avg Score"
          value={
            traces.length > 0
              ? Math.round(
                  traces.reduce((sum, t) => sum + t.validation.score, 0) /
                    traces.length
                )
              : 0
          }
          suffix="/100"
          color="green"
        />
        <SummaryCard
          title="Pass Rate"
          value={
            traces.length > 0
              ? Math.round(
                  (traces.filter((t) => t.validation.overall === 'PASS').length /
                    traces.length) *
                    100
                )
              : 0
          }
          suffix="%"
          color="emerald"
        />
        <SummaryCard
          title="Avg Latency"
          value={
            traces.length > 0
              ? Math.round(
                  traces.reduce((sum, t) => sum + t.latencyMs, 0) / traces.length
                )
              : 0
          }
          suffix="ms"
          color="purple"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Validation Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Validation Distribution</h3>
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
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={LEVEL_COLORS[entry.name] || COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Score by Provider */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Score by Provider/Model</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={confidenceByProvider}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="score" fill="#3B82F6" name="Avg Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Latency by Provider */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Latency by Provider/Model</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={confidenceByProvider}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="latency" fill="#8B5CF6" name="Avg Latency (ms)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Request Count by Provider */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Request Count</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={confidenceByProvider}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#10B981" name="Request Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Provider Stats Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Provider Statistics</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-4 font-medium text-gray-600">
                Provider
              </th>
              <th className="text-left py-2 px-4 font-medium text-gray-600">
                Model
              </th>
              <th className="text-right py-2 px-4 font-medium text-gray-600">
                Count
              </th>
              <th className="text-right py-2 px-4 font-medium text-gray-600">
                Avg Score
              </th>
              <th className="text-right py-2 px-4 font-medium text-gray-600">
                Avg Latency
              </th>
              <th className="text-right py-2 px-4 font-medium text-gray-600">
                Total Tokens
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <span className="px-2 py-1 bg-gray-100 rounded text-sm">
                    {stat.provider}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-sm">{stat.model}</td>
                <td className="py-3 px-4 text-right">{stat.count}</td>
                <td className="py-3 px-4 text-right">
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      stat.avgScore >= 80
                        ? 'bg-green-100 text-green-800'
                        : stat.avgScore >= 60
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {stat.avgScore}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">{stat.avgLatency}ms</td>
                <td className="py-3 px-4 text-right">
                  {stat.totalTokens.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  suffix = '',
  color,
}: {
  title: string;
  value: number;
  suffix?: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    purple: 'bg-purple-50 border-purple-200',
  };

  return (
    <div
      className={`rounded-xl border p-4 ${colorClasses[color] || 'bg-gray-50'}`}
    >
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className="text-3xl font-bold">
        {value}
        <span className="text-lg text-gray-500">{suffix}</span>
      </p>
    </div>
  );
}
