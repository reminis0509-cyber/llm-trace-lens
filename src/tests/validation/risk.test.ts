import { describe, it, expect } from 'vitest';
import { RiskScanner } from '../../validation/risk.js';
import type { StructuredResponse } from '../../types/index.js';

describe('RiskScanner', () => {
  const scanner = new RiskScanner();

  describe('PII検出 - クレジットカード番号', () => {
    it('16桁のカード番号を検出 → BLOCK', () => {
      const response: StructuredResponse = {
        answer: 'Your credit card number is 4532-1234-5678-9010',
        confidence: 80,
        evidence: [],
        alternatives: []
      };

      const result = scanner.scan(response);

      expect(result.status).toBe('BLOCK');
      expect(result.issues.some(issue => issue.includes('credit card'))).toBe(true);
    });

    it('ハイフンなしのカード番号も検出 → BLOCK', () => {
      const response: StructuredResponse = {
        answer: 'Card: 4532123456789010',
        confidence: 80,
        evidence: [],
        alternatives: []
      };

      const result = scanner.scan(response);
      expect(result.status).toBe('BLOCK');
    });
  });

  describe('PII検出 - メールアドレス', () => {
    it('メールアドレスを検出 → WARN', () => {
      const response: StructuredResponse = {
        answer: 'Contact us at user@example.com for more info',
        confidence: 80,
        evidence: [],
        alternatives: []
      };

      const result = scanner.scan(response);

      expect(result.status).toBe('WARN');
      expect(result.issues.some(issue => issue.includes('email'))).toBe(true);
    });
  });

  describe('PII検出 - SSN', () => {
    it('SSN形式を検出 → BLOCK', () => {
      const response: StructuredResponse = {
        answer: 'SSN: 123-45-6789',
        confidence: 80,
        evidence: [],
        alternatives: []
      };

      const result = scanner.scan(response);

      expect(result.status).toBe('BLOCK');
      expect(result.issues.some(issue => issue.includes('SSN'))).toBe(true);
    });
  });

  describe('クリーンなレスポンス', () => {
    it('PII含まず → PASS', () => {
      const response: StructuredResponse = {
        answer: 'The weather is nice today. Temperature is 22 degrees.',
        confidence: 85,
        evidence: ['Weather report from local station'],
        alternatives: ['It might rain tomorrow']
      };

      const result = scanner.scan(response);

      expect(result.status).toBe('PASS');
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('複数PII検出', () => {
    it('メール + カード番号 → BLOCK (最も厳しいステータス)', () => {
      const response: StructuredResponse = {
        answer: 'Email: test@test.com, Card: 4532123456789010',
        confidence: 80,
        evidence: [],
        alternatives: []
      };

      const result = scanner.scan(response);
      expect(result.status).toBe('BLOCK');
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    });
  });
});
