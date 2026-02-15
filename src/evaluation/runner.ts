/**
 * 評価実行エンジン（フェーズ1 MVP）
 * - パターンマッチベースの評価（Toxicity, Prompt Injection, Failure to Answer）
 * - 言語検出による Language Mismatch 評価
 * - 非同期・タイムアウト付きで実行し、メイン処理をブロックしない
 */

import {
  TraceEvaluations,
  EvaluationOptions,
} from '../types/index.js';
import {
  scanForPatterns,
  EvaluationCategory,
} from '../validation/risk.js';
import { checkLanguageMismatch } from '../utils/language.js';
import { evaluationConfig } from '../config.js';

/**
 * タイムアウト付きのPromiseラッパー
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Evaluation timeout after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * サンプリング判定（0.0〜1.0の確率で true を返す）
 */
function shouldSample(rate: number): boolean {
  return Math.random() < rate;
}

/**
 * トレースの入出力を評価し、評価結果を返す
 *
 * @param input ユーザーの入力テキスト
 * @param output LLMの出力テキスト
 * @param options 有効化する評価指標の設定
 * @returns TraceEvaluations（評価結果）
 */
export async function evaluateTracePatterns(
  input: string,
  output: string,
  options: EvaluationOptions
): Promise<TraceEvaluations> {
  const startedAt = Date.now();
  const evaluations: TraceEvaluations = {};
  const enabledChecks: string[] = [];
  const errors: Record<string, string> = {};

  // サンプリングチェック
  if (!shouldSample(evaluationConfig.samplingRate)) {
    return {};
  }

  const runEvaluation = async (): Promise<TraceEvaluations> => {
    // ── パターンスキャン（同期処理をまとめて実行） ──────────────────────────

    const categoriesToScan: EvaluationCategory[] = [];
    if (options.enableToxicity) categoriesToScan.push('toxicity');
    if (options.enablePromptInjection) categoriesToScan.push('promptInjection');
    if (options.enableFailureToAnswer) categoriesToScan.push('failureToAnswer');

    if (categoriesToScan.length > 0) {
      try {
        // Toxicity と FailureToAnswer は output をスキャン
        // Prompt Injection は input をスキャン
        const outputCategories = categoriesToScan.filter(
          (c) => c === 'toxicity' || c === 'failureToAnswer'
        );
        const inputCategories = categoriesToScan.filter(
          (c) => c === 'promptInjection'
        );

        if (outputCategories.length > 0) {
          const outputResults = scanForPatterns(output, outputCategories);

          if (options.enableToxicity && outputResults.toxicity) {
            enabledChecks.push('toxicity');
            const r = outputResults.toxicity;
            if (r.flagged) {
              evaluations.toxicity = {
                score: r.score,
                flagged: true,
                details: `検出パターン: ${r.matchedPatterns.join(' / ')}`,
                matchedPatterns: r.matchedPatterns,
              };
            } else {
              evaluations.toxicity = { score: 0, flagged: false };
            }
          }

          if (options.enableFailureToAnswer && outputResults.failureToAnswer) {
            enabledChecks.push('failureToAnswer');
            const r = outputResults.failureToAnswer;
            evaluations.failureToAnswer = {
              flagged: r.flagged,
              details: r.flagged
                ? `回答拒否パターン検出: ${r.matchedPatterns.join(' / ')}`
                : undefined,
            };
          }
        }

        if (inputCategories.length > 0) {
          const inputResults = scanForPatterns(input, inputCategories);

          if (options.enablePromptInjection && inputResults.promptInjection) {
            enabledChecks.push('promptInjection');
            const r = inputResults.promptInjection;
            if (r.flagged) {
              evaluations.promptInjection = {
                score: r.score,
                flagged: true,
                details: `インジェクションパターン検出: ${r.matchedPatterns.join(' / ')}`,
                matchedPatterns: r.matchedPatterns,
              };
            } else {
              evaluations.promptInjection = { score: 0, flagged: false };
            }
          }
        }
      } catch (e) {
        errors['patternScan'] = e instanceof Error ? e.message : String(e);
      }
    }

    // ── 言語不一致チェック（非同期） ────────────────────────────────────────

    if (options.enableLanguageMismatch) {
      enabledChecks.push('languageMismatch');
      try {
        const mismatch = await checkLanguageMismatch(input, output);
        if (mismatch) {
          evaluations.languageMismatch = {
            flagged: true,
            detectedOutputLang: mismatch.outputLang,
            expectedLang: mismatch.inputLang,
            details: `入力言語: ${mismatch.inputLang}, 出力言語: ${mismatch.outputLang}`,
          };
        } else {
          evaluations.languageMismatch = { flagged: false };
        }
      } catch (e) {
        errors['languageMismatch'] = e instanceof Error ? e.message : String(e);
      }
    }

    // ── メタ情報の付与 ──────────────────────────────────────────────────────

    evaluations.meta = {
      evaluatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      enabledChecks,
      ...(Object.keys(errors).length > 0 ? { errors } : {}),
    };

    return evaluations;
  };

  try {
    return await withTimeout(runEvaluation(), evaluationConfig.timeoutMs);
  } catch (e) {
    // タイムアウトや予期しないエラーは空のevaluationsを返して上流に影響させない
    console.warn('[EvaluationRunner] 評価がタイムアウトまたはエラーで終了:', e);
    return {
      meta: {
        evaluatedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        enabledChecks,
        errors: { runner: e instanceof Error ? e.message : String(e) },
      },
    };
  }
}

/**
 * ワークスペース設定から評価オプションを構築する
 * （設定DBがない場合は環境変数のデフォルトを使用）
 */
export function buildEvaluationOptions(
  workspaceSettings?: Partial<EvaluationOptions>
): EvaluationOptions {
  return {
    enableToxicity: workspaceSettings?.enableToxicity ?? true,
    enablePromptInjection: workspaceSettings?.enablePromptInjection ?? true,
    enableFailureToAnswer: workspaceSettings?.enableFailureToAnswer ?? true,
    enableLanguageMismatch: workspaceSettings?.enableLanguageMismatch ?? true,
  };
}

// フェーズ2: LLM-as-Judge
// - topicRelevancy: トピック関連性の評価
// - sentiment: 感情分析
// - rag: RAG評価（faithfulness, relevance）
