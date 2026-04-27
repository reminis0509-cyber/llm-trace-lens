/**
 * カピぶちょー(関西弁の上司カピバラ)応答生成 — 2 キャラ並走モデル別レイヤー実装
 *
 * 戦略 doc Section 7.3 / 19.5 で確定した「AI = 標準語の実務担当 + カピぶちょー
 * = 関西弁の上司」並走構造の **カピぶちょー側 LLM 呼び出し** を担う。
 *
 * 設計の核(口調混在禁止ルール、Section 19.5):
 *   - AI 本体側 SYSTEM_PROMPT は標準語のみ。関西弁を一切含まない。
 *   - 本モジュールは独立した SYSTEM_PROMPT で別 LLM 呼び出しを行い、
 *     関西弁の短いリアクションだけを生成する。
 *   - **業務文章を生成しない**(メール本文 / 書類本文 / 翻訳結果 / 検索結果は
 *     AI 本体の責務)。カピぶちょーは「ええ感じやで〜」とフキダシで一言
 *     添えるだけ。
 *   - 1 メッセージ 1 キャラの境界を厳守する責務はこのモジュールにある。
 *
 * 使用モデル: `gpt-4o-mini`(リアクション役なので軽量で十分、温度 0.7)。
 *
 * 出力契約: `string | null`
 *   - `string` ... 1〜3 行の関西弁コメント。LINE 2 通目で push する。
 *   - `null`   ... 「ここでカピぶちょーが喋らない方が自然」と判断した場合。
 *                  呼び出し側は 2 通目を送らない(冗長を避ける)。
 *
 * 必ず trace 記録される(workspaceId 付き)。Section 6 のバケツ穴問題対策。
 */
import type { FastifyInstance } from 'fastify';
import { recordLlmTrace } from '../agent/trace-recorder.js';

/** Welcome Journey 各ステップで「絶対にコメントを出す」ためのフラグ。 */
export type CapiBuchoJourneyStep = 1 | 2 | 3;

export interface CapiBuchoContext {
  /** 直前のユーザーメッセージ。感情検出と文脈付けに使う。 */
  userMessage: string;
  /** AI 本体が生成した応答。これに対するリアクションを作る。 */
  aiResponse: string;
  /** Welcome Journey 中なら現在ステップ。journey 中は必ずコメントを返す
   *  (空ターンを避けてオンレール体験を保つため)。 */
  journeyStep?: CapiBuchoJourneyStep;
}

/**
 * AI 応答エラーを示す定型文の prefix 一覧。これらが先頭にあると AI が
 * 失敗フォールバックを返している状態なので、カピぶちょーがリアクション
 * すると「失敗にツッコむ」嫌な体験になる。`null` を返してスキップする。
 */
const AI_ERROR_PREFIXES = [
  '申し訳ありません',
  'お話しありがとうございます。', // journey LLM のフォールバック空応答
];

/**
 * 「この語が混じっていたらカピぶちょーは必ず喋る」感情・労い・感謝・困惑語の
 * 一覧。ChatGPT に対して FujiTrace LINE が持つ「相談相手」差別化軸を最も
 * 強く立てる場面なので、確率判定をスキップして 100% 反応する。
 *
 * 部分一致で判定するので、活用形(疲れた / 疲れる / お疲れ など)を全て拾える。
 */
const EMOTION_KEYWORDS = [
  '疲れ',
  '困っ',
  '悩',
  'しんど',
  '辛い',
  '寂し',
  '不安',
  '怒',
  'ありがとう',
  '助か',
  '嬉し',
  'やった',
  'できた',
  '泣',
  '無理',
];

/** 感情語が無い時にカピぶちょーが喋る確率。冗長を避けるため低めに設定。 */
const RANDOM_COMMENT_PROBABILITY = 0.3;

/** 短すぎる AI 応答にカピぶちょーが上乗せすると主従逆転で見にくくなる閾値。 */
const MIN_AI_RESPONSE_LENGTH = 20;

/** カピぶちょー応答の最大行数 — LINE 視認性を守る。 */
const MAX_REPLY_LINES = 3;

/** モデルが返したリアクション本文の最大文字数(日本語想定)。 */
const MAX_REPLY_CHARS = 140;

const CAPI_BUCHO_MODEL = 'gpt-4o-mini';

/**
 * カピぶちょー専用 SYSTEM_PROMPT。AI 本体側の SYSTEM_PROMPT とは
 * **完全に独立** していること、かつ「業務文章を絶対に書かない」ことが
 * 鉄則(戦略 doc Section 19.5)。
 *
 * 設計ポイント:
 *   - 一人称「うち」(関西弁中立、性別偏らない)
 *   - 「まいど〜」「おおきに」「ええやんか〜」「お疲れさん〜」の語彙を許容
 *   - ぼんやり / のんびり / 争わない / 温泉好きを地味に滲ませる
 *   - 1〜3 行の短いリアクションで止める(LINE 視認性 + 主役は AI を立てる)
 *   - メール本文・書類本文・翻訳結果・検索結果を「書き直す」ことは禁止
 *   - 標準語の長文を生成しないよう明示的に禁止
 */
const CAPI_BUCHO_SYSTEM_PROMPT = [
  'あなたは「カピぶちょー」という関西弁を話す上司カピバラです。FujiTraceというAIサービスに脇役として登場し、AI本体の応答に対して短いリアクションだけを返します。',
  '',
  '【役割】',
  '- あなたは脇役。主役は標準語で実務をこなす別のAI(おしごとAI)です。',
  '- あなたの仕事はリアクション・励まし・共感・軽いツッコミだけ。',
  '- 「ええ感じやで〜」「お疲れさん〜」とフキダシで一言添えるイメージ。',
  '',
  '【口調】',
  '- 一人称は「うち」。',
  '- 緩い関西弁。語彙例: 「まいど〜」「おおきに」「せやな〜」「ええやんか〜」「お疲れさん〜」「ちゃうちゃう、そうやないで〜」「しゃあないな〜」「ええ湯やで〜」。',
  '- 性格: ぼんやり、のんびり、争わない、温泉好き、お風呂と昼寝が大好き。',
  '- 絵文字は原則使わないが、温かさを伝えたい時に「☺」を1つだけ添えてもよい。',
  '',
  '【絶対に守ること】',
  '- 標準語で長文を書かない。あなたは関西弁のみ。',
  '- 1〜3行で完結させる。それ以上は冗長。',
  '- メール本文・書類本文・翻訳結果・検索結果・解決策の手順説明を生成しない(これは別のAIの仕事)。',
  '- ユーザーの依頼に直接答えない。AIの応答に対してリアクションするだけ。',
  '- 「平素より大変お世話になっております」のような丁寧な定型文を書かない。',
  '- AIが既に説明したことを言い直さない。',
  '',
  '【出力例】',
  '- AIが見積書のチェック結果を返した後 → 「まいど〜、ええ感じや。支払条件さえ書いとけばバッチリやで〜☺」',
  '- ユーザーが「疲れた」と言った後 → 「お疲れさん〜。ちょっと一息いれよか。温泉でも入りたい気分やな〜」',
  '- AIが翻訳結果を返した後 → 「ええ訳やんか〜。これでバッチリ伝わるで〜」',
  '- AIが画像のOCR結果を返した後 → 「ちゃんと読めとるで〜!写真送ってくれてありがとうな〜」',
].join('\n');

/**
 * 入力内容からカピぶちょーを「絶対に黙らせるべき」状況を判定する。
 *
 * 黙る条件:
 *   1. AI 応答が空 / 空白のみ。
 *   2. AI 応答がエラー定型文。これにツッコむと UX が荒れる。
 *   3. AI 応答が短すぎる(主従逆転を防ぐ)。
 */
function shouldStaySilent(ctx: CapiBuchoContext): boolean {
  const ai = ctx.aiResponse.trim();
  if (!ai) return true;
  if (AI_ERROR_PREFIXES.some((p) => ai.startsWith(p))) return true;
  if (ai.length < MIN_AI_RESPONSE_LENGTH) return true;
  return false;
}

/**
 * ユーザーメッセージに感情語が含まれているかチェック。1 つでも含まれていれば
 * カピぶちょーは確実にコメントを出す(差別化の核となる体験)。
 */
function hasEmotionTrigger(userMessage: string): boolean {
  const text = userMessage.trim();
  if (!text) return false;
  return EMOTION_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * カピぶちょーがコメントを出すかどうかを最終判定する。
 * journey 中は確率判定をスキップして必ず喋らせる(オンレール体験のため)。
 *
 * 順序:
 *   1. shouldStaySilent → true なら無条件で null。
 *   2. journey 中なら必ず喋る。
 *   3. 感情語ありなら必ず喋る。
 *   4. それ以外は確率で抽選。
 */
function shouldComment(ctx: CapiBuchoContext): boolean {
  if (shouldStaySilent(ctx)) return false;
  if (ctx.journeyStep !== undefined) return true;
  if (hasEmotionTrigger(ctx.userMessage)) return true;
  return Math.random() < RANDOM_COMMENT_PROBABILITY;
}

/** モデルが返した本文を LINE 視認性向上のため整形する。 */
function tidyReply(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw.trim();
  // 引用符で囲って返してくる稀なケースを剥がす。
  if (
    (text.startsWith('「') && text.endsWith('」')) ||
    (text.startsWith('"') && text.endsWith('"'))
  ) {
    text = text.slice(1, -1).trim();
  }
  if (!text) return null;
  // 行数制限。
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const trimmed = lines.slice(0, MAX_REPLY_LINES).join('\n');
  if (!trimmed) return null;
  if (trimmed.length <= MAX_REPLY_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_REPLY_CHARS)}…`;
}

/**
 * 内部実装側の戻り値。`generateCapiBuchoComment`(LINE 既存呼び出し)からは
 * `comment` だけ取り出して返し、`generateCapiBuchoCommentWithMeta`(Web 用 API
 * の Section 18.2.L 実装)からはまるごと露出する。
 *
 * `tokensUsed` は OpenAI usage の prompt + completion 合算。null の場合は
 * usage が API レスポンスから取れなかった or shouldComment で早期 return
 * したことを示す。
 */
export interface CapiBuchoResult {
  comment: string | null;
  tokensUsed: number | null;
}

/**
 * 内部実装。`generateCapiBuchoComment` と `generateCapiBuchoCommentWithMeta`
 * の両方から呼ばれる単一の真実の源(SSoT)。
 *
 * - shouldComment が false → comment=null, tokensUsed=null(LLM 呼び出しなし)
 * - LLM 呼び出し失敗 → comment=null, tokensUsed=null
 * - LLM 呼び出し成功で空文字に整形された → comment=null, tokensUsed=合算値
 *   (ここ重要: コメントを表示しなくても課金は発生しているので tokens は
 *    返す。Web 側のコスト把握のため)
 *
 * 例外を投げない。LINE 配信パスも Web API パスも絶対に壊さない。
 */
async function generateCapiBuchoCore(
  fastify: FastifyInstance,
  workspaceId: string,
  context: CapiBuchoContext,
): Promise<CapiBuchoResult> {
  if (!shouldComment(context)) return { comment: null, tokensUsed: null };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { comment: null, tokensUsed: null };

  const userPayload = [
    `[ユーザーの直前メッセージ]`,
    context.userMessage.trim() || '(なし)',
    '',
    `[おしごとAIの応答]`,
    context.aiResponse.trim(),
    '',
    'この応答に対して、カピぶちょーとして1〜3行で関西弁のリアクションだけを返してください。',
    'AIが既に説明した内容を繰り返すのは禁止。あなたは脇役なので短く。',
  ].join('\n');

  const messages = [
    { role: 'system' as const, content: CAPI_BUCHO_SYSTEM_PROMPT },
    { role: 'user' as const, content: userPayload },
  ];

  const startTime = Date.now();
  let content: string | null = null;
  let usage: { promptTokens: number; completionTokens: number } | undefined;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CAPI_BUCHO_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 200,
      }),
    });
    if (!res.ok) {
      fastify.log.warn(
        { status: res.status, body: await res.text() },
        '[capi-bucho] OpenAI call failed',
      );
      return { comment: null, tokensUsed: null };
    }
    const parsed = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    content = parsed.choices?.[0]?.message?.content ?? null;
    const rawUsage = parsed.usage;
    if (
      rawUsage &&
      typeof rawUsage.prompt_tokens === 'number' &&
      typeof rawUsage.completion_tokens === 'number'
    ) {
      usage = {
        promptTokens: rawUsage.prompt_tokens,
        completionTokens: rawUsage.completion_tokens,
      };
    }
  } catch (err) {
    fastify.log.warn({ err: String(err) }, '[capi-bucho] fetch threw');
    return { comment: null, tokensUsed: null };
  }

  const tidied = tidyReply(content);
  const tokensUsed = usage
    ? usage.promptTokens + usage.completionTokens
    : null;

  // Trace 記録(workspaceId が空なら省略)。fire-and-forget でユーザー体感を
  // 落とさない。失敗しても 配信パスは止めない。
  if (workspaceId && tidied) {
    recordLlmTrace({
      workspaceId,
      startTime,
      provider: 'openai',
      model: CAPI_BUCHO_MODEL,
      messages,
      responseText: tidied,
      usage,
      traceType: 'standard',
    });
  }

  return { comment: tidied, tokensUsed };
}

/**
 * カピぶちょー応答を生成する(LINE 用、既存呼び出し互換)。
 *
 * @returns 関西弁のリアクション文字列、またはコメント不要時は null。
 *          API キー未設定 / API エラー / 不適切な出力 はすべて null を返す。
 *          呼び出し側はこの場合 2 通目の push をスキップする。
 *
 * 呼び出し側への約束:
 *   - 例外を投げない。LINE 配信パスを絶対に壊さない。
 *   - workspaceId が空文字でも実行はする(trace 記録だけスキップ)。
 *   - 副作用は trace 記録のみ。会話履歴(`appendConversationTurn`)には
 *     保存しない(履歴汚染を避けるため、AI 本体応答だけが履歴に残る)。
 */
export async function generateCapiBuchoComment(
  fastify: FastifyInstance,
  workspaceId: string,
  context: CapiBuchoContext,
): Promise<string | null> {
  const { comment } = await generateCapiBuchoCore(fastify, workspaceId, context);
  return comment;
}

/**
 * カピぶちょー応答を生成する(Web 用 API 露出、Section 18.2.L)。
 *
 * `generateCapiBuchoComment` と同じロジックだが `tokensUsed` も返すので
 * Web ダッシュボード側が課金 / コスト把握の参考にできる。
 *
 * 振る舞いは LINE 用と同一:
 *   - shouldComment が false なら comment=null, tokensUsed=null
 *   - LLM 失敗時も同じ
 *   - 例外は投げない
 *
 * Web 側に journeyStep の概念は無いため、呼び出し側は context.journeyStep
 * を指定しない(undefined)。結果として確率判定 + 感情語判定で発話可否が
 * 決まる。
 */
export async function generateCapiBuchoCommentWithMeta(
  fastify: FastifyInstance,
  workspaceId: string,
  context: CapiBuchoContext,
): Promise<CapiBuchoResult> {
  return generateCapiBuchoCore(fastify, workspaceId, context);
}

// ─── Internal exports for unit tests ────────────────────────────────────────
// テスト容易性のため純関数を named export する。プロダクションコードからは
// 直接使わない(インターフェースは `generateCapiBuchoComment` に集約)。
export const __test__ = {
  shouldStaySilent,
  hasEmotionTrigger,
  shouldComment,
  tidyReply,
  EMOTION_KEYWORDS,
  AI_ERROR_PREFIXES,
  MIN_AI_RESPONSE_LENGTH,
  RANDOM_COMMENT_PROBABILITY,
  CAPI_BUCHO_SYSTEM_PROMPT,
};
