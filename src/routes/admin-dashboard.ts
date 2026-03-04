/**
 * Admin Dashboard Routes
 * システム管理者向けの顧客管理・統計API
 *
 * 認証: ADMIN_EMAILS 環境変数に含まれるメールアドレスのみアクセス可能
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { listWorkspaces, getWorkspace } from '../kv/client.js';
import { getWorkspacePlan, updateWorkspacePlan } from '../plans/storage.js';
import { getUsageStats } from '../plans/usage.js';
import { PLANS, type PlanType, getEffectiveLimits } from '../plans/index.js';

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

export default async function adminDashboardRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/admin/check
   * 現在のユーザーがシステム管理者かどうかチェック
   */
  fastify.get('/api/admin/check', async (request: FastifyRequest, reply: FastifyReply) => {
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
    if (!isSystemAdmin(userEmail)) {
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
    if (!isSystemAdmin(userEmail)) {
      return reply.code(403).send({ error: '管理者権限が必要です' });
    }

    try {
      const workspaceIds = await listWorkspaces();
      const workspaces = [];

      for (const wsId of workspaceIds) {
        const [workspace, plan, usage] = await Promise.all([
          getWorkspace(wsId),
          getWorkspacePlan(wsId),
          getUsageStats(wsId),
        ]);

        const limits = getEffectiveLimits(plan);

        workspaces.push({
          id: wsId,
          name: workspace?.name || wsId,
          createdAt: workspace?.created_at || null,
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
    if (!isSystemAdmin(userEmail)) {
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
    if (!isSystemAdmin(userEmail)) {
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
}
