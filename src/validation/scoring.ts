import { getValidationConfig } from '../kv/client.js';

/**
 * Risk factors for scoring calculation
 */
export interface RiskFactors {
  confidence: number;
  evidenceCount: number;
  hasPII: boolean;
  hasHistoricalViolations: boolean;
  promptComplexity?: number;
}

/**
 * Scoring weights configuration
 */
export interface ScoringWeights {
  confidenceWeight: number;
  evidenceWeight: number;
  piiWeight: number;
  historicalWeight: number;
}

/**
 * Risk level thresholds configuration
 */
export interface RiskLevelThresholds {
  highRiskMin: number;
  mediumRiskMin: number;
  lowRiskMax: number;
}

/**
 * Risk score result
 */
export interface RiskScore {
  score: number; // 0-100
  level: 'low' | 'medium' | 'high';
  explanation: string;
}

/**
 * デフォルトのスコアリング重み
 * 合計が1.0になるよう設定
 * - confidenceWeight: 信頼度の重要度（40%）
 * - evidenceWeight: 根拠の重要度（30%）
 * - piiWeight: 個人情報検出の重要度（20%）
 * - historicalWeight: 過去の違反履歴の重要度（10%）
 */
const DEFAULT_WEIGHTS: ScoringWeights = {
  confidenceWeight: 0.4,
  evidenceWeight: 0.3,
  piiWeight: 0.2,
  historicalWeight: 0.1,
};

/**
 * デフォルトのリスクレベル閾値
 * - highRiskMin: 70以上で高リスク
 * - mediumRiskMin: 40以上で中リスク
 * - lowRiskMax: 39以下で低リスク
 */
const DEFAULT_THRESHOLDS: RiskLevelThresholds = {
  highRiskMin: 70,
  mediumRiskMin: 40,
  lowRiskMax: 39,
};

/**
 * RiskScorer - Calculates risk scores based on workspace-specific configurations
 * Implements threshold blackboxing by abstracting scoring logic
 */
export class RiskScorer {
  /**
   * Calculate risk score for given factors using workspace-specific weights
   */
  async calculateRiskScore(
    workspaceId: string,
    factors: RiskFactors
  ): Promise<RiskScore> {
    // Load workspace-specific weights or use defaults
    const weightsConfig = await getValidationConfig(workspaceId, 'scoring_weights');
    const weights: ScoringWeights = weightsConfig?.configData
      ? {
          confidenceWeight: weightsConfig.configData.confidenceWeight ?? DEFAULT_WEIGHTS.confidenceWeight,
          evidenceWeight: weightsConfig.configData.evidenceWeight ?? DEFAULT_WEIGHTS.evidenceWeight,
          piiWeight: weightsConfig.configData.piiWeight ?? DEFAULT_WEIGHTS.piiWeight,
          historicalWeight: weightsConfig.configData.historicalWeight ?? DEFAULT_WEIGHTS.historicalWeight,
        }
      : DEFAULT_WEIGHTS;

    // Load risk level thresholds
    const levelsConfig = await getValidationConfig(workspaceId, 'risk_levels');
    const thresholds: RiskLevelThresholds = levelsConfig?.configData
      ? {
          highRiskMin: levelsConfig.configData.highRiskMin ?? DEFAULT_THRESHOLDS.highRiskMin,
          mediumRiskMin: levelsConfig.configData.mediumRiskMin ?? DEFAULT_THRESHOLDS.mediumRiskMin,
          lowRiskMax: levelsConfig.configData.lowRiskMax ?? DEFAULT_THRESHOLDS.lowRiskMax,
        }
      : DEFAULT_THRESHOLDS;

    // Calculate component scores
    const confidenceScore = this.normalizeConfidence(factors.confidence);
    const evidenceScore = this.normalizeEvidence(factors.evidenceCount);
    const piiScore = factors.hasPII ? 100 : 0;
    const historicalScore = factors.hasHistoricalViolations ? 100 : 0;

    // Weighted sum
    const rawScore =
      confidenceScore * weights.confidenceWeight +
      evidenceScore * weights.evidenceWeight +
      piiScore * weights.piiWeight +
      historicalScore * weights.historicalWeight;

    const score = Math.round(Math.min(100, Math.max(0, rawScore)));

    // Determine level based on thresholds
    let level: 'low' | 'medium' | 'high';
    if (score >= thresholds.highRiskMin) {
      level = 'high';
    } else if (score >= thresholds.mediumRiskMin) {
      level = 'medium';
    } else {
      level = 'low';
    }

    // Generate explanation
    const explanation = this.generateExplanation(factors, score, level);

    return { score, level, explanation };
  }

  /**
   * Normalize confidence to risk score (high confidence = low risk)
   */
  private normalizeConfidence(confidence: number): number {
    return 100 - Math.min(100, Math.max(0, confidence));
  }

  // 証拠正規化の係数: 各証拠により20ポイントリスクが減少
  // 5件の証拠で100ポイント減少（リスク0）になる計算
  private static readonly EVIDENCE_RISK_REDUCTION_PER_ITEM = 20;

  /**
   * Normalize evidence count to risk score (more evidence = lower risk)
   * Capped at 5 evidence items for full reduction
   */
  private normalizeEvidence(count: number): number {
    return Math.max(0, 100 - count * RiskScorer.EVIDENCE_RISK_REDUCTION_PER_ITEM);
  }

  // 信頼度の閾値定数
  private static readonly CONFIDENCE_LOW_THRESHOLD = 60;   // この値未満は低信頼度
  private static readonly CONFIDENCE_HIGH_THRESHOLD = 90;  // この値超過は高信頼度
  private static readonly EVIDENCE_MIN_THRESHOLD = 2;      // この値未満は根拠不足
  private static readonly EVIDENCE_SUFFICIENT_THRESHOLD = 5; // この値以上で十分な根拠

  /**
   * Generate human-readable explanation for the risk score
   */
  private generateExplanation(
    factors: RiskFactors,
    score: number,
    level: string
  ): string {
    const reasons: string[] = [];

    if (factors.confidence < RiskScorer.CONFIDENCE_LOW_THRESHOLD) {
      reasons.push('信頼度が低い');
    } else if (factors.confidence > RiskScorer.CONFIDENCE_HIGH_THRESHOLD) {
      reasons.push('信頼度が高い');
    }

    if (factors.evidenceCount < RiskScorer.EVIDENCE_MIN_THRESHOLD) {
      reasons.push('根拠が不足している');
    } else if (factors.evidenceCount >= RiskScorer.EVIDENCE_SUFFICIENT_THRESHOLD) {
      reasons.push('十分な根拠がある');
    }

    if (factors.hasPII) {
      reasons.push('個人情報を含む');
    }

    if (factors.hasHistoricalViolations) {
      reasons.push('過去に類似の違反がある');
    }

    const summary =
      level === 'high'
        ? 'リスクが高いため注意が必要です'
        : level === 'medium'
        ? '中程度のリスクがあります'
        : 'リスクは低いです';

    return reasons.length > 0
      ? `${reasons.join('、')}。${summary}。`
      : summary;
  }

  /**
   * Calculate risk score synchronously using default weights (for backward compatibility)
   */
  calculateRiskScoreSync(factors: RiskFactors): RiskScore {
    const weights = DEFAULT_WEIGHTS;
    const thresholds = DEFAULT_THRESHOLDS;

    const confidenceScore = this.normalizeConfidence(factors.confidence);
    const evidenceScore = this.normalizeEvidence(factors.evidenceCount);
    const piiScore = factors.hasPII ? 100 : 0;
    const historicalScore = factors.hasHistoricalViolations ? 100 : 0;

    const rawScore =
      confidenceScore * weights.confidenceWeight +
      evidenceScore * weights.evidenceWeight +
      piiScore * weights.piiWeight +
      historicalScore * weights.historicalWeight;

    const score = Math.round(Math.min(100, Math.max(0, rawScore)));

    let level: 'low' | 'medium' | 'high';
    if (score >= thresholds.highRiskMin) {
      level = 'high';
    } else if (score >= thresholds.mediumRiskMin) {
      level = 'medium';
    } else {
      level = 'low';
    }

    const explanation = this.generateExplanation(factors, score, level);

    return { score, level, explanation };
  }
}

// Export singleton instance
export const riskScorer = new RiskScorer();
