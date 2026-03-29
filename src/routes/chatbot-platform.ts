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
  listSessions,
  getSessionMessages,
  getChatbotStats,
  getChatbotByPublishKey,
  getExchangeRate,
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

  // 2. Dashboard auth (RBAC plugin sets request.user)
  const userEmail = request.user?.email;
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

    // Parse multipart
    const data = await (request as unknown as { file: () => Promise<{
      filename: string;
      mimetype: string;
      file: { toBuffer: () => Promise<Buffer> };
    }> }).file();

    if (!data) return reply.code(400).send({ error: 'No file uploaded' });

    const buffer = await data.file.toBuffer();
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
