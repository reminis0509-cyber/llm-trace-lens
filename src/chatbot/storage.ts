/**
 * Chatbot Platform Storage Layer
 * CRUD operations for chatbots, documents, sessions, messages, and exchange rates.
 */
import crypto from 'crypto';
import { getKnex } from '../storage/knex-client.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface Chatbot {
  id: string;
  workspace_id: string;
  name: string;
  system_prompt: string | null;
  tone: 'polite' | 'casual' | 'business';
  welcome_message: string | null;
  model: string;
  temperature: number;
  max_tokens: number;
  widget_color: string;
  widget_position: string;
  widget_logo_url: string | null;
  publish_key: string | null;
  is_published: boolean;
  allowed_origins: string | null;
  rate_limit_per_minute: number;
  daily_message_limit: number;
  monthly_token_budget: number | null;
  // Crawler fields
  crawl_url: string | null;
  crawl_status: 'pending' | 'crawling' | 'completed' | 'error' | null;
  crawl_progress: string | null;
  crawl_error: string | null;
  crawled_at: string | null;
  // Design customization fields
  widget_secondary_color: string;
  widget_border_radius: string;
  widget_header_text: string | null;
  widget_font: string;
  widget_bubble_icon: string;
  widget_bubble_icon_url: string | null;
  widget_window_size: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  chatbot_id: string;
  workspace_id: string;
  filename: string;
  file_type: string;
  file_size: number | null;
  chunk_count: number;
  status: 'processing' | 'ready' | 'error';
  error_message: string | null;
  source_url: string | null;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chatbot_id: string;
  workspace_id: string;
  content: string;
  chunk_index: number;
  token_count: number | null;
  embedding_json: string | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  chatbot_id: string;
  workspace_id: string;
  visitor_id: string | null;
  started_at: string;
  last_message_at: string | null;
  message_count: number;
  metadata: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  chatbot_id: string;
  workspace_id: string;
  role: 'user' | 'assistant';
  content: string;
  source_chunks: string | null;
  token_count: number | null;
  latency_ms: number | null;
  trace_id: string | null;
  created_at: string;
}

export interface ExchangeRate {
  id: string;
  date: string;
  usd_jpy: number;
  source: string | null;
  fetched_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

function generatePublishKey(): string {
  return `cb_pub_${crypto.randomBytes(16).toString('hex')}`;
}

// ─── Chatbot CRUD ────────────────────────────────────────────────────

export async function createChatbot(
  workspaceId: string,
  data: { name: string; system_prompt?: string; tone?: string; welcome_message?: string; model?: string }
): Promise<Chatbot> {
  const knex = getKnex();
  const id = generateId();
  const now = new Date().toISOString();

  await knex('chatbots').insert({
    id,
    workspace_id: workspaceId,
    name: data.name,
    system_prompt: data.system_prompt || null,
    tone: data.tone || 'polite',
    welcome_message: data.welcome_message || null,
    model: data.model || 'gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 1024,
    widget_color: '#2563eb',
    widget_position: 'bottom-right',
    is_published: false,
    rate_limit_per_minute: 10,
    daily_message_limit: 1000,
    created_at: now,
    updated_at: now,
  });

  return getChatbot(id, workspaceId) as Promise<Chatbot>;
}

export async function getChatbot(id: string, workspaceId: string): Promise<Chatbot | null> {
  const knex = getKnex();
  return knex('chatbots').where({ id, workspace_id: workspaceId }).first() || null;
}

export async function getChatbotByPublishKey(publishKey: string): Promise<Chatbot | null> {
  const knex = getKnex();
  return knex('chatbots').where({ publish_key: publishKey, is_published: true }).first() || null;
}

export async function listChatbots(workspaceId: string): Promise<Chatbot[]> {
  const knex = getKnex();
  return knex('chatbots').where({ workspace_id: workspaceId }).orderBy('created_at', 'desc');
}

export async function updateChatbot(
  id: string,
  workspaceId: string,
  data: Partial<Omit<Chatbot, 'id' | 'workspace_id' | 'created_at'>>
): Promise<Chatbot | null> {
  const knex = getKnex();
  await knex('chatbots')
    .where({ id, workspace_id: workspaceId })
    .update({ ...data, updated_at: new Date().toISOString() });
  return getChatbot(id, workspaceId);
}

export async function deleteChatbot(id: string, workspaceId: string): Promise<boolean> {
  const knex = getKnex();
  // Cascade: delete chunks, documents, messages, sessions
  await knex('chat_messages').where({ chatbot_id: id, workspace_id: workspaceId }).delete();
  await knex('chat_sessions').where({ chatbot_id: id, workspace_id: workspaceId }).delete();
  await knex('document_chunks').where({ chatbot_id: id, workspace_id: workspaceId }).delete();
  await knex('documents').where({ chatbot_id: id, workspace_id: workspaceId }).delete();
  const count = await knex('chatbots').where({ id, workspace_id: workspaceId }).delete();
  return count > 0;
}

export async function publishChatbot(id: string, workspaceId: string): Promise<{ publishKey: string; embedScript: string } | null> {
  const knex = getKnex();
  const chatbot = await getChatbot(id, workspaceId);
  if (!chatbot) return null;

  const publishKey = chatbot.publish_key || generatePublishKey();
  await knex('chatbots')
    .where({ id, workspace_id: workspaceId })
    .update({ publish_key: publishKey, is_published: true, updated_at: new Date().toISOString() });

  const baseUrl = process.env.BASE_URL || 'https://fujitrace.jp';
  const embedScript = `<script src="${baseUrl}/widget/embed.js" data-key="${publishKey}" async></script>`;

  return { publishKey, embedScript };
}

// ─── Document CRUD ───────────────────────────────────────────────────

export async function createDocument(
  chatbotId: string,
  workspaceId: string,
  data: { filename: string; file_type: string; file_size: number }
): Promise<Document> {
  const knex = getKnex();
  const id = generateId();

  await knex('documents').insert({
    id,
    chatbot_id: chatbotId,
    workspace_id: workspaceId,
    filename: data.filename,
    file_type: data.file_type,
    file_size: data.file_size,
    chunk_count: 0,
    status: 'processing',
    created_at: new Date().toISOString(),
  });

  return knex('documents').where({ id }).first() as Promise<Document>;
}

export async function updateDocumentStatus(
  id: string,
  status: 'processing' | 'ready' | 'error',
  chunkCount?: number,
  errorMessage?: string
): Promise<void> {
  const knex = getKnex();
  const update: Record<string, unknown> = { status };
  if (chunkCount !== undefined) update.chunk_count = chunkCount;
  if (errorMessage !== undefined) update.error_message = errorMessage;
  await knex('documents').where({ id }).update(update);
}

export async function listDocuments(chatbotId: string, workspaceId: string): Promise<Document[]> {
  const knex = getKnex();
  return knex('documents')
    .where({ chatbot_id: chatbotId, workspace_id: workspaceId })
    .orderBy('created_at', 'desc');
}

export async function deleteDocument(id: string, chatbotId: string, workspaceId: string): Promise<boolean> {
  const knex = getKnex();
  await knex('document_chunks').where({ document_id: id, workspace_id: workspaceId }).delete();
  const count = await knex('documents').where({ id, chatbot_id: chatbotId, workspace_id: workspaceId }).delete();
  return count > 0;
}

// ─── Document Chunks ─────────────────────────────────────────────────

export async function insertChunks(chunks: Array<{
  document_id: string;
  chatbot_id: string;
  workspace_id: string;
  content: string;
  chunk_index: number;
  token_count: number;
  embedding: number[];
}>): Promise<void> {
  const knex = getKnex();
  const client = knex.client.config.client;
  const isPg = client === 'pg' || client === 'postgresql';

  for (const chunk of chunks) {
    const id = generateId();
    const embeddingJson = JSON.stringify(chunk.embedding);

    if (isPg) {
      // Use pgvector for PostgreSQL
      await knex.raw(
        `INSERT INTO document_chunks (id, document_id, chatbot_id, workspace_id, content, chunk_index, token_count, embedding_json, embedding, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::vector, ?)`,
        [id, chunk.document_id, chunk.chatbot_id, chunk.workspace_id, chunk.content, chunk.chunk_index, chunk.token_count, embeddingJson, `[${chunk.embedding.join(',')}]`, new Date().toISOString()]
      );
    } else {
      // SQLite: store as JSON
      await knex('document_chunks').insert({
        id,
        document_id: chunk.document_id,
        chatbot_id: chunk.chatbot_id,
        workspace_id: chunk.workspace_id,
        content: chunk.content,
        chunk_index: chunk.chunk_index,
        token_count: chunk.token_count,
        embedding_json: embeddingJson,
        created_at: new Date().toISOString(),
      });
    }
  }
}

// ─── Chat Sessions & Messages ────────────────────────────────────────

export async function getOrCreateSession(
  chatbotId: string,
  workspaceId: string,
  visitorId: string,
  metadata?: Record<string, string>
): Promise<ChatSession> {
  const knex = getKnex();

  // Find existing active session (within last 30 minutes)
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const existing = await knex('chat_sessions')
    .where({ chatbot_id: chatbotId, visitor_id: visitorId })
    .where('last_message_at', '>', thirtyMinAgo)
    .orderBy('last_message_at', 'desc')
    .first();

  if (existing) return existing;

  const id = generateId();
  const now = new Date().toISOString();
  await knex('chat_sessions').insert({
    id,
    chatbot_id: chatbotId,
    workspace_id: workspaceId,
    visitor_id: visitorId,
    started_at: now,
    last_message_at: now,
    message_count: 0,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });

  return knex('chat_sessions').where({ id }).first() as Promise<ChatSession>;
}

export async function addMessage(data: {
  session_id: string;
  chatbot_id: string;
  workspace_id: string;
  role: 'user' | 'assistant';
  content: string;
  source_chunks?: string[];
  token_count?: number;
  latency_ms?: number;
  trace_id?: string;
}): Promise<ChatMessage> {
  const knex = getKnex();
  const id = generateId();
  const now = new Date().toISOString();

  await knex('chat_messages').insert({
    id,
    session_id: data.session_id,
    chatbot_id: data.chatbot_id,
    workspace_id: data.workspace_id,
    role: data.role,
    content: data.content,
    source_chunks: data.source_chunks ? JSON.stringify(data.source_chunks) : null,
    token_count: data.token_count || null,
    latency_ms: data.latency_ms || null,
    trace_id: data.trace_id || null,
    created_at: now,
  });

  // Update session
  await knex('chat_sessions')
    .where({ id: data.session_id })
    .update({
      last_message_at: now,
      message_count: knex.raw('message_count + 1'),
    });

  return knex('chat_messages').where({ id }).first() as Promise<ChatMessage>;
}

export async function getSessionHistory(
  sessionId: string,
  limit: number = 10
): Promise<ChatMessage[]> {
  const knex = getKnex();
  return knex('chat_messages')
    .where({ session_id: sessionId })
    .orderBy('created_at', 'desc')
    .limit(limit)
    .then(rows => rows.reverse());
}

export async function listSessions(
  chatbotId: string,
  workspaceId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ChatSession[]> {
  const knex = getKnex();
  return knex('chat_sessions')
    .where({ chatbot_id: chatbotId, workspace_id: workspaceId })
    .orderBy('last_message_at', 'desc')
    .limit(limit)
    .offset(offset);
}

export async function getSessionMessages(
  sessionId: string,
  workspaceId: string
): Promise<ChatMessage[]> {
  const knex = getKnex();
  return knex('chat_messages')
    .where({ session_id: sessionId, workspace_id: workspaceId })
    .orderBy('created_at', 'asc');
}

// ─── Exchange Rates ──────────────────────────────────────────────────

export async function saveExchangeRate(date: string, usdJpy: number, source: string): Promise<void> {
  const knex = getKnex();
  const id = generateId();
  const existing = await knex('exchange_rates').where({ date }).first();
  if (existing) {
    await knex('exchange_rates').where({ date }).update({ usd_jpy: usdJpy, source, fetched_at: new Date().toISOString() });
  } else {
    await knex('exchange_rates').insert({ id, date, usd_jpy: usdJpy, source, fetched_at: new Date().toISOString() });
  }
}

export async function getExchangeRate(date?: string): Promise<ExchangeRate | null> {
  const knex = getKnex();
  if (date) {
    return knex('exchange_rates').where({ date }).first() || null;
  }
  // Get latest
  return knex('exchange_rates').orderBy('date', 'desc').first() || null;
}

// ─── Crawler ────────────────────────────────────────────────────────

export async function updateCrawlStatus(
  chatbotId: string,
  workspaceId: string,
  status: 'pending' | 'crawling' | 'completed' | 'error',
  progress?: string,
  error?: string
): Promise<void> {
  const knex = getKnex();
  const update: Record<string, unknown> = {
    crawl_status: status,
    updated_at: new Date().toISOString(),
  };
  if (progress !== undefined) update.crawl_progress = progress;
  if (error !== undefined) update.crawl_error = error;
  if (status === 'completed') update.crawled_at = new Date().toISOString();
  await knex('chatbots').where({ id: chatbotId, workspace_id: workspaceId }).update(update);
}

export async function createDocumentFromUrl(
  chatbotId: string,
  workspaceId: string,
  data: { url: string; title: string; content_size: number }
): Promise<Document> {
  const knex = getKnex();
  const id = generateId();

  await knex('documents').insert({
    id,
    chatbot_id: chatbotId,
    workspace_id: workspaceId,
    filename: data.title,
    file_type: 'url',
    file_size: data.content_size,
    chunk_count: 0,
    status: 'processing',
    source_url: data.url,
    created_at: new Date().toISOString(),
  });

  return knex('documents').where({ id }).first() as Promise<Document>;
}

export async function deleteDocumentsByType(
  chatbotId: string,
  workspaceId: string,
  fileType: string
): Promise<number> {
  const knex = getKnex();
  // First delete associated chunks
  const docIds = await knex('documents')
    .where({ chatbot_id: chatbotId, workspace_id: workspaceId, file_type: fileType })
    .pluck('id');

  if (docIds.length > 0) {
    await knex('document_chunks').whereIn('document_id', docIds).delete();
  }

  return knex('documents')
    .where({ chatbot_id: chatbotId, workspace_id: workspaceId, file_type: fileType })
    .delete();
}

// ─── Stats ───────────────────────────────────────────────────────────

export async function getChatbotStats(chatbotId: string, workspaceId: string): Promise<{
  total_sessions: number;
  total_messages: number;
  today_messages: number;
}> {
  const knex = getKnex();
  const today = new Date().toISOString().split('T')[0];

  const [sessionCount] = await knex('chat_sessions')
    .where({ chatbot_id: chatbotId, workspace_id: workspaceId })
    .count('id as count');

  const [messageCount] = await knex('chat_messages')
    .where({ chatbot_id: chatbotId, workspace_id: workspaceId })
    .count('id as count');

  const [todayCount] = await knex('chat_messages')
    .where({ chatbot_id: chatbotId, workspace_id: workspaceId })
    .where('created_at', '>=', `${today}T00:00:00`)
    .count('id as count');

  return {
    total_sessions: Number(sessionCount?.count || 0),
    total_messages: Number(messageCount?.count || 0),
    today_messages: Number(todayCount?.count || 0),
  };
}
