import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RiskScorer, type RiskFactors } from '../../validation/scoring.js';

// Mock the kv client
vi.mock('../../kv/client.js', () => ({
  getValidationConfig: vi.fn().mockResolvedValue(null),
}));

describe('RiskScorer', () => {
  let scorer: RiskScorer;

  beforeEach(() => {
    scorer = new RiskScorer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateRiskScoreSync (default weights)', () => {
    it('should calculate high risk for low confidence + PII', () => {
      const factors: RiskFactors = {
        confidence: 30,
        evidenceCount: 0,
        hasPII: true,
        hasHistoricalViolations: false,
      };

      const result = scorer.calculateRiskScoreSync(factors);

      expect(result.level).toBe('high');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.explanation).toContain('リスクが高い');
    });

    it('should calculate low risk for high confidence + evidence', () => {
      const factors: RiskFactors = {
        confidence: 95,
        evidenceCount: 5,
        hasPII: false,
        hasHistoricalViolations: false,
      };

      const result = scorer.calculateRiskScoreSync(factors);

      expect(result.level).toBe('low');
      expect(result.score).toBeLessThan(40);
      expect(result.explanation).toContain('リスクは低い');
    });

    it('should calculate medium risk for moderate confidence', () => {
      const factors: RiskFactors = {
        confidence: 50,
        evidenceCount: 1,
        hasPII: false,
        hasHistoricalViolations: false,
      };
      // confidenceScore = 100 - 50 = 50
      // evidenceScore = 100 - 1*20 = 80
      // rawScore = 50*0.4 + 80*0.3 = 20 + 24 = 44 → medium

      const result = scorer.calculateRiskScoreSync(factors);

      expect(result.level).toBe('medium');
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThan(70);
    });

    it('should increase risk score when PII is present', () => {
      const factorsWithoutPII: RiskFactors = {
        confidence: 80,
        evidenceCount: 3,
        hasPII: false,
        hasHistoricalViolations: false,
      };

      const factorsWithPII: RiskFactors = {
        confidence: 80,
        evidenceCount: 3,
        hasPII: true,
        hasHistoricalViolations: false,
      };

      const resultWithoutPII = scorer.calculateRiskScoreSync(factorsWithoutPII);
      const resultWithPII = scorer.calculateRiskScoreSync(factorsWithPII);

      expect(resultWithPII.score).toBeGreaterThan(resultWithoutPII.score);
    });

    it('should increase risk score when historical violations exist', () => {
      const factorsWithoutHistory: RiskFactors = {
        confidence: 80,
        evidenceCount: 3,
        hasPII: false,
        hasHistoricalViolations: false,
      };

      const factorsWithHistory: RiskFactors = {
        confidence: 80,
        evidenceCount: 3,
        hasPII: false,
        hasHistoricalViolations: true,
      };

      const resultWithoutHistory = scorer.calculateRiskScoreSync(factorsWithoutHistory);
      const resultWithHistory = scorer.calculateRiskScoreSync(factorsWithHistory);

      expect(resultWithHistory.score).toBeGreaterThan(resultWithoutHistory.score);
    });
  });

  describe('calculateRiskScore (async with workspace config)', () => {
    it('should use default weights when no config exists', async () => {
      const factors: RiskFactors = {
        confidence: 50,
        evidenceCount: 2,
        hasPII: false,
        hasHistoricalViolations: false,
      };

      const result = await scorer.calculateRiskScore('workspace-1', factors);

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('explanation');
      expect(['low', 'medium', 'high']).toContain(result.level);
    });
  });

  describe('explanation generation', () => {
    it('should mention low confidence in explanation', () => {
      const factors: RiskFactors = {
        confidence: 30,
        evidenceCount: 3,
        hasPII: false,
        hasHistoricalViolations: false,
      };

      const result = scorer.calculateRiskScoreSync(factors);

      expect(result.explanation).toContain('信頼度が低い');
    });

    it('should mention high confidence in explanation', () => {
      const factors: RiskFactors = {
        confidence: 95,
        evidenceCount: 3,
        hasPII: false,
        hasHistoricalViolations: false,
      };

      const result = scorer.calculateRiskScoreSync(factors);

      expect(result.explanation).toContain('信頼度が高い');
    });

    it('should mention insufficient evidence in explanation', () => {
      const factors: RiskFactors = {
        confidence: 70,
        evidenceCount: 0,
        hasPII: false,
        hasHistoricalViolations: false,
      };

      const result = scorer.calculateRiskScoreSync(factors);

      expect(result.explanation).toContain('根拠が不足');
    });

    it('should mention PII in explanation', () => {
      const factors: RiskFactors = {
        confidence: 70,
        evidenceCount: 3,
        hasPII: true,
        hasHistoricalViolations: false,
      };

      const result = scorer.calculateRiskScoreSync(factors);

      expect(result.explanation).toContain('個人情報');
    });

    it('should mention historical violations in explanation', () => {
      const factors: RiskFactors = {
        confidence: 70,
        evidenceCount: 3,
        hasPII: false,
        hasHistoricalViolations: true,
      };

      const result = scorer.calculateRiskScoreSync(factors);

      expect(result.explanation).toContain('過去に類似の違反');
    });
  });

  describe('score bounds', () => {
    it('should never return score below 0', () => {
      const factors: RiskFactors = {
        confidence: 100,
        evidenceCount: 10,
        hasPII: false,
        hasHistoricalViolations: false,
      };

      const result = scorer.calculateRiskScoreSync(factors);

      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should never return score above 100', () => {
      const factors: RiskFactors = {
        confidence: 0,
        evidenceCount: 0,
        hasPII: true,
        hasHistoricalViolations: true,
      };

      const result = scorer.calculateRiskScoreSync(factors);

      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});
