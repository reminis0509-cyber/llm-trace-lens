import { describe, it, expect } from 'vitest';
import { ConfidenceValidator } from '../../validation/confidence.js';
import type { StructuredResponse } from '../../types/index.js';

describe('ConfidenceValidator', () => {
  const validator = new ConfidenceValidator();

  describe('高信頼度 + 十分なエビデンス', () => {
    it('confidence 90 + evidence 3個 → PASS', () => {
      const response: StructuredResponse = {
        answer: 'Test answer',
        confidence: 90,
        evidence: ['fact 1', 'fact 2', 'fact 3'],
        alternatives: []
      };

      const result = validator.validate(response);

      expect(result.status).toBe('PASS');
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('高信頼度 + エビデンス不足', () => {
    it('confidence 95 + evidence 1個 → WARN', () => {
      const response: StructuredResponse = {
        answer: 'Test answer',
        confidence: 95,
        evidence: ['only one fact'],
        alternatives: []
      };

      const result = validator.validate(response);

      expect(result.status).toBe('WARN');
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('confidence');
    });
  });

  describe('低信頼度', () => {
    it('confidence 40 → WARN', () => {
      const response: StructuredResponse = {
        answer: 'Test answer',
        confidence: 40,
        evidence: ['fact 1', 'fact 2'],
        alternatives: []
      };

      const result = validator.validate(response);

      expect(result.status).toBe('WARN');
      expect(result.issues.some(issue => issue.includes('Low confidence'))).toBe(true);
    });
  });

  describe('境界値テスト', () => {
    it('confidence 50 (境界) → PASS', () => {
      const response: StructuredResponse = {
        answer: 'Test answer',
        confidence: 50,
        evidence: ['fact 1', 'fact 2'],
        alternatives: []
      };

      const result = validator.validate(response);
      expect(result.status).toBe('PASS');
    });

    it('confidence 0 → WARN', () => {
      const response: StructuredResponse = {
        answer: 'Test answer',
        confidence: 0,
        evidence: [],
        alternatives: []
      };

      const result = validator.validate(response);
      expect(result.status).toBe('WARN');
    });
  });
});
