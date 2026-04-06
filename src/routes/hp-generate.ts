/**
 * HP (Homepage) Generation Route
 *
 * POST /api/hp-generate
 * Headers: Authorization via auth middleware (X-User-Email or API key)
 *
 * Request body:
 * {
 *   "business_name": "サンプル食堂",
 *   "template": "restaurant" | "salon" | "office",
 *   "business_info": {
 *     "address": "東京都渋谷区...",
 *     "phone": "03-1234-5678",
 *     "hours": "11:00-22:00",        // optional
 *     "catchcopy": "心を込めた...",   // optional
 *     "menu_items": [...],            // optional
 *     "stylists": [...],              // optional
 *     "services": [...],              // optional
 *     "representative_name": "...",   // optional
 *     "qualification": "..."          // optional
 *   }
 * }
 *
 * Response:
 * { "publish_key": "pk_xxx", "chatbot_id": "xxx", "workspace_id": "xxx" }
 *
 * Abuse prevention:
 * - Rate limit: 3 requests/hour per user (route-level)
 * - Total limit: 10 HP generations per workspace lifetime (DB check)
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { createChatbot, publishChatbot } from '../chatbot/index.js';
import { getKnex } from '../storage/knex-client.js';

// ─── Constants ──────────────────────────────────────────────────────

const HP_GENERATION_LIFETIME_LIMIT = 10;

// ─── Zod Schema ─────────────────────────────────────────────────────

const menuItemSchema = z.object({
  name: z.string().max(100),
  price: z.string().max(50),
});

const stylistSchema = z.object({
  name: z.string().max(100),
});

const serviceSchema = z.object({
  name: z.string().max(200),
  price: z.string().max(50).optional(),
});

const businessInfoSchema = z.object({
  address: z.string().min(1).max(200),
  phone: z.string().min(1).max(20).regex(/^[\d\-（）()]+$/, {
    message: '電話番号の形式が正しくありません',
  }),
  hours: z.string().max(100).optional(),
  catchcopy: z.string().max(200).optional(),
  menu_items: z.array(menuItemSchema).max(50).optional(),
  stylists: z.array(stylistSchema).max(50).optional(),
  services: z.array(serviceSchema).max(50).optional(),
  representative_name: z.string().max(100).optional(),
  qualification: z.string().max(100).optional(),
});

const hpGenerateSchema = z.object({
  business_name: z.string().min(1).max(100),
  template: z.enum(['restaurant', 'salon', 'office']),
  business_info: businessInfoSchema,
});

type HpGenerateBody = z.infer<typeof hpGenerateSchema>;

// ─── Helper ─────────────────────────────────────────────────────────

/**
 * Resolve workspaceId from request context.
 * Same pattern as chatbot-platform.ts resolveWorkspaceId().
 */
async function resolveWorkspaceId(request: FastifyRequest): Promise<string | null> {
  if (request.workspace?.workspaceId) {
    return request.workspace.workspaceId;
  }

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

  const workspaceHeader = request.headers['x-workspace-id'] as string | undefined;
  if (workspaceHeader) {
    return workspaceHeader;
  }

  const userId = request.headers['x-user-id'] as string | undefined;
  if (userId || userEmail) {
    return 'default';
  }

  return null;
}

/**
 * Build a system prompt from the business info for the chatbot.
 */
function buildSystemPrompt(businessName: string, info: HpGenerateBody['business_info']): string {
  const lines: string[] = [
    `あなたは「${businessName}」のAIアシスタントです。`,
    `住所: ${info.address}`,
    `電話番号: ${info.phone}`,
  ];

  if (info.hours) {
    lines.push(`営業時間: ${info.hours}`);
  }

  lines.push(
    'お客様からの質問に丁寧にお答えください。',
    '詳しい情報については、お電話でお問い合わせいただくようご案内してください。',
  );

  return lines.join('\n');
}

/**
 * Get the count of HP generations for a workspace.
 */
async function getHpGenerationCount(workspaceId: string): Promise<number> {
  const db = getKnex();
  const result = await db('hp_generations')
    .where({ workspace_id: workspaceId })
    .count('id as count')
    .first();
  return Number(result?.count ?? 0);
}

/**
 * Record an HP generation event.
 */
async function recordHpGeneration(
  workspaceId: string,
  template: string,
  businessName: string,
  chatbotId: string,
): Promise<void> {
  const db = getKnex();
  const id = crypto.randomUUID();
  await db('hp_generations').insert({
    id,
    workspace_id: workspaceId,
    template,
    business_name: businessName,
    chatbot_id: chatbotId,
    created_at: new Date().toISOString(),
  });
}

// ─── Route Registration ─────────────────────────────────────────────

export async function hpGenerateRoutes(fastify: FastifyInstance): Promise<void> {

  /**
   * POST /api/hp-generate
   * Generate a homepage with a pre-installed FujiTrace chatbot widget.
   * Returns the publish_key for widget embedding.
   */
  fastify.post('/api/hp-generate', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 hour',
        keyGenerator: (request: FastifyRequest) => {
          const userEmail = request.user?.email ||
            (request.headers['x-user-email'] as string | undefined);
          return userEmail || request.ip;
        },
        errorResponseBuilder: () => ({
          error: 'リクエスト制限を超えました。しばらくお待ちください。',
        }),
      },
    },
  }, async (request, reply) => {
    try {
      // 1. Resolve workspace (auth check)
      const workspaceId = await resolveWorkspaceId(request);
      if (!workspaceId) {
        return reply.code(401).send({
          error: '認証が必要です。ログインしてください。',
        });
      }

      // 2. Validate request body
      const parsed = hpGenerateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: '入力が不正です',
          details: parsed.error.errors,
        });
      }

      const { business_name, template, business_info } = parsed.data;

      // 3. Check lifetime generation limit
      const generationCount = await getHpGenerationCount(workspaceId);
      if (generationCount >= HP_GENERATION_LIFETIME_LIMIT) {
        return reply.code(429).send({
          error: 'HP生成回数の上限（10回）に達しました。',
        });
      }

      // 4. Create chatbot with business info as system prompt
      const systemPrompt = buildSystemPrompt(business_name, business_info);
      const welcomeMessage = `「${business_name}」へようこそ！ご質問やご予約について、お気軽にお問い合わせください。`;

      const chatbot = await createChatbot(workspaceId, {
        name: `${business_name} AIアシスタント`,
        system_prompt: systemPrompt,
        welcome_message: welcomeMessage,
      });

      // 5. Publish the chatbot to get a publish_key
      const publishResult = await publishChatbot(chatbot.id, workspaceId);
      if (!publishResult) {
        request.log.error({ chatbotId: chatbot.id }, 'HP生成: チャットボット公開に失敗');
        return reply.code(500).send({
          error: 'HP生成中にエラーが発生しました。',
        });
      }

      // 6. Record the generation for abuse tracking
      await recordHpGeneration(workspaceId, template, business_name, chatbot.id);

      // 7. Return the publish_key
      return reply.code(201).send({
        publish_key: publishResult.publishKey,
        chatbot_id: chatbot.id,
        workspace_id: workspaceId,
      });

    } catch (err) {
      request.log.error({ err }, 'HP生成エラー');
      return reply.code(500).send({
        error: 'HP生成中にエラーが発生しました。',
      });
    }
  });
}

export default hpGenerateRoutes;
