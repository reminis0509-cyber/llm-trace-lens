import type {
  ValidationResult,
  ValidationRule,
  ValidationLevel,
  RuleResult,
  LegacyStructuredResponse,
  InternalTrace,
} from '../types/index.js';
import { ConfidenceValidator } from './rules/confidence.js';
import { RiskScanner } from './rules/risk.js';

/**
 * 検証エンジン
 * 複数のルールを並列実行し、総合評価を返す
 */
export class ValidationEngine {
  private rules: ValidationRule[];

  constructor(rules?: ValidationRule[]) {
    // デフォルトルールセット
    this.rules = rules || [new ConfidenceValidator(), new RiskScanner()];
  }

  async validate(
    structured: LegacyStructuredResponse,
    internalTrace: InternalTrace | null = null
  ): Promise<ValidationResult> {
    // Promise.allSettledで1つのルールが失敗しても他を継続
    const settledResults = await Promise.allSettled(
      this.rules.map((rule) => rule.validate(structured, internalTrace))
    );

    const results: RuleResult[] = settledResults.map((settled, index) => {
      if (settled.status === 'fulfilled') {
        return settled.value;
      } else {
        // ルール実行エラーはFAILとして扱う
        return {
          ruleName: this.rules[index].name,
          level: 'FAIL' as ValidationLevel,
          message: `Rule execution failed: ${settled.reason}`,
        };
      }
    });

    // BLOCKが1つでもあれば短絡評価（将来の最適化用）
    const hasBlock = results.some((r) => r.level === 'BLOCK');
    const hasFail = results.some((r) => r.level === 'FAIL');
    const hasWarn = results.some((r) => r.level === 'WARN');

    let overall: ValidationLevel;
    if (hasBlock) overall = 'BLOCK';
    else if (hasFail) overall = 'FAIL';
    else if (hasWarn) overall = 'WARN';
    else overall = 'PASS';

    const score = this.calculateScore(results);

    return {
      overall,
      score,
      rules: results,
    };
  }

  private calculateScore(results: RuleResult[]): number {
    if (results.length === 0) return 100;

    const weights: Record<ValidationLevel, number> = {
      PASS: 100,
      WARN: 60,
      FAIL: 20,
      BLOCK: 0,
    };

    const total = results.reduce((sum, r) => sum + weights[r.level], 0);
    return Math.round(total / results.length);
  }

  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  removeRule(ruleName: string): void {
    this.rules = this.rules.filter((r) => r.name !== ruleName);
  }

  getRules(): string[] {
    return this.rules.map((r) => r.name);
  }
}
