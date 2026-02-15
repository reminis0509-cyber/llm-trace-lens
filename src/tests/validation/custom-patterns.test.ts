import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StructuredResponse } from '../../types/index.js';

describe('Custom Validation Patterns', () => {
  describe('Pattern validation', () => {
    it('should validate valid regex patterns', () => {
      const validPatterns = [
        'badword',
        'confidential|secret',
        '\\b(password|passwd)\\b',
        'social-security-\\d{3}-\\d{2}-\\d{4}',
      ];

      for (const pattern of validPatterns) {
        expect(() => new RegExp(pattern)).not.toThrow();
      }
    });

    it('should detect invalid regex patterns', () => {
      const invalidPatterns = [
        '[invalid',
        '(unclosed',
        '*invalid',
        '+invalid',
      ];

      for (const pattern of invalidPatterns) {
        expect(() => new RegExp(pattern)).toThrow();
      }
    });
  });

  describe('Pattern matching', () => {
    it('should match simple word patterns', () => {
      const pattern = 'badword';
      const regex = new RegExp(pattern);

      expect(regex.test('This contains badword')).toBe(true);
      expect(regex.test('This is clean')).toBe(false);
    });

    it('should match OR patterns', () => {
      const pattern = 'secret|confidential|private';
      const regex = new RegExp(pattern, 'i'); // case-insensitive

      expect(regex.test('This is secret data')).toBe(true);
      expect(regex.test('Confidential information')).toBe(true);
      expect(regex.test('Private document')).toBe(true);
      expect(regex.test('Public data')).toBe(false);
    });

    it('should match word boundary patterns', () => {
      const pattern = '\\bpassword\\b';
      const regex = new RegExp(pattern);

      expect(regex.test('Enter your password')).toBe(true);
      expect(regex.test('passwordless auth')).toBe(false);
    });

    it('should match case-insensitive patterns', () => {
      const pattern = 'PASSWORD';
      const regex = new RegExp(pattern, 'i');

      expect(regex.test('PASSWORD')).toBe(true);
      expect(regex.test('password')).toBe(true);
      expect(regex.test('Password')).toBe(true);
    });

    it('should match Japanese text patterns', () => {
      const pattern = '機密|社外秘|極秘';
      const regex = new RegExp(pattern);

      expect(regex.test('この文書は機密です')).toBe(true);
      expect(regex.test('社外秘資料')).toBe(true);
      expect(regex.test('公開資料')).toBe(false);
    });
  });

  describe('Custom pattern scanning', () => {
    it('should scan structured response for patterns', () => {
      const response: StructuredResponse = {
        answer: 'The password is secret123',
        confidence: 80,
        evidence: ['User asked for password'],
        alternatives: ['Use a secure method'],
      };

      const patterns = ['password', 'secret'];
      const allText = [
        response.answer,
        ...response.evidence,
        ...response.alternatives,
      ].join(' ');

      const matches: string[] = [];
      for (const pattern of patterns) {
        const regex = new RegExp(pattern);
        if (regex.test(allText)) {
          matches.push(pattern);
        }
      }

      expect(matches).toContain('password');
      expect(matches).toContain('secret');
    });

    it('should combine standard and custom pattern scans', () => {
      const response: StructuredResponse = {
        answer: 'Contact us at test@example.com',
        confidence: 90,
        evidence: [],
        alternatives: [],
      };

      // Standard email pattern (from risk scanner)
      const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

      // Custom pattern
      const customPattern = /example\.com/;

      expect(emailPattern.test(response.answer)).toBe(true);
      expect(customPattern.test(response.answer)).toBe(true);
    });
  });

  describe('Pattern URL encoding', () => {
    it('should handle URL encoded patterns', () => {
      const pattern = 'test%20pattern';
      const decoded = decodeURIComponent(pattern);

      expect(decoded).toBe('test pattern');
      expect(new RegExp(decoded).test('this is a test pattern')).toBe(true);
    });

    it('should handle special characters in patterns', () => {
      const pattern = 'dollar%24sign';
      const decoded = decodeURIComponent(pattern);

      expect(decoded).toBe('dollar$sign');
    });
  });
});
