/**
 * LLM-as-Judge Evaluation
 * OpenAI / Anthropic (Claude) 両対応
 * タイムアウト・リトライ・サンプリング・クライアントキャッシュ付き
 */
import OpenAI from 'openai';
import { config, evaluationConfig } from '../config.js';
import { EvaluationInput, EvaluationResult } from './types.js';
import {
  FAITHFULNESS_PROMPT,
  ANSWER_RELEVANCE_PROMPT,
  CONTEXT_UTILIZATION_PROMPT,
  HALLUCINATION_DETECTION_PROMPT,
} from './prompts.js';

// パターンマッチベース評価（フェーズ1 MVP）のエクスポート
export { evaluateTracePatterns, buildEvaluationOptions } from './runner.js';

// ===========================
// LLMクライアント管理
// ===========================

type JudgeProvider = 'openai' | 'anthropic';

/** 使用するJudgeプロバイダーを決定 */
function getJudgeProvider(): JudgeProvider {
  const envProvider = process.env.EVALUATION_PROVIDER?.toLowerCase();
  if (envProvider === 'anthropic' || envProvider === 'claude') return 'anthropic';
  if (envProvider === 'openai') return 'openai';

  // 環境変数が未指定の場合、利用可能なAPIキーから自動判定
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';

  throw new Error(
    'LLM-as-Judge評価にはOPENAI_API_KEYまたはANTHROPIC_API_KEYが必要です。' +
    'EVALUATION_PROVIDER環境変数で使用するプロバイダーを指定できます。'
  );
}

/** OpenAIクライアント（シングルトン） */
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is required for OpenAI evaluation');
    openaiClient = new OpenAI({ apiKey, timeout: evaluationConfig.timeoutMs });
  }
  return openaiClient;
}

/** Anthropicクライアント（OpenAI互換エンドポイント使用） */
let anthropicClient: OpenAI | null = null;
function getAnthropicClient(): OpenAI {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for Claude evaluation');
    anthropicClient = new OpenAI({
      apiKey,
      baseURL: 'https://api.anthropic.com/v1/',
      timeout: evaluationConfig.timeoutMs,
      defaultHeaders: {
        'anthropic-version': '2023-06-01',
      },
    });
  }
  return anthropicClient;
}

/** プロバイダーに応じたデフォルトモデルを返す */
function getDefaultModel(provider: JudgeProvider): string {
  return provider === 'anthropic' ? 'claude-3-5-haiku-latest' : 'gpt-4o-mini';
}

// ===========================
// リトライロジック
// ===========================

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRetryable =
        lastError.message.includes('429') ||
        lastError.message.includes('500') ||
        lastError.message.includes('503') ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('ECONNRESET');

      if (!isRetryable || attempt === retries) throw lastError;

      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// ===========================
// タイムアウト付きPromise
// ===========================

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`LLM評価タイムアウト (${ms}ms)`)), ms);
    promise
      .then(result => { clearTimeout(timer); resolve(result); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
}

// ===========================
// サンプリング
// ===========================

function shouldSample(): boolean {
  return Math.random() < evaluationConfig.samplingRate;
}

// ===========================
// Judge呼び出し
// ===========================

async function callJudge(prompt: string): Promise<number | null> {
  const provider = getJudgeProvider();
  const client = provider === 'anthropic' ? getAnthropicClient() : getOpenAIClient();
  const model = config.evaluationModel || getDefaultModel(provider);

  const result = await withRetry(async () => {
    const res = await withTimeout(
      client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 150,
      }),
      evaluationConfig.timeoutMs
    );

    const text = res.choices[0]?.message?.content ?? '';
    // JSONブロックを抽出（```json ... ``` 形式にも対応）
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error(`JSON応答をパースできません: ${text.substring(0, 100)}`);

    const parsed = JSON.parse(jsonMatch[0]);
    const score = parseFloat(parsed.score);
    if (isNaN(score)) throw new Error(`スコアが数値ではありません: ${parsed.score}`);
    return Math.min(1, Math.max(0, score));
  });

  return result;
}

// ===========================
// メイン評価関数
// ===========================

export async function evaluateTrace(input: EvaluationInput): Promise<EvaluationResult> {
  const provider = getJudgeProvider();
  const model = config.evaluationModel || getDefaultModel(provider);
  const isRAG = !!input.context;

  const result: EvaluationResult = {
    faithfulness: null,
    answerRelevance: null,
    contextUtilization: null,
    hallucinationRate: null,
    isRAG,
    evaluatedAt: new Date().toISOString(),
    evaluationModel: `${provider}/${model}`,
  };

  // サンプリングチェック（コストの高いLLM呼び出しにこそ必要）
  if (!shouldSample()) {
    return result;
  }

  try {
    // Answer Relevance は question と answer があれば常に実行
    result.answerRelevance = await callJudge(
      ANSWER_RELEVANCE_PROMPT(input.question, input.answer)
    );

    // RAG検出時: コンテキスト依存の評価を全て実行
    if (input.context) {
      // Faithfulness — 回答がコンテキストに忠実か
      result.faithfulness = await callJudge(
        FAITHFULNESS_PROMPT(input.context, input.answer)
      );

      // Context Utilization — 取得文書をどれだけ活用したか
      result.contextUtilization = await callJudge(
        CONTEXT_UTILIZATION_PROMPT(input.context, input.answer)
      );

      // Hallucination Rate — ソースにない情報の生成率
      result.hallucinationRate = await callJudge(
        HALLUCINATION_DETECTION_PROMPT(input.context, input.answer)
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown evaluation error';
    result.error = message;
    console.error(`[LLM-as-Judge] 評価失敗 (${provider}/${model}):`, message);
  }

  return result;
}

/**
 * LLM-as-Judgeが利用可能かチェック（起動時の検証用）
 */
export function isJudgeAvailable(): { available: boolean; provider?: string; reason?: string } {
  try {
    const provider = getJudgeProvider();
    return { available: true, provider };
  } catch (err) {
    return {
      available: false,
      reason: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
