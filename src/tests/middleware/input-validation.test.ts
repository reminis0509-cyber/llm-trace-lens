import { describe, it, expect } from 'vitest';
import {
  containsSQLInjection,
  containsXSS,
  isInputSafe,
  validateObject,
  isValidWorkspaceId,
  isValidApiKeyFormat,
  isValidEmail,
} from '../../utils/sanitize.js';

describe('Input Validation (sanitize.ts)', () => {
  describe('containsSQLInjection', () => {
    it('SQLインジェクションパターンを検出する', () => {
      expect(containsSQLInjection("' OR 1=1")).toBe(true);
      expect(containsSQLInjection("'; DROP TABLE users")).toBe(true);
      expect(containsSQLInjection("UNION SELECT * FROM users")).toBe(true);
      expect(containsSQLInjection("; DELETE FROM traces")).toBe(true);
    });

    it('通常の入力は許可する', () => {
      expect(containsSQLInjection('Hello, how are you?')).toBe(false);
      expect(containsSQLInjection('What is the weather today?')).toBe(false);
      expect(containsSQLInjection('日本語のテスト入力')).toBe(false);
    });

    it('非文字列入力を安全として扱う', () => {
      expect(containsSQLInjection(123 as unknown as string)).toBe(false);
      expect(containsSQLInjection(null as unknown as string)).toBe(false);
    });
  });

  describe('containsXSS', () => {
    it('XSSパターンを検出する', () => {
      expect(containsXSS('<script>alert("xss")</script>')).toBe(true);
      expect(containsXSS('javascript:void(0)')).toBe(true);
      expect(containsXSS('<iframe src="evil.com">')).toBe(true);
    });

    it('通常のHTMLライクな入力は考慮する', () => {
      expect(containsXSS('This is <b>bold</b>')).toBe(false);
      expect(containsXSS('Use a <div> element')).toBe(false);
    });
  });

  describe('isInputSafe', () => {
    it('安全な入力にはsafe: trueを返す', () => {
      expect(isInputSafe('Hello world').safe).toBe(true);
      expect(isInputSafe('日本語テスト').safe).toBe(true);
    });

    it('危険な入力にはsafe: falseとreasonを返す', () => {
      const result = isInputSafe("' OR 1=1");
      expect(result.safe).toBe(false);
      expect(result.reason).toContain('SQL injection');
    });
  });

  describe('validateObject', () => {
    it('安全なオブジェクトを通過させる', () => {
      const result = validateObject({
        name: 'テスト',
        message: 'Hello world',
        count: 42,
      });
      expect(result.safe).toBe(true);
    });

    it('危険なフィールドを検出してフィールド名を返す', () => {
      const result = validateObject({
        name: 'テスト',
        query: "'; DROP TABLE users",
      });
      expect(result.safe).toBe(false);
      expect(result.field).toBe('query');
    });

    it('ネストされたオブジェクトもチェックする', () => {
      const result = validateObject({
        data: {
          nested: {
            field: '<script>alert("xss")</script>',
          },
        },
      });
      expect(result.safe).toBe(false);
      expect(result.field).toContain('nested');
    });
  });

  describe('isValidWorkspaceId', () => {
    it('有効なワークスペースIDを許可する', () => {
      expect(isValidWorkspaceId('workspace-123')).toBe(true);
      expect(isValidWorkspaceId('my_workspace')).toBe(true);
      expect(isValidWorkspaceId('abc')).toBe(true);
    });

    it('無効なワークスペースIDを拒否する', () => {
      expect(isValidWorkspaceId('')).toBe(false);
      expect(isValidWorkspaceId('a'.repeat(65))).toBe(false);
      expect(isValidWorkspaceId('../../etc')).toBe(false);
      expect(isValidWorkspaceId('workspace with spaces')).toBe(false);
      expect(isValidWorkspaceId('<script>')).toBe(false);
    });

    it('非文字列を拒否する', () => {
      expect(isValidWorkspaceId(123 as unknown as string)).toBe(false);
      expect(isValidWorkspaceId(null as unknown as string)).toBe(false);
    });
  });

  describe('isValidApiKeyFormat', () => {
    it('有効なAPIキーフォーマットを許可する', () => {
      const ltlKey = 'ltl_' + 'a'.repeat(48);
      expect(isValidApiKeyFormat(ltlKey)).toBe(true);
      expect(isValidApiKeyFormat('sk-' + 'a'.repeat(20))).toBe(true);
    });

    it('無効なAPIキーフォーマットを拒否する', () => {
      expect(isValidApiKeyFormat('')).toBe(false);
      expect(isValidApiKeyFormat('invalid-key')).toBe(false);
      expect(isValidApiKeyFormat('sk-short')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('有効なメールアドレスを許可する', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test+tag@domain.co.jp')).toBe(true);
    });

    it('無効なメールアドレスを拒否する', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@no-local.com')).toBe(false);
      expect(isValidEmail('a'.repeat(255) + '@example.com')).toBe(false);
    });
  });
});
