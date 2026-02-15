import type {
  ValidationRule,
  RuleResult,
  LegacyStructuredResponse,
  InternalTrace,
} from '../../types/index.js';

/**
 * Confidence検証ルール
 * - 高信頼なのにエビデンスが薄い場合はWARN
 * - 低信頼なのにエビデンスが多い場合はWARN（矛盾）
 * - L3: 内部confidenceとの乖離検出（将来）
 */
export class ConfidenceValidator implements ValidationRule {
  readonly name = 'confidence_evidence_check';

  async validate(
    structured: LegacyStructuredResponse,
    internalTrace: InternalTrace | null
  ): Promise<RuleResult> {
    const { confidence, evidence } = structured;

    // L3: 内部confidenceが利用可能な場合の乖離チェック
    if (internalTrace?.internalConfidence !== undefined) {
      const diff = Math.abs(confidence - internalTrace.internalConfidence);
      if (diff > 0.3) {
        return {
          ruleName: this.name,
          level: 'WARN',
          message: `Large confidence discrepancy: self-reported ${confidence.toFixed(2)} vs internal ${internalTrace.internalConfidence.toFixed(2)}`,
          metadata: {
            selfReported: confidence,
            internal: internalTrace.internalConfidence,
            diff,
          },
        };
      }
    }

    // 高信頼（0.9以上）なのにエビデンスが1つ以下
    if (confidence >= 0.9 && evidence.length <= 1) {
      return {
        ruleName: this.name,
        level: 'WARN',
        message: `High confidence (${(confidence * 100).toFixed(0)}%) with insufficient evidence (${evidence.length} items)`,
        metadata: { confidence, evidenceCount: evidence.length },
      };
    }

    // 低信頼（0.4未満）なのにエビデンスが多い（矛盾の可能性）
    if (confidence < 0.4 && evidence.length >= 4) {
      return {
        ruleName: this.name,
        level: 'WARN',
        message: `Low confidence (${(confidence * 100).toFixed(0)}%) despite strong evidence (${evidence.length} items) - potential inconsistency`,
        metadata: { confidence, evidenceCount: evidence.length },
      };
    }

    // 極端に低い信頼度（0.2未満）は注意
    if (confidence < 0.2) {
      return {
        ruleName: this.name,
        level: 'WARN',
        message: `Very low confidence (${(confidence * 100).toFixed(0)}%) - answer may be unreliable`,
        metadata: { confidence, evidenceCount: evidence.length },
      };
    }

    return {
      ruleName: this.name,
      level: 'PASS',
      message: `Confidence (${(confidence * 100).toFixed(0)}%) aligned with evidence (${evidence.length} items)`,
      metadata: { confidence, evidenceCount: evidence.length },
    };
  }
}
