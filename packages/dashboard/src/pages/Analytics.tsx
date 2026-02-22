import { useState, useEffect } from 'react';
import { TrendingUp, CheckCircle, XCircle, AlertTriangle, Info, BarChart3 } from 'lucide-react';

interface FeedbackStats {
  total: number;
  byType: {
    false_positive: number;
    false_negative: number;
    correct: number;
  };
}

interface Pattern {
  word: string;
  count: number;
}

interface Props {
  apiKey?: string;
  onBack: () => void;
}

export function Analytics({ apiKey, onBack }: Props) {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [apiKey]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      // Fetch stats
      const statsRes = await fetch('/feedback/stats', { headers });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      // Fetch patterns
      const patternsRes = await fetch('/feedback/patterns', { headers });
      if (patternsRes.ok) {
        const patternsData = await patternsRes.json();
        setPatterns(patternsData.topPatterns || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const falsePositiveRate = stats && stats.total > 0
    ? ((stats.byType.false_positive / stats.total) * 100).toFixed(1)
    : '0';

  const falseNegativeRate = stats && stats.total > 0
    ? ((stats.byType.false_negative / stats.total) * 100).toFixed(1)
    : '0';

  const accuracyRate = stats && stats.total > 0
    ? ((stats.byType.correct / stats.total) * 100).toFixed(1)
    : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-navy-700 flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-gray-500 animate-pulse" />
          </div>
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent-cyan/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-accent-cyan" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Feedback Analytics</h1>
          <p className="text-sm text-gray-400">Analysis of validation feedback data</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Feedback"
          value={String(stats?.total || 0)}
          color="cyan"
        />
        <SummaryCard
          title="False Positives"
          value={String(stats?.byType.false_positive || 0)}
          subtitle={`${falsePositiveRate}% of total`}
          color="amber"
        />
        <SummaryCard
          title="False Negatives"
          value={String(stats?.byType.false_negative || 0)}
          subtitle={`${falseNegativeRate}% of total`}
          color="red"
        />
        <SummaryCard
          title="Correct"
          value={String(stats?.byType.correct || 0)}
          subtitle={`${accuracyRate}% accuracy`}
          color="green"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feedback Distribution */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Feedback Distribution</h2>
          {stats && stats.total > 0 ? (
            <div className="space-y-4">
              <FeedbackBar
                label="Correct"
                value={stats.byType.correct}
                total={stats.total}
                color="bg-status-pass"
              />
              <FeedbackBar
                label="False Positive"
                value={stats.byType.false_positive}
                total={stats.total}
                color="bg-status-warn"
              />
              <FeedbackBar
                label="False Negative"
                value={stats.byType.false_negative}
                total={stats.total}
                color="bg-status-fail"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-gray-500">
              <BarChart3 className="w-12 h-12 mb-3 opacity-50" />
              <p>No feedback data available yet</p>
            </div>
          )}
        </div>

        {/* Top Patterns */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Top Patterns in False Positives</h2>
          {patterns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-navy-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Keyword</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Occurrences</th>
                  </tr>
                </thead>
                <tbody>
                  {patterns.map((p, i) => (
                    <tr key={i} className="border-b border-navy-800 last:border-b-0">
                      <td className="py-3 px-4 text-sm text-gray-300 font-mono">{p.word}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono text-gray-200">{p.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-gray-500">
              <BarChart3 className="w-12 h-12 mb-3 opacity-50" />
              <p>No pattern data available yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {stats && (stats.total > 0 || stats.byType.false_positive > 0 || stats.byType.false_negative > 0) && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Recommendations</h2>
          <div className="space-y-4">
            {stats.byType.false_positive > stats.byType.correct && (
              <RecommendationCard
                type="warning"
                title="High False Positive Rate"
                description="Consider adjusting your validation thresholds. Your current settings may be too strict."
              />
            )}
            {stats.byType.false_negative > 0 && (
              <RecommendationCard
                type="error"
                title="False Negatives Detected"
                description="Some risky content is not being caught. Review your validation rules."
              />
            )}
            {stats.total === 0 && (
              <RecommendationCard
                type="info"
                title="No Feedback Yet"
                description="Start collecting feedback from users to improve your validation accuracy."
              />
            )}
            {stats.byType.correct > stats.total * 0.8 && (
              <RecommendationCard
                type="success"
                title="Great Accuracy!"
                description="Your validation rules are performing well with over 80% accuracy."
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  color: 'cyan' | 'amber' | 'red' | 'green';
}) {
  const colorClasses = {
    cyan: 'bg-accent-cyan/10 border-accent-cyan/30',
    amber: 'bg-status-warn/10 border-status-warn/30',
    red: 'bg-status-fail/10 border-status-fail/30',
    green: 'bg-status-pass/10 border-status-pass/30',
  };

  const textColors = {
    cyan: 'text-accent-cyan',
    amber: 'text-status-warn',
    red: 'text-status-fail',
    green: 'text-status-pass',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <h3 className="text-sm text-gray-400 mb-1">{title}</h3>
      <p className={`text-3xl font-bold font-mono ${textColors[color]}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function FeedbackBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-500 font-mono">{value} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="w-full bg-navy-700 rounded-full h-3">
        <div
          className={`h-3 rounded-full ${color} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function RecommendationCard({
  type,
  title,
  description,
}: {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  description: string;
}) {
  const styles = {
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    warning: 'bg-status-warn/10 border-status-warn/30 text-status-warn',
    error: 'bg-status-fail/10 border-status-fail/30 text-status-fail',
    success: 'bg-status-pass/10 border-status-pass/30 text-status-pass',
  };

  const icons = {
    info: <Info className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />,
  };

  return (
    <div className={`p-4 rounded-lg border ${styles[type]}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icons[type]}</div>
        <div>
          <h4 className="font-semibold">{title}</h4>
          <p className="text-sm mt-1 opacity-90">{description}</p>
        </div>
      </div>
    </div>
  );
}
