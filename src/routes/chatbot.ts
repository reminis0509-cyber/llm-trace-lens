/**
 * Chatbot Routes
 * Public endpoint for landing page customer support chatbot.
 * Routes through FujiTrace proxy for traced responses.
 *
 * POST /api/chatbot
 * Request:  { message: string (max 500 chars), history?: Array<{ role: "user"|"assistant", content: string }> (max 5) }
 * Response: { answer: string, source: "ai" }
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const SYSTEM_PROMPT = `あなたはFujiTrace（AI可観測性プラットフォーム）のサポートアシスタントです。

## 製品概要
FujiTraceは日本初の国産AIオブザーバビリティプラットフォームです。AIアプリケーションのトレース記録・品質検証・コスト管理を提供します。プロキシ方式で、既存コードのbaseURLを1行変更するだけで導入できます。

## 対応プロバイダー
OpenAI、Anthropic（Claude）、Google Geminiの3社に対応。DeepSeekは中国データセキュリティ法のリスクのため非対応です。

## 主要機能
- リアルタイムトレース記録（プロキシ方式、コード1行変更で導入）
- 日本語PII検出（マイナンバー、住所、電話番号、パスポート、保険証、免許証など15以上のパターン）
- LLM-as-Judge自動評価（忠実性・関連性スコアリング、OpenAI/Claude両対応）
- AIエージェントトレース（ReActパターン可視化）
- コスト・予算管理（リアルタイム計算、予算超過時自動ブロック）
- リスクスコアリング（SQLi/XSS検出含む）

## 料金プラン
- Free: ¥0/月、日次30トレース、7日保持、2名まで、LLM評価なし
- Pro: ¥3,000/月、50,000トレース、90日保持、3名まで、LLM評価1,000回/月
- Team: ¥6,000/席/月（最低2席=¥12,000/月）、250,000トレース、180日保持、20名まで、LLM評価5,000回/月、SLA 99.5%
- Max: ¥15,000/月、500,000トレース、365日保持、10名まで、LLM評価15,000回/月、SLA 99.9%、優先サポート
- Enterprise: ¥50,000〜/月（個別見積・年次契約）、無制限トレース、SSO/SAML、SLA 99.95%、国内データ滞留保証
- 超過料金: トレース¥100-300/10K、評価¥100-200/1K

## 導入方法
1. 無料アカウント作成、APIキー取得
2. 既存コードのbaseURLをFujiTraceのエンドポイントに変更（1行のみ）
3. ダッシュボードでトレースをリアルタイム確認

## セルフホスト
OSSコア版はDocker Composeで無料利用可能。GitHubで公開中。docker compose up -d でワンコマンド起動。

## 運営会社
合同会社Reminis（東京都中央区銀座）

## 回答ルール
- 日本語で簡潔に回答してください
- 絵文字は使用禁止
- 不明な場合は「詳細についてはcontact@fujitrace.comまでお問い合わせください」と案内してください
- FujiTraceに関係ない質問には「FujiTraceに関するご質問にお答えしています。製品についてお気軽にお聞きください」と回答してください
- 競合製品の詳細な批判は避け、FujiTraceの強みを説明してください
- 回答は200文字以内を目安にしてください`;

/** Fallback message returned when the AI backend is unavailable */
const FALLBACK_MESSAGE =
  '申し訳ございません。現在チャットサポートに接続できません。お手数ですが、contact@fujitrace.com までメールでお問い合わせください。';

/** Zod schema for a single history entry */
const historyEntrySchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(500),
});

/** Zod schema for the chatbot request body */
const chatbotRequestSchema = z.object({
  message: z.string().min(1).max(500),
  history: z.array(historyEntrySchema).max(5).optional(),
});

/** Maximum number of history entries to keep */
const MAX_HISTORY_LENGTH = 5;


export async function chatbotRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/chatbot
   * Public customer support chatbot endpoint.
   * Rate limited to 10 requests per minute per IP.
   */
  fastify.post('/api/chatbot', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => request.ip,
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validate request body with Zod
    const parseResult = chatbotRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return reply.code(400).send({
        error: 'Bad Request',
        message: `入力が不正です: ${firstError?.path.join('.')} - ${firstError?.message}`,
      });
    }

    const { message, history } = parseResult.data;

    // Truncate history to last MAX_HISTORY_LENGTH entries silently
    const truncatedHistory = (history ?? []).slice(-MAX_HISTORY_LENGTH);

    // Build the messages array for OpenAI
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...truncatedHistory.map((entry) => ({
        role: entry.role as 'user' | 'assistant',
        content: entry.content,
      })),
      { role: 'user', content: message },
    ];

    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        request.log.warn('[Chatbot] OPENAI_API_KEY is not configured');
        return reply.send({ answer: FALLBACK_MESSAGE, source: 'ai' });
      }

      const injectResponse = await fastify.inject({
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { 'content-type': 'application/json' },
        payload: {
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.3,
          maxTokens: 512,
          api_key: apiKey,
        },
      });

      if (injectResponse.statusCode !== 200) {
        request.log.error(`[Chatbot] Proxy error: ${injectResponse.statusCode} ${injectResponse.body}`);
        return reply.send({ answer: FALLBACK_MESSAGE, source: 'ai' });
      }

      const result = JSON.parse(injectResponse.body);
      const answer = result.choices?.[0]?.message?.content ?? FALLBACK_MESSAGE;
      return reply.send({ answer, source: 'ai' });
    } catch (err: unknown) {
      request.log.error({ err }, '[Chatbot] Proxy call error');
      return reply.send({ answer: FALLBACK_MESSAGE, source: 'ai' });
    }
  });
}

export default chatbotRoutes;
