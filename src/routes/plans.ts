/**
 * Plan Management Routes
 * プラン情報の取得・変更・使用量確認
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PLANS, type PlanType, getPlanNameJa, getEffectiveLimits } from '../plans/index.js';
import { getWorkspacePlan, updateWorkspacePlan } from '../plans/storage.js';
import { getUsageStats, getDailyUsageStats, getUsageStatsForMonth, getNextJSTMidnight, getNextMonthStart } from '../plans/usage.js';
import { cleanupExpiredTraces } from '../plans/retention.js';
import { getKnex } from '../storage/knex-client.js';

/**
 * Resolve workspaceId from request context.
 * Priority: request.workspace (API key auth) > user email lookup (dashboard auth) > 'default'
 */
async function resolveWorkspaceId(request: FastifyRequest): Promise<string> {
  // 1. Already resolved by auth middleware (API key auth)
  if (request.workspace?.workspaceId) {
    return request.workspace.workspaceId;
  }

  // 2. Resolve from authenticated user's email (dashboard / Supabase auth)
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
      // DB lookup failed — fall through to default
    }
  }

  // 3. Fallback
  return 'default';
}

export default async function planRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/plans - 全プラン一覧を取得
   */
  fastify.get('/api/plans', async () => {
    return {
      plans: Object.values(PLANS).map(plan => ({
        type: plan.type,
        name: plan.name,
        nameJa: plan.nameJa,
        priceMonthly: plan.priceMonthly,
        limits: plan.limits,
      })),
    };
  });

  /**
   * GET /api/plan - 現在のワークスペースのプラン情報と使用量を取得
   */
  fastify.get('/api/plan', async (request: FastifyRequest) => {
    const workspaceId = await resolveWorkspaceId(request);
    const plan = await getWorkspacePlan(workspaceId);
    const limits = getEffectiveLimits(plan);

    const planInfo = {
      type: plan.planType,
      name: getPlanNameJa(plan.planType),
      startedAt: plan.startedAt,
      expiresAt: plan.expiresAt,
    };

    // Free plan: daily usage tracking
    if (plan.planType === 'free') {
      const dailyUsage = await getDailyUsageStats(workspaceId);
      const monthlyUsage = await getUsageStats(workspaceId);

      return {
        plan: planInfo,
        limits,
        usage: {
          traceCount: dailyUsage.traceCount,
          traceLimit: limits.dailyTraces,
          tracePeriod: 'daily' as const,
          tracePercentage: Math.round((dailyUsage.traceCount / limits.dailyTraces) * 100),
          date: dailyUsage.date,
          resetsAt: getNextJSTMidnight(),
          evaluationCount: monthlyUsage.evaluationCount,
          evaluationLimit: limits.monthlyEvaluations === Infinity ? null : limits.monthlyEvaluations,
          daily: {
            dailyUsage: dailyUsage.traceCount,
            dailyLimit: limits.dailyTraces,
            resetsAt: getNextJSTMidnight(),
          },
        },
      };
    }

    // Pro/Enterprise: monthly usage tracking
    const usage = await getUsageStats(workspaceId);

    return {
      plan: planInfo,
      limits,
      usage: {
        traceCount: usage.traceCount,
        traceLimit: limits.monthlyTraces === Infinity ? null : limits.monthlyTraces,
        tracePeriod: 'monthly' as const,
        tracePercentage: limits.monthlyTraces === Infinity
          ? 0
          : Math.round((usage.traceCount / limits.monthlyTraces) * 100),
        evaluationCount: usage.evaluationCount,
        evaluationLimit: limits.monthlyEvaluations === Infinity ? null : limits.monthlyEvaluations,
        month: usage.month,
        resetsAt: getNextMonthStart(),
        monthly: {
          monthlyUsage: usage.traceCount,
          monthlyLimit: limits.monthlyTraces === Infinity ? null : limits.monthlyTraces,
          resetsAt: getNextMonthStart(),
        },
      },
    };
  });

  /**
   * GET /api/plan/usage/:month - 指定月の使用量を取得
   */
  fastify.get<{ Params: { month: string } }>('/api/plan/usage/:month', async (request) => {
    const workspaceId = await resolveWorkspaceId(request);
    const { month } = request.params;

    // YYYY-MM 形式チェック
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return { error: 'Bad Request', message: '月はYYYY-MM形式で指定してください' };
    }

    const usage = await getUsageStatsForMonth(workspaceId, month);
    return { usage };
  });

  /**
   * PUT /api/plan - プランを変更（Admin APIキー必須）
   */
  fastify.put<{
    Body: {
      workspaceId: string;
      planType: PlanType;
      expiresAt?: string;
      subscriptionId?: string;
      customLimits?: Record<string, unknown>;
    };
  }>('/api/plan', async (request: FastifyRequest, reply: FastifyReply) => {
    // Admin認証チェック
    const adminKey = request.headers['x-admin-api-key'] as string;
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'プラン変更にはAdmin APIキーが必要です',
      });
    }

    const body = request.body as {
      workspaceId: string;
      planType: PlanType;
      expiresAt?: string;
      subscriptionId?: string;
      customLimits?: Record<string, unknown>;
    };

    if (!body.workspaceId || !body.planType) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'workspaceId と planType は必須です',
      });
    }

    if (!['free', 'pro', 'enterprise'].includes(body.planType)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'planType は free, pro, enterprise のいずれかを指定してください',
      });
    }

    const updated = await updateWorkspacePlan(body.workspaceId, body.planType, {
      subscriptionId: body.subscriptionId,
      expiresAt: body.expiresAt,
      customLimits: body.customLimits as Record<string, number | boolean>,
    });

    return {
      message: `プランを${getPlanNameJa(body.planType)}に変更しました`,
      plan: updated,
    };
  });

  /**
   * POST /api/plan/cleanup - データ保持期間のクリーンアップを手動実行（Admin）
   */
  fastify.post('/api/plan/cleanup', async (request: FastifyRequest, reply: FastifyReply) => {
    const adminKey = request.headers['x-admin-api-key'] as string;
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'クリーンアップにはAdmin APIキーが必要です',
      });
    }

    const workspaceId = (request.query as { workspaceId?: string }).workspaceId;
    if (!workspaceId) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'workspaceId クエリパラメータが必要です',
      });
    }

    const deleted = await cleanupExpiredTraces(workspaceId);
    return {
      message: `${deleted}件の期限切れトレースを削除しました`,
      deleted,
      workspaceId,
    };
  });
}
