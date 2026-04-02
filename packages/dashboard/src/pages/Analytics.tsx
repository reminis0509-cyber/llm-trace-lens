import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

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
      setError(err instanceof Error ? err.message : '分析データの読み込みに失敗しました');
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
          <div className="w-6 h-6 mx-auto mb-3 skeleton rounded-full" />
          <p className="text-sm text-text-muted">分析データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-base font-medium text-text-primary">フィードバック分析</h1>
        <p className="text-sm text-text-muted mt-1">バリデーションフィードバックデータの分析</p>
      </div>

      {error && (
        <div className="p-3 bg-status-fail/10 border border-status-fail/30 text-status-fail rounded-card text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="フィードバック合計"
          value={stats?.total || 0}
          isZero={!stats?.total}
        />
        <SummaryCard
          title="偽陽性"
          value={stats?.byType.false_positive || 0}
          subtitle={`全体の${falsePositiveRate}%`}
          isZero={!stats?.byType.false_positive}
        />
        <SummaryCard
          title="偽陰性"
          value={stats?.byType.false_negative || 0}
          subtitle={`全体の${falseNegativeRate}%`}
          isZero={!stats?.byType.false_negative}
        />
        <SummaryCard
          title="正確"
          value={stats?.byType.correct || 0}
          subtitle={`正解率${accuracyRate}%`}
          isZero={!stats?.byType.correct}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feedback Distribution */}
        <div className="surface-card p-6">
          <h2 className="text-sm text-text-secondary mb-4 label-spacing uppercase">フィードバック分布</h2>
          {stats && stats.total > 0 ? (
            <div className="space-y-4">
              <FeedbackBar
                label="正確"
                value={stats.byType.correct}
                total={stats.total}
                color="bg-status-pass"
              />
              <FeedbackBar
                label="偽陽性"
                value={stats.byType.false_positive}
                total={stats.total}
                color="bg-status-warn"
              />
              <FeedbackBar
                label="偽陰性"
                value={stats.byType.false_negative}
                total={stats.total}
                color="bg-status-fail"
              />
            </div>
          ) : (
            <EmptyState message="フィードバックデータはまだありません" hint="ユーザーからフィードバックを収集しましょう" />
          )}
        </div>

        {/* Top Patterns */}
        <div className="surface-card p-6">
          <h2 className="text-sm text-text-secondary mb-4 label-spacing uppercase">偽陽性のトップパターン</h2>
          {patterns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-xs font-medium text-text-muted label-spacing uppercase">キーワード</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-text-muted label-spacing uppercase">出現回数</th>
                  </tr>
                </thead>
                <tbody>
                  {patterns.map((p, i) => (
                    <tr key={i} className="border-b border-border-subtle last:border-b-0">
                      <td className="py-3 px-4 text-sm text-text-primary font-mono">{p.word}</td>
                      <td className="py-3 px-4 text-sm text-right font-mono tabular-nums text-text-secondary">{p.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="パターンデータはまだありません" hint="フィードバックの収集に応じてパターンが表示されます" />
          )}
        </div>
      </div>

      {/* Recommendations */}
      {stats && (stats.total > 0 || stats.byType.false_positive > 0 || stats.byType.false_negative > 0) && (
        <div className="surface-card p-6">
          <h2 className="text-sm text-text-secondary mb-4 label-spacing uppercase">推奨事項</h2>
          <div className="space-y-3">
            {stats.byType.false_positive > stats.byType.correct && (
              <RecommendationCard
                type="warning"
                title="偽陽性率が高い"
                description="バリデーションしきい値の調整を検討してください。現在の設定が厳しすぎる可能性があります。"
              />
            )}
            {stats.byType.false_negative > 0 && (
              <RecommendationCard
                type="error"
                title="偽陰性を検出"
                description="一部のリスクコンテンツが検出されていません。バリデーションルールを見直してください。"
              />
            )}
            {stats.total === 0 && (
              <RecommendationCard
                type="info"
                title="フィードバックなし"
                description="バリデーション精度を向上させるためにフィードバックを収集しましょう。"
              />
            )}
            {stats.byType.correct > stats.total * 0.8 && (
              <RecommendationCard
                type="success"
                title="高い精度"
                description="バリデーションルールは80%以上の精度で正しく機能しています。"
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
  isZero,
}: {
  title: string;
  value: number;
  subtitle?: string;
  isZero?: boolean;
}) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs text-text-muted mb-2 label-spacing uppercase">{title}</p>
      <p className={`text-[32px] font-mono tabular-nums leading-none ${isZero ? 'text-text-muted' : 'text-text-primary'}`}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-text-muted mt-2">{subtitle}</p>}
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
      <div className="flex justify-between text-sm mb-2">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-muted font-mono tabular-nums">{value} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="w-full bg-base-elevated rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[180px] text-center">
      <p className="text-sm text-text-muted">{message}</p>
      {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
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
    info: 'border-l-blue-400 text-text-secondary',
    warning: 'border-l-status-warn text-text-secondary',
    error: 'border-l-status-fail text-text-secondary',
    success: 'border-l-status-pass text-text-secondary',
  };

  const icons = {
    info: <Info className="w-4 h-4 text-blue-400" strokeWidth={1.5} />,
    warning: <AlertTriangle className="w-4 h-4 text-status-warn" strokeWidth={1.5} />,
    error: <XCircle className="w-4 h-4 text-status-fail" strokeWidth={1.5} />,
    success: <CheckCircle className="w-4 h-4 text-status-pass" strokeWidth={1.5} />,
  };

  return (
    <div className={`p-4 bg-base rounded-card border-l-2 ${styles[type]}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icons[type]}</div>
        <div>
          <h4 className="text-sm font-medium text-text-primary">{title}</h4>
          <p className="text-sm text-text-muted mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}
