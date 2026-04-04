/**
 * Admin Dashboard Routes
 * システム管理者向けの顧客管理・統計API
 *
 * 認証:
 *   1. Token-based: POST /api/admin/login でトークンを取得し、Authorization: Bearer <token> ヘッダーで認証
 *   2. Email-based (後方互換): ADMIN_EMAILS 環境変数に含まれるメールアドレスで認証
 */
import { randomUUID, timingSafeEqual, createHash } from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { listWorkspaces, getWorkspace } from '../kv/client.js';
import { getWorkspacePlan, updateWorkspacePlan } from '../plans/storage.js';
import { getUsageStats, getDailyUsageStats } from '../plans/usage.js';
import { PLANS, type PlanType, getEffectiveLimits } from '../plans/index.js';
import { getKnex } from '../storage/knex-client.js';
import { kv } from '@vercel/kv';
import { getWorkspaceKey } from '../storage/models.js';

/** In-memory store for valid admin session tokens (fallback when KV is unavailable) */
const adminTokens = new Set<string>();

/** TTL for admin tokens in KV: 24 hours (seconds) */
const ADMIN_TOKEN_TTL_SECONDS = 86400;

/** Admin token KV key prefix */
const ADMIN_TOKEN_PREFIX = 'admin_token:';

/** Check if KV is available for admin token storage */
function isAdminKVAvailable(): boolean {
  const hasUrl = !!(process.env.KV_REST_API_URL || process.env.KV_URL);
  const hasToken = !!process.env.KV_REST_API_TOKEN;
  return hasUrl && hasToken;
}

/** Workspace status derived from plan state */
type WorkspaceStatus = 'trial' | 'active' | 'expired' | 'free';

/** Member info returned by admin API */
interface WorkspaceMemberInfo {
  email: string;
  role: string;
}

/**
 * Determine workspace status from plan data
 */
function deriveWorkspaceStatus(
  planType: PlanType,
  expiresAt: string | undefined,
  subscriptionId: string | undefined,
  trialStartedAt: string | undefined
): WorkspaceStatus {
  if (planType === 'free' && !expiresAt) {
    return 'free';
  }

  if (expiresAt) {
    const expiryDate = new Date(expiresAt);
    const now = new Date();

    if (expiryDate < now) {
      return 'expired';
    }

    // Has future expiry with trialStartedAt and no subscription = trial
    if (trialStartedAt && !subscriptionId) {
      return 'trial';
    }
  }

  // Paid plan (has subscription or no expiry on non-free plan)
  if (planType !== 'free') {
    return 'active';
  }

  return 'free';
}

/**
 * Calculate remaining trial days (returns null if not a trial)
 */
function calculateTrialDaysRemaining(expiresAt: string | undefined): number | null {
  if (!expiresAt) return null;
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * システム管理者メールアドレスリストを取得
 */
function getAdminEmails(): string[] {
  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails) return [];
  return adminEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * システム管理者かどうかチェック
 */
function isSystemAdmin(email: string | undefined): boolean {
  if (!email) return false;
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) return false;
  return adminEmails.includes(email.toLowerCase());
}

/**
 * Store an admin token in KV (with in-memory fallback).
 */
async function storeAdminToken(token: string, email: string): Promise<void> {
  // Always store in memory as fallback
  adminTokens.add(token);

  if (isAdminKVAvailable()) {
    try {
      await kv.set(`${ADMIN_TOKEN_PREFIX}${token}`, { email, createdAt: new Date().toISOString() }, { ex: ADMIN_TOKEN_TTL_SECONDS });
    } catch (error) {
      // KV write failed — in-memory fallback is already set
      console.error('[AdminDashboard] Failed to store admin token in KV:', error);
    }
  }
}

/**
 * Check whether the request carries a valid admin Bearer token.
 * Checks KV first (for serverless persistence), then falls back to in-memory Set.
 */
async function isValidAdminToken(request: FastifyRequest): Promise<boolean> {
  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);

  // Check KV first (works across serverless invocations)
  if (isAdminKVAvailable()) {
    try {
      const stored = await kv.get<{ email: string; createdAt: string }>(`${ADMIN_TOKEN_PREFIX}${token}`);
      if (stored) return true;
    } catch (error) {
      // KV read failed — fall through to in-memory check
      console.error('[AdminDashboard] Failed to check admin token in KV:', error);
    }
  }

  // Fallback to in-memory (works in development / single-instance)
  return adminTokens.has(token);
}

export default async function adminDashboardRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/admin/login
   * 管理者ログイン — ADMIN_EMAIL / ADMIN_PASSWORD 環境変数と照合しトークンを発行
   *
   * Request body: { email: string, password: string }
   * Response (200): { success: true, token: string }
   * Response (401): { error: string }
   * Response (500): { error: string }
   */
  fastify.post<{
    Body: { email: string; password: string };
  }>('/api/admin/login', async (request: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
    const adminEmails = getAdminEmails();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminEmails.length === 0 || !adminPassword) {
      return reply.code(500).send({ error: '管理者設定が構成されていません' });
    }

    const { email, password } = request.body;

    const hashA = createHash('sha256').update(password).digest();
    const hashB = createHash('sha256').update(adminPassword).digest();
    const passwordMatch = timingSafeEqual(hashA, hashB);
    if (
      adminEmails.includes(email.toLowerCase()) &&
      passwordMatch
    ) {
      const token = randomUUID();
      await storeAdminToken(token, email);
      return reply.send({ success: true, token });
    }

    return reply.code(401).send({ error: 'メールアドレスまたはパスワードが正しくありません' });
  });

  /**
   * GET /api/admin/check
   * 現在のユーザーがシステム管理者かどうかチェック
   * Token-based auth (Authorization: Bearer) を優先し、従来のメールベース認証にフォールバック
   */
  fastify.get('/api/admin/check', async (request: FastifyRequest, reply: FastifyReply) => {
    if (await isValidAdminToken(request)) {
      return reply.send({ isAdmin: true });
    }
    return reply.send({ isAdmin: false });
  });

  /**
   * GET /api/admin/stats/overview
   * 全体統計（ワークスペース数、プラン分布、推定MRR）
   */
  fastify.get('/api/admin/stats/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await isValidAdminToken(request)) {
      return reply.code(403).send({ error: '管理者権限が必要です' });
    }

    try {
      const workspaceIds = await listWorkspaces();
      const db = getKnex();

      // プラン分布とMRR計算
      const planDistribution: Record<string, number> = { free: 0, pro: 0, enterprise: 0 };
      let mrr = 0;
      let totalTraces = 0;

      // 新規ワークスペース集計用
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      let newWorkspacesThisWeek = 0;
      let newWorkspacesThisMonth = 0;

      for (const wsId of workspaceIds) {
        const [workspace, plan, usage] = await Promise.all([
          getWorkspace(wsId),
          getWorkspacePlan(wsId),
          getUsageStats(wsId),
        ]);

        planDistribution[plan.planType] = (planDistribution[plan.planType] || 0) + 1;

        const planDef = PLANS[plan.planType];
        if (planDef.priceMonthly) {
          mrr += planDef.priceMonthly;
        }

        totalTraces += usage.traceCount;

        // 新規ワークスペースのカウント
        if (workspace?.created_at) {
          const createdAt = new Date(workspace.created_at);
          if (createdAt >= sevenDaysAgo) {
            newWorkspacesThisWeek++;
          }
          if (createdAt >= thirtyDaysAgo) {
            newWorkspacesThisMonth++;
          }
        }
      }

      // チャットボット統計（テーブルが存在しない場合に備えてtry/catch）
      let totalChatbots = 0;
      let publishedChatbots = 0;
      let totalSessions = 0;
      let totalMessages = 0;
      try {
        const cbRows = await db('chatbots').count('* as count').first();
        totalChatbots = Number(cbRows?.count || 0);
        const pubRows = await db('chatbots').where('is_published', true).count('* as count').first();
        publishedChatbots = Number(pubRows?.count || 0);
        const sesRows = await db('chat_sessions').count('* as count').first();
        totalSessions = Number(sesRows?.count || 0);
        const msgRows = await db('chat_messages').count('* as count').first();
        totalMessages = Number(msgRows?.count || 0);
      } catch {
        // chatbot関連テーブルが存在しない場合は0のまま
      }

      // メンバー数集計
      let totalMembers = 0;
      try {
        const memRows = await db('workspace_users').count('* as count').first();
        totalMembers = Number(memRows?.count || 0);
      } catch {
        // workspace_usersテーブルが存在しない場合は0のまま
      }

      return reply.send({
        totalWorkspaces: workspaceIds.length,
        planDistribution,
        mrr,
        totalTraces,
        totalMembers,
        newWorkspacesThisWeek,
        newWorkspacesThisMonth,
        chatbotStats: {
          totalChatbots,
          publishedChatbots,
          totalSessions,
          totalMessages,
        },
      });
    } catch (error) {
      console.error('[AdminDashboard] 統計取得失敗:', error);
      return reply.code(500).send({ error: '統計の取得に失敗しました' });
    }
  });

  /**
   * GET /api/admin/workspaces
   * ワークスペース一覧（プラン・使用量付き）
   */
  fastify.get('/api/admin/workspaces', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await isValidAdminToken(request)) {
      return reply.code(403).send({ error: '管理者権限が必要です' });
    }

    try {
      const workspaceIds = await listWorkspaces();
      const db = getKnex();
      const workspaces = [];

      for (const wsId of workspaceIds) {
        const [workspace, plan, usage] = await Promise.all([
          getWorkspace(wsId),
          getWorkspacePlan(wsId),
          getUsageStats(wsId),
        ]);

        const limits = getEffectiveLimits(plan);

        // Fetch members from DB
        let members: WorkspaceMemberInfo[] = [];
        try {
          const rows: Array<{ email: string; role: string }> = await db('workspace_users')
            .select('email', 'role')
            .where('workspace_id', wsId);
          members = rows.map(r => ({ email: r.email, role: r.role }));
        } catch {
          // workspace_users table may not exist yet — return empty
        }

        // チャットボット統計（ワークスペース単位）
        let chatbot = { count: 0, publishedCount: 0, totalSessions: 0, totalMessages: 0 };
        try {
          const cbCount = await db('chatbots').where('workspace_id', wsId).count('* as count').first();
          chatbot.count = Number(cbCount?.count || 0);
          const pubCount = await db('chatbots').where('workspace_id', wsId).where('is_published', true).count('* as count').first();
          chatbot.publishedCount = Number(pubCount?.count || 0);
          const sesCount = await db('chat_sessions').where('workspace_id', wsId).count('* as count').first();
          chatbot.totalSessions = Number(sesCount?.count || 0);
          const msgCount = await db('chat_messages').where('workspace_id', wsId).count('* as count').first();
          chatbot.totalMessages = Number(msgCount?.count || 0);
        } catch {
          // chatbot関連テーブルが存在しない場合はデフォルト値のまま
        }

        // Fetch companyName from KV workspace info
        let companyName: string | null = null;
        try {
          const wsInfo = await kv.get<Record<string, unknown>>(getWorkspaceKey(wsId, 'info'));
          if (wsInfo && typeof wsInfo.companyName === 'string') {
            companyName = wsInfo.companyName;
          }
        } catch {
          // KV not available
        }

        const status = deriveWorkspaceStatus(
          plan.planType,
          plan.expiresAt,
          plan.subscriptionId,
          plan.trialStartedAt
        );

        workspaces.push({
          id: wsId,
          name: workspace?.name || wsId,
          companyName,
          createdAt: workspace?.created_at || null,
          status,
          trialDaysRemaining: calculateTrialDaysRemaining(plan.expiresAt),
          plan: {
            type: plan.planType,
            startedAt: plan.startedAt,
            expiresAt: plan.expiresAt,
            subscriptionId: plan.subscriptionId,
          },
          usage: plan.planType === 'free'
            ? await (async () => {
                const daily = await getDailyUsageStats(wsId);
                return {
                  traceCount: daily.traceCount,
                  traceLimit: limits.dailyTraces,
                  tracePeriod: 'daily' as const,
                  tracePercentage: Math.round((daily.traceCount / limits.dailyTraces) * 100),
                  evaluationCount: usage.evaluationCount,
                  date: daily.date,
                };
              })()
            : {
                traceCount: usage.traceCount,
                traceLimit: limits.monthlyTraces === Infinity ? null : limits.monthlyTraces,
                tracePeriod: 'monthly' as const,
                tracePercentage: limits.monthlyTraces === Infinity
                  ? 0
                  : Math.round((usage.traceCount / limits.monthlyTraces) * 100),
                evaluationCount: usage.evaluationCount,
                month: usage.month,
              },
          members,
          chatbot,
        });
      }

      return reply.send({ workspaces });
    } catch (error) {
      console.error('[AdminDashboard] ワークスペース一覧取得失敗:', error);
      return reply.code(500).send({ error: 'ワークスペース一覧の取得に失敗しました' });
    }
  });

  /**
   * GET /api/admin/workspaces/:id
   * ワークスペース詳細
   */
  fastify.get<{ Params: { id: string } }>('/api/admin/workspaces/:id', async (request, reply) => {
    if (!await isValidAdminToken(request)) {
      return reply.code(403).send({ error: '管理者権限が必要です' });
    }

    const { id } = request.params;

    try {
      const [workspace, plan, usage] = await Promise.all([
        getWorkspace(id),
        getWorkspacePlan(id),
        getUsageStats(id),
      ]);

      if (!workspace) {
        return reply.code(404).send({ error: 'ワークスペースが見つかりません' });
      }

      const limits = getEffectiveLimits(plan);
      const db = getKnex();

      // チャットボット一覧（ワークスペース詳細用）
      let chatbots: Array<{ id: string; name: string; isPublished: boolean; model: string; sessionCount: number; messageCount: number }> = [];
      try {
        const cbRows: Array<{ id: string; name: string; is_published: boolean; model: string }> = await db('chatbots')
          .where('workspace_id', id)
          .select('id', 'name', 'is_published', 'model');
        for (const cb of cbRows) {
          const sesCount = await db('chat_sessions').where('chatbot_id', cb.id).count('* as count').first();
          const msgCount = await db('chat_messages').where('chatbot_id', cb.id).count('* as count').first();
          chatbots.push({
            id: cb.id,
            name: cb.name,
            isPublished: cb.is_published,
            model: cb.model,
            sessionCount: Number(sesCount?.count || 0),
            messageCount: Number(msgCount?.count || 0),
          });
        }
      } catch {
        // chatbot関連テーブルが存在しない場合は空配列のまま
      }

      // APIキー一覧
      let apiKeys: Array<{ name: string; isActive: boolean; createdAt: string; lastUsedAt: string | null }> = [];
      try {
        const keyRows: Array<{ name: string; is_active: boolean; created_at: string; last_used_at: string | null }> = await db('api_keys')
          .where('workspace_id', id)
          .select('name', 'is_active', 'created_at', 'last_used_at');
        apiKeys = keyRows.map(k => ({
          name: k.name,
          isActive: k.is_active,
          createdAt: k.created_at,
          lastUsedAt: k.last_used_at,
        }));
      } catch {
        // api_keysテーブルが存在しない場合は空配列のまま
      }

      return reply.send({
        id,
        name: workspace.name,
        createdAt: workspace.created_at,
        plan: {
          type: plan.planType,
          startedAt: plan.startedAt,
          expiresAt: plan.expiresAt,
          subscriptionId: plan.subscriptionId,
          customLimits: plan.customLimits,
        },
        limits,
        usage: plan.planType === 'free'
          ? await (async () => {
              const daily = await getDailyUsageStats(id);
              return {
                traceCount: daily.traceCount,
                traceLimit: limits.dailyTraces,
                tracePeriod: 'daily' as const,
                tracePercentage: Math.round((daily.traceCount / limits.dailyTraces) * 100),
                evaluationCount: usage.evaluationCount,
                evaluationLimit: limits.monthlyEvaluations === Infinity ? null : limits.monthlyEvaluations,
                date: daily.date,
              };
            })()
          : {
              traceCount: usage.traceCount,
              traceLimit: limits.monthlyTraces === Infinity ? null : limits.monthlyTraces,
              tracePeriod: 'monthly' as const,
              tracePercentage: limits.monthlyTraces === Infinity
                ? 0
                : Math.round((usage.traceCount / limits.monthlyTraces) * 100),
              evaluationCount: usage.evaluationCount,
              evaluationLimit: limits.monthlyEvaluations === Infinity ? null : limits.monthlyEvaluations,
              month: usage.month,
            },
        chatbots,
        apiKeys,
      });
    } catch (error) {
      console.error('[AdminDashboard] ワークスペース詳細取得失敗:', error);
      return reply.code(500).send({ error: 'ワークスペース詳細の取得に失敗しました' });
    }
  });

  /**
   * GET /api/admin/stats/registrations
   * 過去30日間の日別登録数推移
   *
   * Response (200): { registrations: Array<{ date: string, count: number }> }
   * Response (403): { error: string }
   * Response (500): { error: string }
   */
  fastify.get('/api/admin/stats/registrations', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!await isValidAdminToken(request)) {
      return reply.code(403).send({ error: '管理者権限が必要です' });
    }

    try {
      const workspaceIds = await listWorkspaces();
      const dailyCounts: Record<string, number> = {};

      // 過去30日分を0で初期化
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
        dailyCounts[key] = 0;
      }

      // ワークスペースのcreated_atで日別カウント
      for (const wsId of workspaceIds) {
        const workspace = await getWorkspace(wsId);
        if (workspace?.created_at) {
          const dateKey = new Date(workspace.created_at).toISOString().slice(0, 10);
          if (dateKey in dailyCounts) {
            dailyCounts[dateKey]++;
          }
        }
      }

      // 日付順の配列に変換
      const registrations = Object.entries(dailyCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));

      return reply.send({ registrations });
    } catch (error) {
      fastify.log.error({ err: error }, '[AdminDashboard] 登録推移取得失敗');
      return reply.code(500).send({ error: '登録推移の取得に失敗しました' });
    }
  });

  /**
   * PUT /api/admin/workspaces/:id/plan
   * プラン変更
   */
  fastify.put<{
    Params: { id: string };
    Body: {
      planType: PlanType;
      expiresAt?: string;
      subscriptionId?: string;
      customLimits?: Record<string, unknown>;
    };
  }>('/api/admin/workspaces/:id/plan', async (request, reply) => {
    if (!await isValidAdminToken(request)) {
      return reply.code(403).send({ error: '管理者権限が必要です' });
    }

    const { id } = request.params;
    const { planType, expiresAt, subscriptionId, customLimits } = request.body;

    if (!planType || !['free', 'pro', 'enterprise'].includes(planType)) {
      return reply.code(400).send({
        error: 'planType は free, pro, enterprise のいずれかを指定してください',
      });
    }

    try {
      const updated = await updateWorkspacePlan(id, planType, {
        subscriptionId,
        expiresAt,
        customLimits: customLimits as Record<string, number | boolean>,
      });

      fastify.log.info(`[AdminDashboard] プラン変更: workspace=${id}, plan=${planType}`);

      return reply.send({
        message: `プランを${planType}に変更しました`,
        plan: updated,
      });
    } catch (error) {
      console.error('[AdminDashboard] プラン変更失敗:', error);
      return reply.code(500).send({ error: 'プラン変更に失敗しました' });
    }
  });

  /**
   * PUT /api/admin/workspaces/:id/company
   * Update company name for a workspace
   *
   * Request body: { companyName: string }
   * Response: { success: true, companyName: string }
   */
  fastify.put<{
    Params: { id: string };
    Body: { companyName: string };
  }>('/api/admin/workspaces/:id/company', async (request, reply) => {
    if (!await isValidAdminToken(request)) {
      return reply.code(403).send({ error: '管理者権限が必要です' });
    }

    const { id } = request.params;
    const { companyName } = request.body;

    if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
      return reply.code(400).send({
        error: '会社名を入力してください',
      });
    }

    try {
      const workspace = await getWorkspace(id);
      if (!workspace) {
        return reply.code(404).send({ error: 'ワークスペースが見つかりません' });
      }

      // Update workspace info in KV with companyName
      const wsInfo = await kv.get<Record<string, unknown>>(getWorkspaceKey(id, 'info'));
      const updatedInfo = {
        ...wsInfo,
        companyName: companyName.trim(),
      };
      await kv.set(getWorkspaceKey(id, 'info'), updatedInfo);

      return reply.send({
        success: true,
        companyName: companyName.trim(),
      });
    } catch (error) {
      console.error('[AdminDashboard] 会社名更新失敗:', error);
      return reply.code(500).send({ error: '会社名の更新に失敗しました' });
    }
  });
}
