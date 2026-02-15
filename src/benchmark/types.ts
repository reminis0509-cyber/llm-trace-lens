/**
 * Industry Benchmark Types
 *
 * 匿名化・集約した業界ベンチマークデータの型定義。
 */

/** 業種カテゴリ（日本標準産業分類ベース・簡略版） */
export type IndustryCategory =
  | 'finance'        // 金融・保険
  | 'healthcare'     // 医療・ヘルスケア
  | 'manufacturing'  // 製造業
  | 'retail'         // 小売・EC
  | 'it_services'    // IT・情報サービス
  | 'real_estate'    // 不動産
  | 'education'      // 教育
  | 'legal'          // 法務・士業
  | 'logistics'      // 物流・運輸
  | 'government'     // 官公庁・自治体
  | 'media'          // メディア・広告
  | 'energy'         // エネルギー・インフラ
  | 'other';         // その他

/** 業種の日本語ラベルマッピング */
export const INDUSTRY_LABELS: Record<IndustryCategory, string> = {
  finance: '金融・保険',
  healthcare: '医療・ヘルスケア',
  manufacturing: '製造業',
  retail: '小売・EC',
  it_services: 'IT・情報サービス',
  real_estate: '不動産',
  education: '教育',
  legal: '法務・士業',
  logistics: '物流・運輸',
  government: '官公庁・自治体',
  media: 'メディア・広告',
  energy: 'エネルギー・インフラ',
  other: 'その他',
};

/** ワークスペースのベンチマーク用メトリクス（自社の値） */
export interface WorkspaceMetrics {
  workspaceId: string;
  period: string; // YYYY-MM
  industry: IndustryCategory;

  // トレース基本統計
  traceCount: number;
  avgLatencyMs: number;
  avgTokensPerRequest: number;
  avgCostPerRequest: number;

  // 評価メトリクス（LLM-as-Judge）
  avgAnswerRelevance: number | null;
  avgFaithfulness: number | null;

  // RAG固有メトリクス
  avgContextUtilization: number | null;
  avgHallucinationRate: number | null;
  ragTraceRatio: number; // RAGトレースの割合

  // パターン評価メトリクス
  toxicityFlagRate: number;
  injectionFlagRate: number;

  calculatedAt: string;
}

/** 業界ベンチマーク集約データ（匿名化済み） */
export interface IndustryBenchmark {
  industry: IndustryCategory;
  period: string; // YYYY-MM
  participantCount: number; // 匿名化のため最低3社以上で公開

  // トレース基本統計
  avgLatencyMs: number;
  medianLatencyMs: number;
  avgTokensPerRequest: number;
  avgCostPerRequest: number;

  // 評価メトリクス
  avgAnswerRelevance: number | null;
  avgFaithfulness: number | null;

  // RAG固有メトリクス
  avgContextUtilization: number | null;
  avgHallucinationRate: number | null;
  avgRagTraceRatio: number;

  // パターン評価
  avgToxicityFlagRate: number;
  avgInjectionFlagRate: number;

  // パーセンタイル（業界内ポジション算出用）
  percentiles: {
    answerRelevance: PercentileData | null;
    hallucinationRate: PercentileData | null;
    latencyMs: PercentileData;
    costPerRequest: PercentileData;
  };

  calculatedAt: string;
}

/** パーセンタイルデータ */
export interface PercentileData {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

/** ベンチマーク比較結果（ダッシュボードに返すレスポンス） */
export interface BenchmarkComparison {
  workspace: WorkspaceMetrics;
  industry: IndustryBenchmark | null; // 参加企業3社未満の場合はnull
  ranking: BenchmarkRanking | null;
}

/** 業界内ランキング */
export interface BenchmarkRanking {
  // パーセンタイル（0-100: 100が最上位）
  answerRelevancePercentile: number | null;
  hallucinationRatePercentile: number | null;
  latencyPercentile: number | null;
  costEfficiencyPercentile: number | null;
  overallPercentile: number | null;
}

/** ベンチマーク集約のための最低参加企業数 */
export const MIN_PARTICIPANTS_FOR_BENCHMARK = 3;
