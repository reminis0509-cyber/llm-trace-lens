import type {
  ValidationRule,
  RuleResult,
  LegacyStructuredResponse,
  InternalTrace,
} from '../../types/index.js';

interface DetectedPII {
  type: string;
  severity: 'BLOCK' | 'WARN';
  description: string;
  evidence?: string;
}

/**
 * リスクスキャナ
 * - PII検出（SSN、クレジットカード番号など）
 * - 日本語PII検出（マイナンバー、銀行口座番号など）
 * - 機密キーワード検出
 * - APIキー/パスワード露出検出
 */
export class RiskScanner implements ValidationRule {
  readonly name = 'risk_scanner';

  // ブロック対象パターン（PII、機密情報）
  private readonly BLOCKED_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/, name: 'SSN' },
    { pattern: /\b\d{16}\b/, name: 'Credit Card' },
    { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, name: 'Credit Card (formatted)' },
    { pattern: /password\s*[:=]\s*['"]?[^\s'"]+['"]?/i, name: 'Password' },
    { pattern: /api[_-]?key\s*[:=]\s*['"]?[^\s'"]+['"]?/i, name: 'API Key' },
    { pattern: /secret[_-]?key\s*[:=]\s*['"]?[^\s'"]+['"]?/i, name: 'Secret Key' },
    { pattern: /\bsk-[a-zA-Z0-9]{32,}\b/, name: 'OpenAI API Key' },
    { pattern: /\bAKIA[A-Z0-9]{16}\b/, name: 'AWS Access Key' },
  ];

  // 日本語PIIパターン
  private readonly JAPANESE_PII_PATTERNS: Array<{
    pattern: RegExp;
    name: string;
    severity: 'BLOCK' | 'WARN';
    description: string;
  }> = [
    // マイナンバー（12桁）- コンテキスト付き（高確度）
    {
      pattern: /(?:マイナンバー|個人番号|My\s?Number)[\s:：は]+(\d{4}[\s-]?\d{4}[\s-]?\d{4})/gi,
      name: 'japanese_pii_mynumber_context',
      severity: 'BLOCK',
      description: 'Japanese My Number (マイナンバー) with context',
    },
    // マイナンバー（12桁のみ） - 低確度
    {
      pattern: /\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g,
      name: 'japanese_pii_mynumber',
      severity: 'WARN',
      description: 'Possible Japanese My Number (12 digits)',
    },
    // 法人番号（13桁）
    {
      pattern: /\b\d{13}\b/g,
      name: 'japanese_pii_corporate',
      severity: 'WARN',
      description: 'Japanese Corporate Number (法人番号, 13 digits)',
    },
    // 銀行口座番号（店番3桁 + 口座番号7桁） - コンテキスト付き
    {
      pattern: /(?:口座番号|銀行口座|account\s?number)[\s:：は]+(\d{3})[\s-]?(\d{7})/gi,
      name: 'japanese_pii_bank_context',
      severity: 'BLOCK',
      description: 'Bank account number with context',
    },
    // 電話番号（日本） - コンテキスト付き
    {
      pattern: /(?:電話番号|tel|phone)[\s:：は]+(0\d{1,4}[\s-]?\d{1,4}[\s-]?\d{4})/gi,
      name: 'japanese_pii_phone_context',
      severity: 'WARN',
      description: 'Japanese phone number with context',
    },
    // 電話番号（市外局番から始まる）
    {
      pattern: /\b0\d{1,4}[\s-]?\d{1,4}[\s-]?\d{4}\b/g,
      name: 'japanese_pii_phone',
      severity: 'WARN',
      description: 'Japanese phone number',
    },
    // 携帯電話番号
    {
      pattern: /\b0[789]0[\s-]?\d{4}[\s-]?\d{4}\b/g,
      name: 'japanese_pii_mobile',
      severity: 'WARN',
      description: 'Japanese mobile phone number',
    },
    // 郵便番号
    {
      pattern: /[〒]?\d{3}[-\s]?\d{4}/g,
      name: 'japanese_pii_postal',
      severity: 'WARN',
      description: 'Japanese postal code',
    },
  ];

  // 警告対象キーワード
  private readonly SENSITIVE_KEYWORDS = [
    '機密',
    'confidential',
    '社外秘',
    'internal only',
    'do not share',
    '取扱注意',
    'proprietary',
  ];

  async validate(
    structured: LegacyStructuredResponse,
    _internalTrace: InternalTrace | null
  ): Promise<RuleResult> {
    // 全テキストを結合
    const allText = [
      structured.thinking,
      structured.answer,
      ...structured.evidence,
      ...structured.risks,
    ].join(' ');

    const detectedPII: DetectedPII[] = [];

    // PII/機密データ検出 → BLOCK
    for (const { pattern, name } of this.BLOCKED_PATTERNS) {
      if (pattern.test(allText)) {
        detectedPII.push({
          type: name,
          severity: 'BLOCK',
          description: `Detected potential sensitive data: ${name}`,
        });
      }
    }

    // 日本語PII検出
    const japanesePII = this.scanJapanesePII(allText);
    detectedPII.push(...japanesePII);

    // 最も厳しい結果を返す
    const hasBlock = detectedPII.some(p => p.severity === 'BLOCK');
    if (hasBlock) {
      const blockIssues = detectedPII.filter(p => p.severity === 'BLOCK');
      return {
        ruleName: this.name,
        level: 'BLOCK',
        message: blockIssues.map(p => p.description).join('; '),
        metadata: {
          detectedPII: blockIssues.map(p => ({
            type: p.type,
            evidence: p.evidence,
          })),
        },
      };
    }

    // 機密キーワード検出 → WARN
    const foundKeywords = this.SENSITIVE_KEYWORDS.filter((kw) =>
      allText.toLowerCase().includes(kw.toLowerCase())
    );

    const hasWarn = detectedPII.some(p => p.severity === 'WARN') || foundKeywords.length > 0;
    if (hasWarn) {
      const warnMessages: string[] = [];

      if (foundKeywords.length > 0) {
        warnMessages.push(`Found sensitive keywords: ${foundKeywords.join(', ')}`);
      }

      const warnPII = detectedPII.filter(p => p.severity === 'WARN');
      if (warnPII.length > 0) {
        warnMessages.push(...warnPII.map(p => p.description));
      }

      return {
        ruleName: this.name,
        level: 'WARN',
        message: warnMessages.join('; '),
        metadata: {
          keywords: foundKeywords,
          detectedPII: warnPII.map(p => ({
            type: p.type,
            evidence: p.evidence,
          })),
        },
      };
    }

    return {
      ruleName: this.name,
      level: 'PASS',
      message: 'No sensitive data detected',
    };
  }

  private scanJapanesePII(text: string): DetectedPII[] {
    const detected: DetectedPII[] = [];
    const alreadyDetected = new Set<string>();

    for (const piiPattern of this.JAPANESE_PII_PATTERNS) {
      // Reset regex state for global patterns
      piiPattern.pattern.lastIndex = 0;

      let match;
      while ((match = piiPattern.pattern.exec(text)) !== null) {
        const fullMatch = match[0];
        const maskedEvidence = this.maskSensitive(fullMatch);

        // Skip duplicates
        if (alreadyDetected.has(maskedEvidence)) {
          continue;
        }

        // Special handling for 12-digit numbers (My Number)
        if (piiPattern.name === 'japanese_pii_mynumber') {
          const digits = fullMatch.replace(/[\s-]/g, '');
          // Skip if it's actually 13 digits (corporate number)
          if (digits.length !== 12) {
            continue;
          }
          // Skip if already detected with context
          if (detected.some(d => d.type === 'japanese_pii_mynumber_context')) {
            continue;
          }
        }

        alreadyDetected.add(maskedEvidence);
        detected.push({
          type: piiPattern.name,
          severity: piiPattern.severity,
          description: piiPattern.description,
          evidence: maskedEvidence,
        });
      }
    }

    return detected;
  }

  private maskSensitive(text: string): string {
    const clean = text.replace(/[\s-:：は]/g, '');
    // Remove Japanese prefixes for masking
    const digitOnly = clean.replace(/[^\d]/g, '');

    if (digitOnly.length <= 4) {
      return '***';
    }

    // Show first 2 and last 2 digits
    return digitOnly.slice(0, 2) + '***' + digitOnly.slice(-2);
  }
}
