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

    test('detects mobile without hyphens (09012345678)', () => {
      const result = scanner.scan({
        answer: '携帯番号は09012345678です',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
      expect(result.issues).toContainEqual(expect.stringMatching(/mobile|phone/i));
    });

    test('detects international format (+81-90-1234-5678)', () => {
      const result = scanner.scan({
        answer: '連絡先: +81-90-1234-5678',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
      expect(result.issues).toContainEqual(expect.stringMatching(/international|mobile|phone/i));
    });

    test('detects international format without hyphens (+819012345678)', () => {
      const result = scanner.scan({
        answer: '電話+819012345678まで',
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

    test('warns on postal code NNN-NNNN format', () => {
      const result = scanner.scan({
        answer: '住所は 150-0002 渋谷区渋谷',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
      expect(result.issues).toContainEqual(expect.stringMatching(/postal/i));
    });
  });

  describe('Passport number detection', () => {
    test('blocks passport number with context', () => {
      const result = scanner.scan({
        answer: 'パスポート番号: TK1234567',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('BLOCK');
      expect(result.issues).toContainEqual(expect.stringMatching(/passport|旅券/i));
    });

    test('warns on possible passport number without context', () => {
      const result = scanner.scan({
        answer: '番号はTK1234567です',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
      expect(result.issues).toContainEqual(expect.stringMatching(/passport/i));
    });
  });

  describe('Health insurance card detection', () => {
    test('blocks insurance card number with context', () => {
      const result = scanner.scan({
        answer: '保険証番号: 12345678',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('BLOCK');
      expect(result.issues).toContainEqual(expect.stringMatching(/insurance|保険証/i));
    });

    test('blocks with 被保険者番号 context', () => {
      const result = scanner.scan({
        answer: '被保険者番号は 0123456789 です',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('BLOCK');
    });
  });

  describe("Driver's license detection", () => {
    test('blocks license number with context', () => {
      const result = scanner.scan({
        answer: '免許証番号: 012345678901',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('BLOCK');
      expect(result.issues).toContainEqual(expect.stringMatching(/license|免許証/i));
    });

    test('blocks with 運転免許 context', () => {
      const result = scanner.scan({
        answer: '運転免許: 012345678901',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('BLOCK');
    });
  });

  describe('Japanese address detection', () => {
    test('warns on Japanese address with 都 (Tokyo)', () => {
      const result = scanner.scan({
        answer: '住所は東京都渋谷区です',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
      expect(result.issues).toContainEqual(expect.stringMatching(/address|住所/i));
    });

    test('warns on Japanese address with 県', () => {
      const result = scanner.scan({
        answer: '神奈川県横浜市に住んでいます',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
      expect(result.issues).toContainEqual(expect.stringMatching(/address|住所/i));
    });

    test('warns on Japanese address with 北海道', () => {
      const result = scanner.scan({
        answer: '北海道札幌市の事務所',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
    });

    test('warns on Japanese address with 大阪府', () => {
      const result = scanner.scan({
        answer: '大阪府大阪市北区',
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

  describe('Full-width number support (全角数字)', () => {
    test('detects full-width phone number with context', () => {
      const result = scanner.scan({
        answer: '電話番号は ０３−１２３４−５６７８',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
      expect(result.issues).toContainEqual(expect.stringMatching(/phone/i));
    });

    test('detects full-width mobile phone number', () => {
      const result = scanner.scan({
        answer: '０９０−１２３４−５６７８',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
      expect(result.issues).toContainEqual(expect.stringMatching(/mobile|phone/i));
    });

    test('detects full-width My Number with context', () => {
      const result = scanner.scan({
        answer: 'マイナンバー １２３４ ５６７８ ９０１２',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('BLOCK');
      expect(result.issues).toContainEqual(expect.stringMatching(/My Number|マイナンバー/i));
    });
  });

  describe('Japanese name detection (氏名)', () => {
    test('detects Japanese name with context label', () => {
      const result = scanner.scan({
        answer: '氏名: 山田 太郎',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
      expect(result.issues).toContainEqual(expect.stringMatching(/Japanese name|氏名/i));
    });

    test('detects katakana name with furigana context', () => {
      const result = scanner.scan({
        answer: 'フリガナ: ヤマダ タロウ',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('WARN');
      expect(result.issues).toContainEqual(expect.stringMatching(/katakana|カタカナ/i));
    });
  });

  describe('Residence card number detection (在留カード)', () => {
    test('blocks residence card number with context', () => {
      const result = scanner.scan({
        answer: '在留カード番号: AB12345678C',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('BLOCK');
      expect(result.issues).toContainEqual(expect.stringMatching(/Residence card|在留カード/i));
    });
  });

  describe('Pension number detection (年金番号)', () => {
    test('blocks pension number with context', () => {
      const result = scanner.scan({
        answer: '基礎年金番号: 1234-567890',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('BLOCK');
      expect(result.issues).toContainEqual(expect.stringMatching(/Pension|年金/i));
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

    test('passes clean Japanese text without PII', () => {
      const result = scanner.scan({
        answer: '東京の天気は晴れです',
        confidence: 0.9,
        evidence: [],
        alternatives: [],
      });
      expect(result.status).toBe('PASS');
      expect(result.issues.length).toBe(0);
    });
  });
});
