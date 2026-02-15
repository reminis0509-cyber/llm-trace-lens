import type { StructuredResponse } from '../types/index.js';
import { getCustomPatterns } from '../kv/client.js';

// ─── 評価指標用パターン定義 ───────────────────────────────────────────────────

/** 有害コンテンツ（Toxicity）パターン */
export const TOXICITY_PATTERNS: RegExp[] = [
  // 英語：暴力・ヘイト
  /\b(kill|murder|assault|rape|torture|genocide)\b/i,
  /\b(hate|despise)\s+(all\s+)?(jews|muslims|christians|blacks|whites|asians|lgbtq|women|men)\b/i,
  /\b(nigger|faggot|kike|spic|chink|gook|cunt)\b/i,
  /\b(terrorist|terrorism|bomb\s+making|make\s+a\s+bomb)\b/i,
  /\b(go\s+kill\s+yourself|you\s+should\s+die|i\s+will\s+kill\s+you)\b/i,
  // 日本語：差別・誹謗中傷・暴力表現
  /死ね|殺す|殺してやる|消えろ/,
  /バカ|アホ|クズ|ゴミ|カス|キモい|うざい|邪魔/,
  /在日|チョン|チャンコロ|ニガー|土人/,
  /自殺しろ|首吊れ|飛び降りろ/,
  /爆弾の作り方|爆発物|毒物の合成/,
];

/** プロンプトインジェクション（Prompt Injection）パターン */
export const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  // 英語
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /forget\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /act\s+as\s+(if\s+you\s+are|a|an)\s+/i,
  /new\s+instructions?:/i,
  /system\s*:\s*/i,
  /\[system\]/i,
  /<\s*system\s*>/i,
  /your\s+true\s+self/i,
  /pretend\s+(you\s+are|to\s+be)\s+/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  // 日本語
  /これまでの指示を無視/,
  /以前の指示を無視/,
  /今までの指示を忘れ/,
  /あなたは今から/,
  /新しい指示:/,
  /システム:/,
  /本当のあなた/,
  /制約を無視/,
  /フィルターを外/,
  /ロールプレイ.*制限なし/,
  /脱獄/,
];

/** 回答拒否（Failure to Answer）パターン */
export const FAILURE_TO_ANSWER_PATTERNS: RegExp[] = [
  // 英語
  /i\s+(cannot|can't|am\s+unable\s+to|am\s+not\s+able\s+to)\s+(answer|respond|help|assist)/i,
  /i\s+(don't|do\s+not)\s+have\s+(the\s+)?(ability|capability|capacity)\s+to/i,
  /this\s+is\s+(beyond|outside)\s+(my|the\s+(scope|bounds)\s+of)/i,
  /i\s+(must|have\s+to)\s+decline/i,
  /i\s+apologize,?\s+but\s+i\s+(cannot|can't)/i,
  /that('s|\s+is)\s+(not\s+something\s+i\s+can|outside\s+(my|what\s+i\s+can))/i,
  /i'm\s+(sorry|afraid)\s+i\s+can'?t/i,
  // 日本語
  /お答えできません/,
  /回答できません/,
  /回答いたしかねます/,
  /お答えいたしかねます/,
  /申し訳(ありません|ございません|ございますが).{0,20}(できません|いたしかねます)/,
  /ご質問にはお答えできません/,
  /その質問には答えられません/,
  /私には(お答えする|回答する)ことができません/,
  /対応できかねます/,
  /範囲外のため/,
];

/** 評価カテゴリの型 */
export type EvaluationCategory = 'toxicity' | 'promptInjection' | 'failureToAnswer';

/** パターンスキャンの結果 */
export interface PatternScanResult {
  flagged: boolean;
  score: number;
  matchedPatterns: string[];
  category: EvaluationCategory;
}

const PATTERN_MAP: Record<EvaluationCategory, RegExp[]> = {
  toxicity: TOXICITY_PATTERNS,
  promptInjection: PROMPT_INJECTION_PATTERNS,
  failureToAnswer: FAILURE_TO_ANSWER_PATTERNS,
};

/**
 * 指定したカテゴリのパターンでテキストをスキャンする
 * @param text スキャン対象テキスト
 * @param categories チェックするカテゴリ一覧
 * @returns カテゴリごとのスキャン結果
 */
export function scanForPatterns(
  text: string,
  categories: EvaluationCategory[]
): Record<EvaluationCategory, PatternScanResult> {
  const results = {} as Record<EvaluationCategory, PatternScanResult>;

  for (const category of categories) {
    const patterns = PATTERN_MAP[category];
    if (!patterns) continue;

    const matched: string[] = [];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        matched.push(match[0].slice(0, 60)); // 最大60文字で保存
      }
    }

    const flagged = matched.length > 0;
    // スコア：マッチ数に応じて増加、最大1.0
    const score = flagged ? Math.min(matched.length * 0.3, 1.0) : 0;

    results[category] = {
      flagged,
      score,
      matchedPatterns: matched,
      category,
    };
  }

  return results;
}

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
    // ===== BLOCK: 高機密PII =====

    // My Number with context (high confidence) -> BLOCK
    {
      pattern: /(?:マイナンバー|個人番号|My\s?Number)[\s:：は]+(\d{4}[\s-]?\d{4}[\s-]?\d{4})/i,
      name: 'mynumber_context',
      severity: 'BLOCK',
      description: 'Japanese My Number (マイナンバー)',
    },
    // Bank account with context -> BLOCK
    {
      pattern: /(?:口座番号|銀行口座|account\s?number)[\s:：は]+(\d{3})[\s-]?(\d{7})/i,
      name: 'bank_context',
      severity: 'BLOCK',
      description: 'Bank account number',
    },
    // Passport number (旅券番号: 2英字 + 7桁) -> BLOCK
    {
      pattern: /(?:旅券番号|パスポート番号|passport\s?(?:no|number))[\s:：は]+([A-Z]{2}\d{7})/i,
      name: 'passport_context',
      severity: 'BLOCK',
      description: 'Japanese passport number (旅券番号)',
    },
    // Health insurance card number (保険証) -> BLOCK
    {
      pattern: /(?:保険証番号|被保険者番号|健康保険|保険者番号)[\s:：は]+\d{6,10}/i,
      name: 'health_insurance',
      severity: 'BLOCK',
      description: 'Health insurance card number (保険証番号)',
    },
    // Driver's license with context (免許証番号: 12桁) -> BLOCK
    {
      pattern: /(?:免許証番号|運転免許|license\s?(?:no|number))[\s:：は]+\d{12}/i,
      name: 'drivers_license_context',
      severity: 'BLOCK',
      description: "Driver's license number (免許証番号)",
    },

    // ===== WARN: 検出対象PII =====

    // 12-digit number (possible My Number) -> WARN
    {
      pattern: /\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/,
      name: 'mynumber',
      severity: 'WARN',
      description: 'Possible My Number (12 digits)',
    },
    // Corporate Number (13 digits) -> WARN
    {
      pattern: /\b\d{13}\b/,
      name: 'corporate',
      severity: 'WARN',
      description: 'Japanese Corporate Number (法人番号)',
    },
    // Passport number without context (2英字+7桁の孤立パターン) -> WARN
    {
      pattern: /\b[A-Z]{2}\d{7}\b/,
      name: 'passport',
      severity: 'WARN',
      description: 'Possible passport number',
    },
    // Phone number with context -> WARN
    {
      pattern: /(?:電話番号|tel|phone)[\s:：は]+(0\d{1,4}[\s-]?\d{1,4}[\s-]?\d{4})/i,
      name: 'phone_context',
      severity: 'WARN',
      description: 'Japanese phone number',
    },
    // Mobile phone (国内形式: 090/080/070) -> WARN
    {
      pattern: /\b0[789]0[\s-]?\d{4}[\s-]?\d{4}\b/,
      name: 'mobile',
      severity: 'WARN',
      description: 'Japanese mobile phone',
    },
    // Mobile phone (国際形式: +81-90-...) -> WARN
    {
      pattern: /\+81[\s-]?[789]0[\s-]?\d{4}[\s-]?\d{4}/,
      name: 'mobile_intl',
      severity: 'WARN',
      description: 'Japanese mobile phone (international format)',
    },
    // Postal code (〒123-4567, 123-4567, 1234567) -> WARN
    {
      pattern: /(?:[〒]|郵便番号[\s:：は]*)\d{3}[-\s]?\d{4}/,
      name: 'postal_explicit',
      severity: 'WARN',
      description: 'Japanese postal code',
    },
    {
      pattern: /\b\d{3}-\d{4}\b/,
      name: 'postal_hyphen',
      severity: 'WARN',
      description: 'Japanese postal code (NNN-NNNN)',
    },
    // Japanese address pattern (都道府県 + 市区町村) -> WARN
    {
      pattern: /(?:東京都|北海道|(?:大阪|京都)府|.{2,3}県)[\s　]*(?:[^\s]{1,10}[市区町村郡])/,
      name: 'address',
      severity: 'WARN',
      description: 'Japanese address (住所)',
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
