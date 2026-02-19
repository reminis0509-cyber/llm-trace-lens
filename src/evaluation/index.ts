import OpenAI from 'openai';
import { config } from '../config.js';
import { EvaluationInput, EvaluationResult } from './types.js';
import { FAITHFULNESS_PROMPT, ANSWER_RELEVANCE_PROMPT } from './prompts.js';

// 評価用のOpenAIクライアント（既存クライアントと分離）
function getEvaluationClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for evaluation');
  return new OpenAI({ apiKey });
}

async function callJudge(prompt: string): Promise<number | null> {
  try {
    const client = getEvaluationClient();
    const res = await client.chat.completions.create({
      model: config.evaluationModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 150,
    });
    const text = res.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(text);
    const score = parseFloat(parsed.score);
    return isNaN(score) ? null : Math.min(1, Math.max(0, score));
  } catch {
    return null;
  }
}

export async function evaluateTrace(input: EvaluationInput): Promise<EvaluationResult> {
  const result: EvaluationResult = {
    faithfulness: null,
    answerRelevance: null,
    evaluatedAt: new Date().toISOString(),
    evaluationModel: config.evaluationModel,
  };

  try {
    // Answer Relevance は question と answer があれば常に実行
    result.answerRelevance = await callJudge(
      ANSWER_RELEVANCE_PROMPT(input.question, input.answer)
    );

    // Faithfulness は context がある場合のみ実行
    if (input.context) {
      result.faithfulness = await callJudge(
        FAITHFULNESS_PROMPT(input.context, input.answer)
      );
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'Unknown evaluation error';
  }

  return result;
}
