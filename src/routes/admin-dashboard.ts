/**
 * Admin Dashboard Routes
 * システム管理者向けの顧客管理・統計API
 *
 * 認証:
 *   1. Token-based: POST /api/admin/login でトークンを取得し、Authorization: Bearer <token> ヘッダーで認証
 *   2. Email-based (後方互換): ADMIN_EMAILS 環境変数に含まれるメールアドレスで認証
 */
import { randomUUID } from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { listWorkspaces, getWorkspace } from '../kv/client.js';
import { getWorkspacePlan, updateWorkspacePlan } from '../plans/storage.js';
import { getUsageStats } from '../plans/usage.js';
import { PLANS, type PlanType, getEffectiveLimits } from '../plans/index.js';
import { getKnex } from '../storage/knex-client.js';
import { kv } from '@vercel/kv';
import { getWorkspaceKey } from '../storage/models.js';

/** In-memory store for valid admin session tokens */
const adminTokens = new Set<string>();

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
 * Check whether the request carries a valid admin Bearer token.
 */
function isValidAdminToken(request: FastifyRequest): boolean {
  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
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
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      return reply.code(500).send({ error: '管理者設定が構成されていません' });
    }

    const { email, password } = request.body;

    if (
      email.toLowerCase() === adminEmail.toLowerCase() &&
      password === adminPassword
    ) {
      const token = randomUUID();
      adminTokens.add(token);
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
    if (isValidAdminToken(request)) {
      return reply.send({ isAdmin: true });
    }

    const userEmail = request.headers['x-user-email'] as string | undefined;

    if (!userEmail || !isSystemAdmin(userEmail)) {
      return reply.send({ isAdmin: false });
    }

    return reply.send({ isAdmin: true, email: userEmail });
  });

  /**
   * GET /api/admin/stats/overview
   * 全体統計（ワークスペース数、プラン分布、推定MRR）
   */
  fastify.get('/api/admin/stats/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    const userEmail = request.headers['x-user-email'] as string | undefined;
    if (!isValidAdminToken(request) && !isSystemAdmin(userEmail)) {
      return reply.code(403).send({ error: '管理者権限が必要です' });
    }

    try {
      const workspaceIds = await listWorkspaces();

      // プラン分布とMRR計算
      const planDistribution: Record<string, number> = { free: 0, pro: 0, enterprise: 0 };
      let mrr = 0;
      let totalTraces = 0;

      for (const wsId of workspaceIds) {
        const plan = await getWorkspacePlan(wsId);
        planDistribution[plan.planType] = (planDistribution[plan.planType] || 0) + 1;

        const planDef = PLANS[plan.planType];
        if (planDef.priceMonthly) {
          mrr += planDef.priceMonthly;
        }

        const usage = await getUsageStats(wsId);
        totalTraces += usage.traceCount;
      }

      return reply.send({
        totalWorkspaces: workspaceIds.length,
        planDistribution,
        mrr,
        totalTraces,
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
    const userEmail = request.headers['x-user-email'] as string | undefined;
    if (!isValidAdminToken(request) && !isSystemAdmin(userEmail)) {
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
          usage: {
            traceCount: usage.traceCount,
            traceLimit: limits.monthlyTraces === Infinity ? null : limits.monthlyTraces,
            tracePercentage: limits.monthlyTraces === Infinity
              ? 0
              : Math.round((usage.traceCount / limits.monthlyTraces) * 100),
            evaluationCount: usage.evaluationCount,
            month: usage.month,
          },
          members,
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
    const userEmail = request.headers['x-user-email'] as string | undefined;
    if (!isValidAdminToken(request) && !isSystemAdmin(userEmail)) {
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
        usage: {
          traceCount: usage.traceCount,
          traceLimit: limits.monthlyTraces === Infinity ? null : limits.monthlyTraces,
          tracePercentage: limits.monthlyTraces === Infinity
            ? 0
            : Math.round((usage.traceCount / limits.monthlyTraces) * 100),
          evaluationCount: usage.evaluationCount,
          evaluationLimit: limits.monthlyEvaluations === Infinity ? null : limits.monthlyEvaluations,
          month: usage.month,
        },
      });
    } catch (error) {
      console.error('[AdminDashboard] ワークスペース詳細取得失敗:', error);
      return reply.code(500).send({ error: 'ワークスペース詳細の取得に失敗しました' });
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
    const userEmail = request.headers['x-user-email'] as string | undefined;
    if (!isValidAdminToken(request) && !isSystemAdmin(userEmail)) {
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

      console.log(`[AdminDashboard] プラン変更: workspace=${id}, plan=${planType}, by=${userEmail}`);

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
    const userEmail = request.headers['x-user-email'] as string | undefined;
    if (!isValidAdminToken(request) && !isSystemAdmin(userEmail)) {
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
