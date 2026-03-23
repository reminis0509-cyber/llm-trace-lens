import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, AlertCircle, RefreshCw, Building2 } from 'lucide-react';

interface PercentileData {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

interface WorkspaceMetrics {
  workspaceId: string;
  period: string;
  industry: string;
  traceCount: number;
  avgLatencyMs: number;
  avgTokensPerRequest: number;
  avgCostPerRequest: number;
  avgAnswerRelevance: number | null;
  avgFaithfulness: number | null;
  avgContextUtilization: number | null;
  avgHallucinationRate: number | null;
  ragTraceRatio: number;
  toxicityFlagRate: number;
  injectionFlagRate: number;
  calculatedAt: string;
}

interface IndustryBenchmark {
  industry: string;
  period: string;
  participantCount: number;
  avgLatencyMs: number;
  medianLatencyMs: number;
  avgTokensPerRequest: number;
  avgCostPerRequest: number;
  avgAnswerRelevance: number | null;
  avgFaithfulness: number | null;
  avgContextUtilization: number | null;
  avgHallucinationRate: number | null;
  avgRagTraceRatio: number;
  avgToxicityFlagRate: number;
  avgInjectionFlagRate: number;
  percentiles: {
    answerRelevance: PercentileData | null;
    hallucinationRate: PercentileData | null;
    latencyMs: PercentileData;
    costPerRequest: PercentileData;
  };
  calculatedAt: string;
}

interface BenchmarkRanking {
  answerRelevancePercentile: number | null;
  hallucinationRatePercentile: number | null;
  latencyPercentile: number | null;
  costEfficiencyPercentile: number | null;
  overallPercentile: number | null;
}

interface BenchmarkData {
  workspace: WorkspaceMetrics;
  industry: IndustryBenchmark | null;
  ranking: BenchmarkRanking | null;
}

interface IndustryOption {
  value: string;
  label: string;
}

interface Props {
  apiKey?: string;
}

const API_BASE = '';

export function Benchmark({ apiKey }: Props) {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsIndustry, setNeedsIndustry] = useState(false);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [currentIndustryLabel, setCurrentIndustryLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const headers: Record<string, string> = {};
  if (apiKey) headers['x-api-key'] = apiKey;

  useEffect(() => {
    fetchBenchmark();
    fetchIndustries();
  }, [apiKey]);

  const fetchBenchmark = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/benchmark`, { headers });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
        setNeedsIndustry(false);
      } else if (res.status === 404) {
        // ルートが見つからない場合も業種設定UIを表示
        setNeedsIndustry(true);
      } else {
        try {
          const json = await res.json();
          if (json.needsIndustry) {
            setNeedsIndustry(true);
          } else {
            setError(json.message || json.error);
          }
        } catch {
          setNeedsIndustry(true);
        }
      }
    } catch (err) {
      // ネットワークエラー時も業種設定UIを表示
      setNeedsIndustry(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchIndustries = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/benchmark/industries`, { headers });
      if (res.ok) {
        const json = await res.json();
        setIndustries(json.categories);
      }

      const indRes = await fetch(`${API_BASE}/api/benchmark/industry`, { headers });
      if (indRes.ok) {
        const json = await indRes.json();
        if (json.industry) {
          setSelectedIndustry(json.industry);
          setCurrentIndustryLabel(json.label);
        }
      }
    } catch {
      // Ignore
    }
  };

  const saveIndustry = async () => {
    if (!selectedIndustry) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/benchmark/industry`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: selectedIndustry }),
      });
      if (res.ok) {
        const json = await res.json();
        setCurrentIndustryLabel(json.label);
        setNeedsIndustry(false);
        fetchBenchmark();
      }
    } catch {
      // Ignore
    } finally {
      setSaving(false);
    }
  };

  const refreshMetrics = async () => {
    setRefreshing(true);
    try {
      await fetch(`${API_BASE}/api/benchmark/refresh`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await fetchBenchmark();
    } catch {
      // Ignore
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-6 h-6 mx-auto mb-3 skeleton rounded-full" />
          <p className="text-sm text-text-muted">ベンチマークを読み込み中...</p>
        </div>
      </div>
    );
  }

  // 業種未設定
  if (needsIndustry) {
    return (
      <div className="max-w-lg mx-auto mt-12 p-6 bg-base-surface rounded-lg border border-border">
        <div className="text-center mb-6">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-accent" strokeWidth={1.5} />
          <h2 className="text-lg font-semibold text-text-primary mb-2">業種を設定してください</h2>
          <p className="text-sm text-text-secondary">
            業界ベンチマークを利用するには、ワークスペースの業種を設定する必要があります。
            匿名化された業界平均と自社のAIエージェントを比較できます。
          </p>
        </div>
        <div className="space-y-4">
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="w-full px-3 py-2 bg-base border border-border rounded-md text-sm text-text-primary"
          >
            <option value="">業種を選択...</option>
            {industries.map((ind) => (
              <option key={ind.value} value={ind.value}>{ind.label}</option>
            ))}
          </select>
          <button
            onClick={saveIndustry}
            disabled={!selectedIndustry || saving}
            className="w-full px-4 py-2 bg-accent text-white rounded-md text-sm font-medium disabled:opacity-50 hover:bg-accent/90 transition-colors"
          >
            {saving ? '保存中...' : '設定して開始'}
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-12 p-6 bg-base-surface rounded-lg border border-border">
        <div className="flex items-center gap-3 text-amber-500">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { workspace, industry, ranking } = data;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent" strokeWidth={1.5} />
            業界ベンチマーク
          </h2>
          <p className="text-xs text-text-muted mt-1">
            {currentIndustryLabel && `${currentIndustryLabel}`}
            {industry && ` / 匿名化参加企業 ${industry.participantCount}社`}
            {' / '}
            {workspace.period}
          </p>
        </div>
        <button
          onClick={refreshMetrics}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary border border-border rounded-md transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>

      {/* Overall Ranking */}
      {ranking?.overallPercentile != null && (
        <div className="bg-base-surface rounded-lg border border-border p-6">
          <div className="text-center">
            <p className="text-sm text-text-secondary mb-1">総合ランキング</p>
            <p className="text-4xl font-bold text-accent">
              上位 {Math.max(1, 100 - ranking.overallPercentile)}%
            </p>
            <p className="text-xs text-text-muted mt-2">
              業界内のAIエージェント性能ポジション
            </p>
          </div>
        </div>
      )}

      {/* Metrics Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          title="回答関連性スコア"
          myValue={workspace.avgAnswerRelevance}
          industryValue={industry?.avgAnswerRelevance ?? null}
          percentile={ranking?.answerRelevancePercentile ?? null}
          format="score"
          higherIsBetter
        />
        <MetricCard
          title="ハルシネーション率"
          myValue={workspace.avgHallucinationRate}
          industryValue={industry?.avgHallucinationRate ?? null}
          percentile={ranking?.hallucinationRatePercentile ?? null}
          format="percent"
          higherIsBetter={false}
        />
        <MetricCard
          title="平均レイテンシ"
          myValue={workspace.avgLatencyMs}
          industryValue={industry?.avgLatencyMs ?? null}
          percentile={ranking?.latencyPercentile ?? null}
          format="ms"
          higherIsBetter={false}
        />
        <MetricCard
          title="平均コスト/リクエスト"
          myValue={workspace.avgCostPerRequest}
          industryValue={industry?.avgCostPerRequest ?? null}
          percentile={ranking?.costEfficiencyPercentile ?? null}
          format="cost"
          higherIsBetter={false}
        />
      </div>

      {/* Detailed Metrics */}
      <div className="bg-base-surface rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text-primary">詳細メトリクス</h3>
        </div>
        <div className="divide-y divide-border">
          <MetricRow
            label="トレース数"
            myValue={(workspace.traceCount ?? 0).toLocaleString()}
            industryValue={null}
          />
          <MetricRow
            label="Faithfulness (忠実性)"
            myValue={workspace.avgFaithfulness != null ? (workspace.avgFaithfulness * 100).toFixed(1) + '%' : '-'}
            industryValue={industry?.avgFaithfulness != null ? (industry.avgFaithfulness * 100).toFixed(1) + '%' : null}
          />
          <MetricRow
            label="Context Utilization"
            myValue={workspace.avgContextUtilization != null ? (workspace.avgContextUtilization * 100).toFixed(1) + '%' : '-'}
            industryValue={industry?.avgContextUtilization != null ? (industry.avgContextUtilization * 100).toFixed(1) + '%' : null}
          />
          <MetricRow
            label="RAGトレース比率"
            myValue={(workspace.ragTraceRatio * 100).toFixed(1) + '%'}
            industryValue={industry ? (industry.avgRagTraceRatio * 100).toFixed(1) + '%' : null}
          />
          <MetricRow
            label="平均トークン/リクエスト"
            myValue={Math.round(workspace.avgTokensPerRequest ?? 0).toLocaleString()}
            industryValue={industry ? Math.round(industry.avgTokensPerRequest ?? 0).toLocaleString() : null}
          />
          <MetricRow
            label="毒性検出率"
            myValue={(workspace.toxicityFlagRate * 100).toFixed(2) + '%'}
            industryValue={industry ? (industry.avgToxicityFlagRate * 100).toFixed(2) + '%' : null}
          />
          <MetricRow
            label="インジェクション検出率"
            myValue={(workspace.injectionFlagRate * 100).toFixed(2) + '%'}
            industryValue={industry ? (industry.avgInjectionFlagRate * 100).toFixed(2) + '%' : null}
          />
        </div>
      </div>

      {/* Info Note */}
      {!industry && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
          <p className="text-sm text-text-secondary">
            業界平均データは、同一業種のFujiTrace利用企業が3社以上になると表示されます。
            現在は自社メトリクスのみ表示しています。
          </p>
        </div>
      )}

      {/* Industry Setting */}
      <div className="bg-base-surface rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">業種設定</p>
            <p className="text-xs text-text-muted mt-0.5">
              現在: {currentIndustryLabel || '未設定'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="px-2 py-1 bg-base border border-border rounded text-xs text-text-primary"
            >
              <option value="">変更...</option>
              {industries.map((ind) => (
                <option key={ind.value} value={ind.value}>{ind.label}</option>
              ))}
            </select>
            {selectedIndustry && (
              <button
                onClick={saveIndustry}
                disabled={saving}
                className="px-3 py-1 bg-accent text-white rounded text-xs disabled:opacity-50"
              >
                {saving ? '...' : '保存'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== Sub Components ==========

function MetricCard({
  title,
  myValue,
  industryValue,
  percentile,
  format,
  higherIsBetter,
}: {
  title: string;
  myValue: number | null;
  industryValue: number | null;
  percentile: number | null;
  format: 'score' | 'percent' | 'ms' | 'cost';
  higherIsBetter: boolean;
}) {
  const formatValue = (v: number | null) => {
    if (v == null) return '-';
    switch (format) {
      case 'score': return (v * 100).toFixed(1) + '%';
      case 'percent': return (v * 100).toFixed(1) + '%';
      case 'ms': return Math.round(v).toLocaleString() + 'ms';
      case 'cost': return '$' + v.toFixed(4);
    }
  };

  const diff = myValue != null && industryValue != null ? myValue - industryValue : null;
  const isGood = diff != null && ((higherIsBetter && diff > 0) || (!higherIsBetter && diff < 0));
  const isBad = diff != null && ((higherIsBetter && diff < 0) || (!higherIsBetter && diff > 0));

  return (
    <div className="bg-base-surface rounded-lg border border-border p-4">
      <p className="text-xs text-text-muted mb-2">{title}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-semibold text-text-primary">
            {formatValue(myValue)}
          </p>
          {industryValue != null && (
            <p className="text-xs text-text-muted mt-1">
              業界平均: {formatValue(industryValue)}
            </p>
          )}
        </div>
        <div className="text-right">
          {diff != null && (
            <div className={`flex items-center gap-1 text-xs ${isGood ? 'text-emerald-500' : isBad ? 'text-red-400' : 'text-text-muted'}`}>
              {isGood ? <TrendingUp className="w-3.5 h-3.5" /> : isBad ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              {format === 'ms' ? Math.abs(Math.round(diff)).toLocaleString() + 'ms' :
               format === 'cost' ? '$' + Math.abs(diff).toFixed(4) :
               (Math.abs(diff) * 100).toFixed(1) + 'pt'}
            </div>
          )}
          {percentile != null && (
            <p className="text-xs text-text-muted mt-1">上位 {Math.max(1, 100 - percentile)}%</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  myValue,
  industryValue,
}: {
  label: string;
  myValue: string;
  industryValue: string | null;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-text-secondary">{label}</span>
      <div className="flex items-center gap-6">
        <span className="text-xs font-medium text-text-primary w-24 text-right">{myValue}</span>
        <span className="text-xs text-text-muted w-24 text-right">
          {industryValue ?? '-'}
        </span>
      </div>
    </div>
  );
}
