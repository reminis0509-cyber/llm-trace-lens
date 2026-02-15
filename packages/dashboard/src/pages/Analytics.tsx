import { useState, useEffect } from 'react';

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
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">Loading analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feedback Analytics</h1>
          <p className="text-gray-600">Analysis of validation feedback data</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          title="Total Feedback"
          value={String(stats?.total || 0)}
          color="blue"
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Feedback Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Feedback Distribution</h2>
          {stats && stats.total > 0 ? (
            <div className="space-y-4">
              <FeedbackBar
                label="Correct"
                value={stats.byType.correct}
                total={stats.total}
                color="bg-green-500"
              />
              <FeedbackBar
                label="False Positive"
                value={stats.byType.false_positive}
                total={stats.total}
                color="bg-amber-500"
              />
              <FeedbackBar
                label="False Negative"
                value={stats.byType.false_negative}
                total={stats.total}
                color="bg-red-500"
              />
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No feedback data available yet
            </div>
          )}
        </div>

        {/* Top Patterns */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Top Patterns in False Positives</h2>
          {patterns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Keyword</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">Occurrences</th>
                  </tr>
                </thead>
                <tbody>
                  {patterns.map((p, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-2 text-sm">{p.word}</td>
                      <td className="py-2 text-sm text-right font-medium">{p.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No pattern data available yet
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Recommendations</h2>
        <div className="space-y-4">
          {stats && stats.byType.false_positive > stats.byType.correct && (
            <RecommendationCard
              type="warning"
              title="High False Positive Rate"
              description="Consider adjusting your validation thresholds. Your current settings may be too strict."
            />
          )}
          {stats && stats.byType.false_negative > 0 && (
            <RecommendationCard
              type="error"
              title="False Negatives Detected"
              description="Some risky content is not being caught. Review your validation rules."
            />
          )}
          {stats && stats.total === 0 && (
            <RecommendationCard
              type="info"
              title="No Feedback Yet"
              description="Start collecting feedback from users to improve your validation accuracy."
            />
          )}
          {stats && stats.byType.correct > stats.total * 0.8 && (
            <RecommendationCard
              type="success"
              title="Great Accuracy!"
              description="Your validation rules are performing well with over 80% accuracy."
            />
          )}
        </div>
      </div>
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
  color: 'blue' | 'amber' | 'red' | 'green';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    amber: 'bg-amber-50 border-amber-200',
    red: 'bg-red-50 border-red-200',
    green: 'bg-green-50 border-green-200',
  };

  const textColors = {
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    green: 'text-green-600',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <h3 className="text-sm text-gray-600 mb-1">{title}</h3>
      <p className={`text-3xl font-bold ${textColors[color]}`}>{value}</p>
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
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-500">{value} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`h-3 rounded-full ${color}`}
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
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
  };

  const icons = {
    info: 'info',
    warning: 'warning',
    error: 'error',
    success: 'check_circle',
  };

  return (
    <div className={`p-4 rounded-lg border ${styles[type]}`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl">{icons[type] === 'check_circle' ? '✓' : icons[type] === 'error' ? '✕' : icons[type] === 'warning' ? '⚠' : 'ℹ'}</div>
        <div>
          <h4 className="font-semibold">{title}</h4>
          <p className="text-sm mt-1 opacity-90">{description}</p>
        </div>
      </div>
    </div>
  );
}
