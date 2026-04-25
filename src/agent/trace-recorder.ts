/**
 * Internal LLM trace recorder — bucket-hole patch (2026-04-25).
 *
 * 背景: Founder M&A 構想は「FujiTrace を使うほど trace が蓄積され、
 * その trace データそのものが日本企業事務作業パターンの宝庫として
 * 売却価値を持つ」前提で組まれている (戦略 doc Section 9)。
 * しかし 2026-04-25 のコード監査で、production の **全ての内部 LLM 呼び出し
 * が trace 記録を素通りしている** ことが発覚した:
 *
 *   - `src/routes/tools/_shared.ts::callLlmViaProxy` は名前と裏腹に proxy
 *     を経由せず生 fetch している(コメント line 268: "Call OpenAI directly
 *     (proxy enforcer adds overhead and forces JSON mode)")。
 *   - LINE Phase A の `chat-bridge.ts` / `welcome-journey.ts` も同様に
 *     生 fetch (function calling サポートのため意図的にバイパス)。
 *
 * その結果、外部ユーザーが `/proxy/v1/chat/completions` を直接叩く時しか
 * trace は永続化されず、自社プロダクトを使った全 LLM コールがバケツの穴
 * から漏れていた。
 *
 * 本モジュールは生 fetch 後に同じ trace パイプライン
 * (`createTrace` → `processTracePostActions`) を呼ぶ薄いアダプタ。
 * 各呼び出し元は OpenAI レスポンスを受け取った直後に `recordLlmTrace()`
 * を await せずに呼び出すだけで済む(fire-and-forget でユーザー体感を
 * 落とさない)。
 *
 * 設計判断:
 *   - workspaceId は **必須**。デフォルト 'default' に倒さない理由は、
 *     ダッシュボード集計が workspaceId 別に実行されるため、無 workspaceId
 *     の trace が salt されると後で誰のデータか分からなくなる。
 *   - 自由対話の「答え」は StructuredResponse の `answer` 1 フィールドに
 *     収める。confidence は 0.5、evidence/alternatives は空配列にして
 *     既存 validation/評価パイプラインに通す。
 *   - 失敗時は console.error + 投げない。trace 記録の失敗で本処理を
 *     落とすのは本末転倒。
 */
import type { TraceType } from '../types/index.js';
import {
  createTrace,
  processTracePostActions,
  runValidation,
} from '../proxy/trace-processor.js';

export interface RecordLlmTraceParams {
  /** 必須。trace を集計する単位 (LINE の場合 `resolveLineWorkspace().workspaceId`)。 */
  workspaceId: string;
  /** Date.now() を呼び出し直前に取った値。latencyMs の起点。 */
  startTime: number;
  /** 'openai' | 'anthropic' | 'gemini' のいずれか。 */
  provider: string;
  /** 実際に投げたモデル名 (e.g. 'gpt-4o-mini-search-preview')。 */
  model: string;
  /** OpenAI Chat Completions 相当のメッセージ配列。system 含めて記録する。 */
  messages: Array<{ role: string; content: string }>;
  /** モデルが返した最終的な assistant content (free text)。 */
  responseText: string;
  /** OpenAI が返した usage (prompt_tokens / completion_tokens)。 */
  usage?: { promptTokens: number; completionTokens: number };
  /** Contract Runtime 経由なら 'agent'、それ以外は 'standard'。デフォルト 'standard'。 */
  traceType?: TraceType;
}

/**
 * Record an LLM call as a trace. Fire-and-forget — caller does NOT await.
 * Errors are swallowed (logged) so a transient KV/DB hiccup never breaks
 * the user-facing reply.
 */
export function recordLlmTrace(params: RecordLlmTraceParams): void {
  // 即値 schedule して呼び出し元の Promise チェーンには絶対戻らない。
  // setImmediate を使わないのは、tests や single-tick の測定で
  // microtask が解決待ちになるのを防ぐため。
  void recordLlmTraceImpl(params).catch((err) => {
    console.error('[trace-recorder] failed to persist trace', {
      err: err instanceof Error ? err.message : String(err),
      workspaceId: params.workspaceId,
      model: params.model,
    });
  });
}

async function recordLlmTraceImpl(params: RecordLlmTraceParams): Promise<void> {
  const structuredResponse = {
    answer: params.responseText,
    confidence: 0.5,
    evidence: [],
    alternatives: [],
  };

  const validation = await runValidation(structuredResponse, params.workspaceId);

  const trace = createTrace({
    startTime: params.startTime,
    provider: params.provider,
    model: params.model,
    // prompt は dashboard 検索のキー対象。message 配列を JSON 化して
    // 1 行に圧縮しておくと grep / 全文検索が成立する。
    prompt: JSON.stringify(params.messages),
    structuredResponse,
    confidenceResult: validation.confidenceResult,
    riskResult: validation.riskResult,
    riskScore: validation.riskScore,
    overallStatus: validation.overallStatus,
    workspaceId: params.workspaceId,
    messages: params.messages,
    traceType: params.traceType ?? 'standard',
    usage: params.usage
      ? {
          promptTokens: params.usage.promptTokens,
          completionTokens: params.usage.completionTokens,
          totalTokens: params.usage.promptTokens + params.usage.completionTokens,
        }
      : undefined,
  });

  // processTracePostActions は内部で fire-and-forget の DB 保存・コスト
  // 集計・LLM-as-Judge 評価・Webhook 通知をすべてハンドルする。
  // 同期呼び出しでよい(中で setImmediate / 非同期 chain が回る設計)。
  processTracePostActions(trace);
}
