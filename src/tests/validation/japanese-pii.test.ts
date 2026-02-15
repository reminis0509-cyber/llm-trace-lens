import { describe, test, expect } from 'vitest';
import { RiskScanner } from '../../validation/risk.js';

describe('Japanese PII Detection', () => {
  const scanner = new RiskScanner();

  describe('My Number (マイナンバー) detection', () => {
    test('detects My Number with context label "マイナンバー"', () => {
      const result = scanner.scan({
        answer: 'マイナンバーは 1234-5678-9012 です',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('BLOCK');
      expect(result.issues).toContainEqual(expect.stringMatching(/My Number|マイナンバー/i));
    });

    test('detects My Number with context label "個人番号"', () => {
      const result = scanner.scan({
        answer: '個人番号: 1234 5678 9012',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('BLOCK');
    });

    test('warns on 12-digit number without context', () => {
      const result = scanner.scan({
        answer: '番号は 123456789012 です',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
      expect(result.issues).toContainEqual(expect.stringMatching(/12 digits|My Number/i));
    });
  });

  describe('Bank account detection', () => {
    test('blocks bank account number with context', () => {
      const result = scanner.scan({
        answer: '口座番号: 123-4567890',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('BLOCK');
      expect(result.issues).toContainEqual(expect.stringMatching(/Bank account|口座/i));
    });

    test('blocks account number with English context', () => {
      const result = scanner.scan({
        answer: 'account number: 1234567890',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('BLOCK');
    });
  });

  describe('Phone number detection', () => {
    test('detects phone number with Japanese context', () => {
      const result = scanner.scan({
        answer: '電話番号は 03-1234-5678 です',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
      expect(result.issues).toContainEqual(expect.stringMatching(/phone/i));
    });

    test('detects mobile phone number (090)', () => {
      const result = scanner.scan({
        answer: '携帯: 090-1234-5678',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
      expect(result.issues).toContainEqual(expect.stringMatching(/mobile|phone/i));
    });

    test('detects mobile phone number (080)', () => {
      const result = scanner.scan({
        answer: '連絡先: 080-9876-5432',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
    });

    test('detects mobile phone number (070)', () => {
      const result = scanner.scan({
        answer: '070-1111-2222 に連絡',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
    });
  });

  describe('Postal code detection', () => {
    test('warns on Japanese postal code with 〒 symbol', () => {
      const result = scanner.scan({
        answer: '〒123-4567',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
      expect(result.issues).toContainEqual(expect.stringMatching(/postal/i));
    });

    test('warns on Japanese postal code without symbol', () => {
      const result = scanner.scan({
        answer: '郵便番号: 100-0001',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
    });
  });

  describe('Corporate Number (法人番号) detection', () => {
    test('warns on 13-digit corporate number', () => {
      const result = scanner.scan({
        answer: '法人番号: 1234567890123',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
      expect(result.issues).toContainEqual(expect.stringMatching(/Corporate Number|法人番号/i));
    });
  });

  describe('Multiple PII detection', () => {
    test('detects multiple Japanese PII in same text', () => {
      const result = scanner.scan({
        answer: 'マイナンバーは 1234-5678-9012、電話番号は 090-1234-5678 です',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('BLOCK'); // My Number with context -> BLOCK
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    });

    test('detects Japanese PII mixed with US PII', () => {
      const result = scanner.scan({
        answer: 'SSN: 123-45-6789, マイナンバー: 1234-5678-9012',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('BLOCK');
      expect(result.issues).toContainEqual(expect.stringMatching(/SSN/i));
      expect(result.issues).toContainEqual(expect.stringMatching(/My Number|マイナンバー/i));
    });
  });

  describe('No PII detection', () => {
    test('passes clean Japanese text', () => {
      const result = scanner.scan({
        answer: '本日は晴れです。よろしくお願いします。',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('PASS');
      expect(result.issues.length).toBe(0);
    });

    test('passes text with random numbers', () => {
      const result = scanner.scan({
        answer: '製品番号ABC-123は在庫が500個あります',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('PASS');
    });
  });
});
