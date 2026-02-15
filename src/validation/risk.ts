import type { StructuredResponse } from '../types/index.js';
import { getCustomPatterns } from '../kv/client.js';

export interface ScanResult {
  status: 'PASS' | 'WARN' | 'BLOCK';
  issues: string[];
}

export interface ScanResultWithWorkspace extends ScanResult {
  customPatternMatches?: Array<{ pattern: string; match: string }>;
}

interface DetectedPII {
  type: string;
  severity: 'BLOCK' | 'WARN';
  description: string;
  evidence?: string;
}

/**
 * Risk Scanner
 * - PII detection (credit cards, SSN, email)
 * - Japanese PII detection (My Number, bank account, phone)
 * - Sensitive data detection
 */
export class RiskScanner {
  // BLOCK patterns - sensitive PII
  private readonly BLOCK_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/, name: 'SSN' },
    { pattern: /\b\d{16}\b/, name: 'credit card' },
    { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, name: 'credit card' },
    { pattern: /\bsk-[a-zA-Z0-9]{32,}\b/, name: 'OpenAI API Key' },
    { pattern: /\bAKIA[A-Z0-9]{16}\b/, name: 'AWS Access Key' },
  ];

  // WARN patterns - potentially sensitive
  private readonly WARN_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, name: 'email' },
  ];

  // Japanese PII patterns
  private readonly JAPANESE_PII_PATTERNS: Array<{
    pattern: RegExp;
    name: string;
    severity: 'BLOCK' | 'WARN';
    description: string;
  }> = [
    // My Number with context (high confidence) -> BLOCK
    {
      pattern: /(?:マイナンバー|個人番号|My\s?Number)[\s:：は]+(\d{4}[\s-]?\d{4}[\s-]?\d{4})/gi,
      name: 'mynumber_context',
      severity: 'BLOCK',
      description: 'Japanese My Number (マイナンバー)',
    },
    // Bank account with context -> BLOCK
    {
      pattern: /(?:口座番号|銀行口座|account\s?number)[\s:：は]+(\d{3})[\s-]?(\d{7})/gi,
      name: 'bank_context',
      severity: 'BLOCK',
      description: 'Bank account number',
    },
    // 12-digit number (possible My Number) -> WARN
    {
      pattern: /\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g,
      name: 'mynumber',
      severity: 'WARN',
      description: 'Possible My Number (12 digits)',
    },
    // Corporate Number (13 digits) -> WARN
    {
      pattern: /\b\d{13}\b/g,
      name: 'corporate',
      severity: 'WARN',
      description: 'Japanese Corporate Number (法人番号)',
    },
    // Phone number with context -> WARN
    {
      pattern: /(?:電話番号|tel|phone)[\s:：は]+(0\d{1,4}[\s-]?\d{1,4}[\s-]?\d{4})/gi,
      name: 'phone_context',
      severity: 'WARN',
      description: 'Japanese phone number',
    },
    // Mobile phone -> WARN
    {
      pattern: /\b0[789]0[\s-]?\d{4}[\s-]?\d{4}\b/g,
      name: 'mobile',
      severity: 'WARN',
      description: 'Japanese mobile phone',
    },
    // Postal code -> WARN
    {
      pattern: /[〒]?\d{3}[-\s]?\d{4}/g,
      name: 'postal',
      severity: 'WARN',
      description: 'Japanese postal code',
    },
  ];

  scan(response: StructuredResponse): ScanResult {
    const issues: string[] = [];
    let status: ScanResult['status'] = 'PASS';

    // Combine all text fields for scanning
    const allText = [
      response.answer,
      ...response.evidence,
      ...response.alternatives,
    ].join(' ');

    // Check BLOCK patterns
    for (const { pattern, name } of this.BLOCK_PATTERNS) {
      if (pattern.test(allText)) {
        issues.push(`Detected potential ${name}`);
        status = 'BLOCK';
      }
    }

    // Check Japanese PII patterns
    const japanesePII = this.scanJapanesePII(allText);
    for (const pii of japanesePII) {
      issues.push(pii.description);
      if (pii.severity === 'BLOCK') {
        status = 'BLOCK';
      } else if (status === 'PASS') {
        status = 'WARN';
      }
    }

    // Also check WARN patterns (always add issues, but don't downgrade status)
    for (const { pattern, name } of this.WARN_PATTERNS) {
      if (pattern.test(allText)) {
        issues.push(`Detected potential ${name}`);
        if (status === 'PASS') {
          status = 'WARN';
        }
      }
    }

    return { status, issues };
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
        if (piiPattern.name === 'mynumber') {
          const digits = fullMatch.replace(/[\s-]/g, '');
          // Skip if it's actually 13 digits (corporate number)
          if (digits.length !== 12) {
            continue;
          }
          // Skip if already detected with context
          if (detected.some(d => d.type === 'mynumber_context')) {
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
    const digitOnly = clean.replace(/[^\d]/g, '');

    if (digitOnly.length <= 4) {
      return '***';
    }

    return digitOnly.slice(0, 2) + '***' + digitOnly.slice(-2);
  }

  /**
   * Scan with workspace-specific custom patterns
   */
  async scanWithCustomPatterns(
    response: StructuredResponse,
    workspaceId: string
  ): Promise<ScanResultWithWorkspace> {
    // First run the standard scan
    const baseResult = this.scan(response);

    const result: ScanResultWithWorkspace = {
      ...baseResult,
      customPatternMatches: []
    };

    // Get custom patterns for this workspace
    try {
      const customPatterns = await getCustomPatterns(workspaceId);

      if (customPatterns.length === 0) {
        return result;
      }

      // Combine all text fields for scanning
      const allText = [
        response.answer,
        ...response.evidence,
        ...response.alternatives,
      ].join(' ');

      // Check each custom pattern
      for (const pattern of customPatterns) {
        try {
          const regex = new RegExp(pattern);
          const match = allText.match(regex);

          if (match) {
            result.customPatternMatches!.push({
              pattern,
              match: match[0]
            });
            result.issues.push(`Matched custom pattern: ${pattern}`);

            // Custom patterns trigger high risk (BLOCK)
            if (result.status !== 'BLOCK') {
              result.status = 'BLOCK';
            }
          }
        } catch (error) {
          // Skip invalid regex patterns
          console.warn(`Invalid custom pattern: ${pattern}`);
        }
      }
    } catch (error) {
      console.error('Failed to get custom patterns:', error);
    }

    return result;
  }

  /**
   * Scan text with custom patterns (utility method)
   */
  async scanTextWithPatterns(
    text: string,
    workspaceId: string
  ): Promise<{ risk: 'high' | 'low'; matchedPatterns: string[] }> {
    const matchedPatterns: string[] = [];

    try {
      const customPatterns = await getCustomPatterns(workspaceId);

      for (const pattern of customPatterns) {
        try {
          const regex = new RegExp(pattern);
          if (regex.test(text)) {
            matchedPatterns.push(pattern);
          }
        } catch (error) {
          // Skip invalid regex patterns
        }
      }
    } catch (error) {
      console.error('Failed to scan text with patterns:', error);
    }

    return {
      risk: matchedPatterns.length > 0 ? 'high' : 'low',
      matchedPatterns
    };
  }
}
