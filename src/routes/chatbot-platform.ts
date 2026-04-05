/**
 * Chatbot Platform Routes
 * Dashboard APIs (workspace auth) + Widget APIs (publish key auth)
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  createChatbot,
  getChatbot,
  listChatbots,
  updateChatbot,
  deleteChatbot,
  publishChatbot,
  createDocument,
  listDocuments,
  deleteDocument,
  deleteDocumentsByType,
  listSessions,
  getSessionMessages,
  getChatbotStats,
  getChatbotByPublishKey,
  getExchangeRate,
  processCrawl,
} from '../chatbot/index.js';
import { reply as chatReply } from '../chatbot/chat-engine.js';
import { processDocument } from '../chatbot/rag/pipeline.js';
import { getUsdJpyRate } from '../chatbot/exchange-rate.js';

// ─── Schemas ─────────────────────────────────────────────────────────

const createChatbotSchema = z.object({
  name: z.string().min(1).max(100),
  system_prompt: z.string().max(5000).optional(),
  tone: z.enum(['polite', 'casual', 'business']).optional(),
  welcome_message: z.string().max(500).optional(),
  model: z.string().optional(),
});

const updateChatbotSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  system_prompt: z.string().max(5000).optional(),
  tone: z.enum(['polite', 'casual', 'business']).optional(),
  welcome_message: z.string().max(500).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().min(100).max(4096).optional(),
  widget_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  widget_position: z.enum(['bottom-right', 'bottom-left']).optional(),
  allowed_origins: z.string().optional(),
  rate_limit_per_minute: z.number().min(1).max(100).optional(),
  daily_message_limit: z.number().min(10).max(100000).optional(),
  monthly_token_budget: z.number().min(0).optional(),
  // Design customization
  widget_secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  widget_border_radius: z.enum(['sharp', 'rounded', 'pill']).optional(),
  widget_header_text: z.string().max(100).optional(),
  widget_font: z.enum(['system', 'noto-sans-jp', 'hiragino']).optional(),
  widget_bubble_icon: z.enum(['chat', 'question', 'headset', 'custom']).optional(),
  widget_bubble_icon_url: z.string().url().max(500).optional().nullable(),
  widget_window_size: z.enum(['compact', 'standard', 'large']).optional(),
});

const crawlRequestSchema = z.object({
  url: z.string().url().max(2000),
});

const widgetChatSchema = z.object({
  message: z.string().min(1).max(2000),
  visitor_id: z.string().min(1).max(100),
  metadata: z.record(z.string()).optional(),
});

// ─── Helper ──────────────────────────────────────────────────────────

import { getKnex } from '../storage/knex-client.js';

/**
 * Resolve workspaceId from request context.
 * Priority: API key auth > dashboard auth (user email) > null
 */
async function resolveWorkspaceId(request: FastifyRequest): Promise<string | null> {
  // 1. API key auth (resolved by auth middleware)
  if (request.workspace?.workspaceId) {
    return request.workspace.workspaceId;
  }

  // 2. Dashboard auth (RBAC plugin sets request.user from X-User-ID/X-User-Email headers)
  const userEmail = request.user?.email ||
    (request.headers['x-user-email'] as string | undefined);
  if (userEmail) {
    try {
      const db = getKnex();
      const membership = await db('workspace_users')
        .where({ email: userEmail.toLowerCase() })
        .orderBy('created_at', 'asc')
        .first();
      if (membership?.workspace_id) {
        return membership.workspace_id as string;
      }
    } catch {
      // DB lookup failed
    }
  }

  // 3. Fallback: check X-Workspace-ID header (legacy support)
  const workspaceHeader = request.headers['x-workspace-id'] as string | undefined;
  if (workspaceHeader) {
    return workspaceHeader;
  }

  // 4. If user is authenticated (has any user header) but workspace not found,
  // fall back to 'default' workspace
  const userId = request.headers['x-user-id'] as string | undefined;
  if (userId || userEmail) {
    return 'default';
  }

  return null;
}

// ─── Routes ──────────────────────────────────────────────────────────

export async function chatbotPlatformRoutes(fastify: FastifyInstance): Promise<void> {

  // ═══ Dashboard APIs (workspace auth required) ═══

  // List chatbots
  fastify.get('/api/chatbots', async (request, reply) => {
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) return reply.code(401).send({ error: 'Unauthorized' });
    const chatbots = await listChatbots(workspaceId);
    return reply.send({ chatbots });
  });

  // Create chatbot
  fastify.post('/api/chatbots', async (request, reply) => {
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) return reply.code(401).send({ error: 'Unauthorized' });

    const parsed = createChatbotSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Bad Request', details: parsed.error.errors });
    }

    const chatbot = await createChatbot(workspaceId, parsed.data);
    return reply.code(201).send({ chatbot });
  });

  // Get chatbot
  fastify.get('/api/chatbots/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) return reply.code(401).send({ error: 'Unauthorized' });

    const chatbot = await getChatbot(request.params.id, workspaceId);
    if (!chatbot) return reply.code(404).send({ error: 'Chatbot not found' });
    return reply.send({ chatbot });
  });

  // Update chatbot
  fastify.put('/api/chatbots/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) return reply.code(401).send({ error: 'Unauthorized' });

    const parsed = updateChatbotSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Bad Request', details: parsed.error.errors });
    }

    const chatbot = await updateChatbot(request.params.id, workspaceId, parsed.data);
    if (!chatbot) return reply.code(404).send({ error: 'Chatbot not found' });
    return reply.send({ chatbot });
  });

  // Delete chatbot
  fastify.delete('/api/chatbots/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) return reply.code(401).send({ error: 'Unauthorized' });

    const deleted = await deleteChatbot(request.params.id, workspaceId);
    if (!deleted) return reply.code(404).send({ error: 'Chatbot not found' });
    return reply.send({ success: true });
  });

  // Publish chatbot (generate embed script)
  fastify.post('/api/chatbots/:id/publish', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) return reply.code(401).send({ error: 'Unauthorized' });

    const result = await publishChatbot(request.params.id, workspaceId);
    if (!result) return reply.code(404).send({ error: 'Chatbot not found' });
    return reply.send(result);
  });

  // Upload document
  fastify.post('/api/chatbots/:id/documents', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) return reply.code(401).send({ error: 'Unauthorized' });

    const chatbot = await getChatbot(request.params.id, workspaceId);
    if (!chatbot) return reply.code(404).send({ error: 'Chatbot not found' });

    // Parse multipart file upload
    const data = await request.file();

    if (!data) return reply.code(400).send({ error: 'No file uploaded' });

    const buffer = await data.toBuffer();
    const fileSize = buffer.length;

    // 10MB limit
    if (fileSize > 10 * 1024 * 1024) {
      return reply.code(413).send({ error: 'File too large. Maximum size is 10MB.' });
    }

    // Determine file type
    const ext = data.filename.split('.').pop()?.toLowerCase() || '';
    const allowedTypes = ['pdf', 'txt', 'csv', 'json'];
    const fileType = allowedTypes.includes(ext) ? ext : 'txt';

    // Create document record
    const document = await createDocument(chatbot.id, workspaceId, {
      filename: data.filename,
      file_type: fileType,
      file_size: fileSize,
    });

    // Process asynchronously (don't wait)
    processDocument(document.id, chatbot.id, workspaceId, buffer, fileType).catch(err => {
      console.error(`[ChatbotPlatform] Document processing error:`, err);
    });

    return reply.code(202).send({ document, message: 'Document uploaded and processing started' });
  });

  // List documents
  fastify.get('/api/chatbots/:id/documents', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) return reply.code(401).send({ error: 'Unauthorized' });

    const documents = await listDocuments(request.params.id, workspaceId);
    return reply.send({ documents });
  });

  // Delete document
  fastify.delete('/api/chatbots/:id/documents/:docId', async (request: FastifyRequest<{ Params: { id: string; docId: string } }>, reply) => {
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) return reply.code(401).send({ error: 'Unauthorized' });

    const deleted = await deleteDocument(request.params.docId, request.params.id, workspaceId);
    if (!deleted) return reply.code(404).send({ error: 'Document not found' });
    return reply.send({ success: true });
  });

  // List sessions
  fastify.get('/api/chatbots/:id/sessions', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: string; offset?: string } }>, reply) => {
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) return reply.code(401).send({ error: 'Unauthorized' });

    const limit = parseInt(request.query.limit || '50', 10);
    const offset = parseInt(request.query.offset || '0', 10);
    const sessions = await listSessions(request.params.id, workspaceId, limit, offset);
    return reply.send({ sessions });
  });

  // Get session messages
  fastify.get('/api/chatbots/:id/sessions/:sessionId/messages', async (request: FastifyRequest<{ Params: { id: string; sessionId: string } }>, reply) => {
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) return reply.code(401).send({ error: 'Unauthorized' });

    const messages = await getSessionMessages(request.params.sessionId, workspaceId);
    return reply.send({ messages });
  });

  // Get chatbot stats
  fastify.get('/api/chatbots/:id/stats', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) return reply.code(401).send({ error: 'Unauthorized' });

    const stats = await getChatbotStats(request.params.id, workspaceId);
    return reply.send({ stats });
  });

  // Get exchange rate
  fastify.get('/api/exchange-rate', async (_request, reply) => {
    const rate = await getUsdJpyRate();
    return reply.send({ rate });
  });

  // ═══ Crawl APIs ═══

  /**
   * POST /api/chatbots/:id/crawl
   * Start HP auto-learning crawl.
   * Request: { url: string }
   * Response: 202 { success: true, message: string }
   */
  fastify.post('/api/chatbots/:id/crawl', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const workspaceId = await resolveWorkspaceId(request);
      if (!workspaceId) return reply.code(401).send({ error: 'Unauthorized' });

      const chatbot = await getChatbot(request.params.id, workspaceId);
      if (!chatbot) return reply.code(404).send({ error: 'チャットボットが見つかりません' });

      const parsed = crawlRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'URLが無効です', details: parsed.error.errors });
      }

      // Prevent double crawl
      if (chatbot.crawl_status === 'crawling') {
        return reply.code(409).send({ error: 'クロールは既に実行中です' });
      }

      // Start async crawl (do not await)
      processCrawl(chatbot.id, workspaceId, parsed.data.url).catch(err => {
        request.log.error({ err, chatbotId: chatbot.id }, 'クロールパイプラインエラー');
      });

      return reply.code(202).send({ success: true, message: 'クロールを開始しました' });
    } catch (err) {
      request.log.error({ err }, 'クロール開始エラー');
      return reply.code(500).send({ error: 'クロールの開始に失敗しました' });
    }
  });

  /**
   * GET /api/chatbots/:id/crawl/status
   * Get current crawl status and progress.
   * Response: { crawl_url, crawl_status, crawl_progress, crawl_error, crawled_at }
   */
  fastify.get('/api/chatbots/:id/crawl/status', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const workspaceId = await resolveWorkspaceId(request);
      if (!workspaceId) return reply.code(401).send({ error: 'Unauthorized' });

      const chatbot = await getChatbot(request.params.id, workspaceId);
      if (!chatbot) return reply.code(404).send({ error: 'チャットボットが見つかりません' });

      return reply.send({
        crawl_url: chatbot.crawl_url,
        crawl_status: chatbot.crawl_status,
        crawl_progress: chatbot.crawl_progress ? JSON.parse(chatbot.crawl_progress) : null,
        crawl_error: chatbot.crawl_error,
        crawled_at: chatbot.crawled_at,
      });
    } catch (err) {
      request.log.error({ err }, 'クロールステータス取得エラー');
      return reply.code(500).send({ error: 'ステータスの取得に失敗しました' });
    }
  });

  /**
   * DELETE /api/chatbots/:id/crawl
   * Delete all URL-type documents and reset crawl fields.
   * Response: { success: true, deleted_count: number }
   */
  fastify.delete('/api/chatbots/:id/crawl', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const workspaceId = await resolveWorkspaceId(request);
      if (!workspaceId) return reply.code(401).send({ error: 'Unauthorized' });

      const chatbot = await getChatbot(request.params.id, workspaceId);
      if (!chatbot) return reply.code(404).send({ error: 'チャットボットが見つかりません' });

      // Delete all url-type documents and their chunks
      const deletedCount = await deleteDocumentsByType(chatbot.id, workspaceId, 'url');

      // Reset crawl fields
      await updateChatbot(chatbot.id, workspaceId, {
        crawl_url: null,
        crawl_status: null,
        crawl_progress: null,
        crawl_error: null,
        crawled_at: null,
      });

      return reply.send({ success: true, deleted_count: deletedCount });
    } catch (err) {
      request.log.error({ err }, 'クロールデータ削除エラー');
      return reply.code(500).send({ error: 'クロールデータの削除に失敗しました' });
    }
  });

  // ═══ Widget APIs (publish key auth, no workspace auth) ═══

  // Get widget config
  fastify.get('/api/widget/:publishKey/config', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => request.ip,
      },
    },
  }, async (request: FastifyRequest<{ Params: { publishKey: string } }>, reply) => {
    const chatbot = await getChatbotByPublishKey(request.params.publishKey);
    if (!chatbot) return reply.code(404).send({ error: 'Chatbot not found' });

    // CORS check
    const origin = request.headers.origin;
    if (origin && chatbot.allowed_origins) {
      const allowed = JSON.parse(chatbot.allowed_origins) as string[];
      if (allowed.length > 0 && !allowed.includes(origin)) {
        return reply.code(403).send({ error: 'Origin not allowed' });
      }
    }

    return reply.send({
      name: chatbot.name,
      welcome_message: chatbot.welcome_message,
      widget_color: chatbot.widget_color,
      widget_position: chatbot.widget_position,
      widget_logo_url: chatbot.widget_logo_url,
      widget_secondary_color: chatbot.widget_secondary_color,
      widget_border_radius: chatbot.widget_border_radius,
      widget_header_text: chatbot.widget_header_text,
      widget_font: chatbot.widget_font,
      widget_bubble_icon: chatbot.widget_bubble_icon,
      widget_bubble_icon_url: chatbot.widget_bubble_icon_url,
      widget_window_size: chatbot.widget_window_size,
    });
  });

  // Widget chat endpoint
  fastify.post('/api/widget/:publishKey/chat', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => {
          const body = request.body as { visitor_id?: string } | undefined;
          return body?.visitor_id || request.ip;
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { publishKey: string } }>, reply) => {
    const parsed = widgetChatSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Bad Request', details: parsed.error.errors });
    }

    try {
      const result = await chatReply(
        fastify,
        request.params.publishKey,
        parsed.data.visitor_id,
        parsed.data.message,
        parsed.data.metadata
      );

      return reply.send({
        answer: result.answer,
        session_id: result.sessionId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message === 'Chatbot not found or not published') {
        return reply.code(404).send({ error: message });
      }
      console.error('[Widget Chat] Error:', message);
      return reply.code(500).send({
        answer: '申し訳ございません。現在応答できません。しばらくしてからもう一度お試しください。',
      });
    }
  });
}

export default chatbotPlatformRoutes;
