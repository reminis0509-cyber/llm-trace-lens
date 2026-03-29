/**
 * Chat Engine
 * Orchestrates RAG search → prompt construction → LLM call via FujiTrace proxy.
 * Every LLM call is automatically traced by FujiTrace.
 */
import type { FastifyInstance } from 'fastify';
import { embed } from './rag/embedder.js';
import { searchSimilarChunks } from './rag/vector-store.js';
import {
  getChatbot,
  getChatbotByPublishKey,
  getOrCreateSession,
  getSessionHistory,
  addMessage,
  type Chatbot,
} from './storage.js';

const DEFAULT_SYSTEM_PROMPT = `あなたは企業のカスタマーサポートAIアシスタントです。
以下のルールに従って回答してください:
- 日本語で丁寧に回答してください
- 参考情報に基づいて正確に回答してください
- 参考情報にない内容については「申し訳ございませんが、その件についてはお答えできません。担当者にお繋ぎしますので、少々お待ちください。」と回答してください
- 回答は簡潔にしてください（200文字以内を目安）`;

const TONE_INSTRUCTIONS: Record<string, string> = {
  polite: '敬語を使って丁寧に回答してください。',
  casual: 'フレンドリーで親しみやすい口調で回答してください。',
  business: 'ビジネスライクで簡潔な口調で回答してください。',
};

export interface ChatResponse {
  answer: string;
  sources: Array<{ content: string; similarity: number }>;
  sessionId: string;
  traceId?: string;
}

/**
 * Process a chat message and return a response.
 * Uses fastify.inject() to route through FujiTrace proxy for automatic tracing.
 */
export async function reply(
  fastify: FastifyInstance,
  publishKey: string,
  visitorId: string,
  userMessage: string,
  metadata?: Record<string, string>
): Promise<ChatResponse> {
  const startTime = Date.now();

  // 1. Get chatbot config
  const chatbot = await getChatbotByPublishKey(publishKey);
  if (!chatbot) {
    throw new Error('Chatbot not found or not published');
  }

  // 2. Get or create session
  const session = await getOrCreateSession(
    chatbot.id,
    chatbot.workspace_id,
    visitorId,
    metadata
  );

  // 3. Save user message
  await addMessage({
    session_id: session.id,
    chatbot_id: chatbot.id,
    workspace_id: chatbot.workspace_id,
    role: 'user',
    content: userMessage,
  });

  // 4. RAG search
  let sources: Array<{ content: string; similarity: number }> = [];
  try {
    const queryEmbedding = await embed(userMessage);
    const results = await searchSimilarChunks(chatbot.id, queryEmbedding, 3, 0.5);
    sources = results.map(r => ({ content: r.content, similarity: r.similarity }));
  } catch (err) {
    console.warn('[ChatEngine] RAG search failed, proceeding without context:', err);
  }

  // 5. Build prompt
  const messages = buildMessages(chatbot, session.id, userMessage, sources);

  // 6. Get session history
  const history = await getSessionHistory(session.id, 5);
  const historyMessages = history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(0, -1) // Exclude the user message we just added
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // Insert history before the current user message
  const allMessages = [
    messages[0], // system
    ...historyMessages,
    ...messages.slice(1), // current user message
  ];

  // 7. Call LLM via FujiTrace proxy (fastify.inject)
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const injectResponse = await fastify.inject({
    method: 'POST',
    url: '/v1/chat/completions',
    headers: { 'content-type': 'application/json' },
    payload: {
      model: chatbot.model || 'gpt-4o-mini',
      messages: allMessages,
      temperature: chatbot.temperature || 0.3,
      maxTokens: chatbot.max_tokens || 1024,
      api_key: apiKey,
    },
  });

  if (injectResponse.statusCode !== 200) {
    console.error(`[ChatEngine] Proxy error: ${injectResponse.statusCode} ${injectResponse.body}`);
    throw new Error('Failed to get response from AI');
  }

  const result = JSON.parse(injectResponse.body);
  const answer = result.choices?.[0]?.message?.content || '申し訳ございません。回答を生成できませんでした。';
  const traceId = result._trace?.requestId;
  const latencyMs = Date.now() - startTime;

  // 8. Save assistant message
  await addMessage({
    session_id: session.id,
    chatbot_id: chatbot.id,
    workspace_id: chatbot.workspace_id,
    role: 'assistant',
    content: answer,
    source_chunks: sources.length > 0 ? sources.map((_, i) => `chunk_${i}`) : undefined,
    token_count: result.usage?.total_tokens,
    latency_ms: latencyMs,
    trace_id: traceId,
  });

  return {
    answer,
    sources,
    sessionId: session.id,
    traceId,
  };
}

/**
 * Build messages array for LLM call
 */
function buildMessages(
  chatbot: Chatbot,
  _sessionId: string,
  userMessage: string,
  sources: Array<{ content: string; similarity: number }>
): Array<{ role: 'system' | 'user'; content: string }> {
  // System prompt
  let systemPrompt = chatbot.system_prompt || DEFAULT_SYSTEM_PROMPT;

  // Add tone instruction
  const toneInstruction = TONE_INSTRUCTIONS[chatbot.tone] || TONE_INSTRUCTIONS.polite;
  systemPrompt += `\n\n${toneInstruction}`;

  // Add RAG context
  if (sources.length > 0) {
    const context = sources.map((s, i) => `[参考${i + 1}] ${s.content}`).join('\n\n');
    systemPrompt += `\n\n## 参考情報\n以下の参考情報を基に回答してください。参考情報にない内容には答えないでください。\n\n${context}`;
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];
}
