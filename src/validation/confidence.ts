import type { StructuredResponse } from '../types/index.js';
import { RiskScorer, type RiskFactors, type RiskScore } from './scoring.js';

export interface ValidationResult {
  status: 'PASS' | 'WARN' | 'BLOCK';
  issues: string[];
}

export interface EnhancedValidationResult extends ValidationResult {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  explanation: string;
}

const riskScorer = new RiskScorer();

/**
 * Confidence Validator
 * - High confidence with insufficient evidence → WARN
 * - Low confidence → WARN
 *
 * Now integrated with RiskScorer for threshold blackboxing
 */
export class ConfidenceValidator {
  /**
   * Legacy validate method for backward compatibility
   */
  validate(response: StructuredResponse): ValidationResult {
    const issues: string[] = [];
    let status: ValidationResult['status'] = 'PASS';

    // High confidence (90+) with insufficient evidence (< 2 items)
    if (response.confidence >= 90 && response.evidence.length < 2) {
      issues.push(
        `High confidence (${response.confidence}%) with insufficient evidence (${response.evidence.length} items)`
      );
      status = 'WARN';
    }

    // Low confidence (< 50)
    if (response.confidence < 50) {
      issues.push(`Low confidence (${response.confidence}%) - answer may be unreliable`);
      if (status !== 'WARN') {
        status = 'WARN';
      }
    }

    return { status, issues };
  }

  /**
   * Enhanced validation with workspace-specific risk scoring
   * Implements threshold blackboxing by using RiskScorer
   */
  async validateWithScoring(
    workspaceId: string,
    response: StructuredResponse,
    context: {
      hasPII: boolean;
      hasHistoricalViolations: boolean;
    }
  ): Promise<EnhancedValidationResult> {
    const factors: RiskFactors = {
      confidence: response.confidence || 0,
      evidenceCount: response.evidence?.length || 0,
      hasPII: context.hasPII,
      hasHistoricalViolations: context.hasHistoricalViolations,
    };

    const riskResult = await riskScorer.calculateRiskScore(workspaceId, factors);

    // Determine status based on risk level
    let status: ValidationResult['status'];
    if (riskResult.level === 'high') {
      status = 'BLOCK';
    } else if (riskResult.level === 'medium') {
      status = 'WARN';
    } else {
      status = 'PASS';
    }

    // Generate issues from risk factors
    const issues: string[] = [];
    if (response.confidence < 50) {
      issues.push('Low confidence response');
    }
    if (response.evidence?.length < 2) {
      issues.push('Insufficient evidence');
    }
    if (context.hasPII) {
      issues.push('Contains PII');
    }
    if (context.hasHistoricalViolations) {
      issues.push('Historical violations detected');
    }

    return {
      status,
      issues,
      riskScore: riskResult.score,
      riskLevel: riskResult.level,
      explanation: riskResult.explanation,
    };
  }

  /**
   * Synchronous enhanced validation using default weights
   */
  validateWithScoringSync(
    response: StructuredResponse,
    context: {
      hasPII: boolean;
      hasHistoricalViolations: boolean;
    }
  ): EnhancedValidationResult {
    const factors: RiskFactors = {
      confidence: response.confidence || 0,
      evidenceCount: response.evidence?.length || 0,
      hasPII: context.hasPII,
      hasHistoricalViolations: context.hasHistoricalViolations,
    };

    const riskResult = riskScorer.calculateRiskScoreSync(factors);

    let status: ValidationResult['status'];
    if (riskResult.level === 'high') {
      status = 'BLOCK';
    } else if (riskResult.level === 'medium') {
      status = 'WARN';
    } else {
      status = 'PASS';
    }

    const issues: string[] = [];
    if (response.confidence < 50) {
      issues.push('Low confidence response');
    }
    if (response.evidence?.length < 2) {
      issues.push('Insufficient evidence');
    }
    if (context.hasPII) {
      issues.push('Contains PII');
    }
    if (context.hasHistoricalViolations) {
      issues.push('Historical violations detected');
    }

    return {
      status,
      issues,
      riskScore: riskResult.score,
      riskLevel: riskResult.level,
      explanation: riskResult.explanation,
    };
  }
}
