/**
 * Plan Guard Middleware
 * プランのトレース数制限を強制
 * - Free: 日次30件 (JST基準)
 * - Pro/Enterprise: 月次制限
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { getWorkspacePlan, updateWorkspacePlan } from '../plans/storage.js';
import {
  getUsageStats,
  getDailyUsageStats,
  incrementTraceCount,
  incrementDailyTraceCount,
  getNextJSTMidnight,
} from '../plans/usage.js';
import { getEffectiveLimits, getPlanNameJa, getRecommendedUpgrade, PLANS } from '../plans/index.js';
import { consumeSignupCredit, getSignupCreditStatus } from '../plans/signup-credit.js';

/**
 * Estimated JPY cost debited from signup credit per Free-tier overage request.
 *
 * Rationale: Plan-guard runs BEFORE the LLM call, so exact tokens/cost are
 * unknown at this point. We reserve a conservative fixed estimate per request
 * (~¥2, roughly $0.013 at 150 JPY/USD — equivalent to a small gpt-4o-mini
 * call). The ¥10,000 grant therefore covers ~5,000 overage requests, which
 * matches Free-tier economics for the 90-day runway.
 *
 * If a future iteration moves credit consumption to post-request (enforcer
 * hook, using actual tokens via `usdToJpy(calculateCost(...))`), update this
 * constant's usage accordingly. For now the simple reserve model keeps the
 * hot path synchronous.
 */
const SIGNUP_CREDIT_RESERVE_PER_REQUEST_JPY = 2;

/**
 * プラン制限チェック対象のパス
 */
const PLAN_CHECK_PATHS = [
  '/v1/chat/completions',
  '/v1/completions',
  '/v1/embeddings',
];

/**
 * Freeプランかどうかを判定
 */
function isFreePlan(planType: string): boolean {
  return planType === 'free';
}

/**
 * プラン制限ミドルウェア
 * Free: 日次トレース数を超過している場合はリクエストをブロック
 * Pro/Enterprise: 月次トレース数を超過している場合はリクエストをブロック
 */
export async function planGuardMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // トレース発生するエンドポイントのみチェック
  const requiresCheck = PLAN_CHECK_PATHS.some(path => request.url.startsWith(path));
  if (!requiresCheck) {
    return;
  }

  const workspaceId = request.workspace?.workspaceId;
  if (!workspaceId) {
    return; // authミドルウェアが先に処理
  }

  try {
    const plan = await getWorkspacePlan(workspaceId);
    const limits = getEffectiveLimits(plan);

    // プラン期限チェック
    if (plan.expiresAt && new Date(plan.expiresAt) < new Date()) {
      if (!plan.subscriptionId) {
        // Trial expired (no Stripe subscription) — auto-downgrade to Free
        await updateWorkspacePlan(workspaceId, 'free');
        reply.header('X-Plan-Downgraded', 'true');
        // Update plan variable for subsequent limit checks
        const downgradedPlan = await getWorkspacePlan(workspaceId);
        const downgradedLimits = getEffectiveLimits(downgradedPlan);

        // Downgraded to Free — check daily limits
        const dailyUsage = await getDailyUsageStats(workspaceId);
        if (dailyUsage.traceCount >= downgradedLimits.dailyTraces) {
          // Free tier exceeded after trial downgrade — try signup credit first.
          const creditResult = await consumeSignupCredit(
            workspaceId,
            SIGNUP_CREDIT_RESERVE_PER_REQUEST_JPY
          );
          if (creditResult.consumed) {
            reply.header('X-Plan-Type', downgradedPlan.planType);
            reply.header('X-Usage-Traces-Today', dailyUsage.traceCount.toString());
            reply.header('X-Limit-Traces-Daily', downgradedLimits.dailyTraces.toString());
            reply.header('X-Signup-Credit-Remaining-Jpy', creditResult.remainingJpy.toString());
            return; // Allow the request through.
          }

          const planName = getPlanNameJa(downgradedPlan.planType);
          const resetsAt = getNextJSTMidnight();

          reply.header('X-Plan-Type', downgradedPlan.planType);
          reply.header('X-Usage-Traces-Today', dailyUsage.traceCount.toString());
          reply.header('X-Limit-Traces-Daily', downgradedLimits.dailyTraces.toString());
          reply.header('X-Signup-Credit-Remaining-Jpy', creditResult.remainingJpy.toString());

          const downgradeUpgrade = getRecommendedUpgrade(downgradedPlan.planType);
          return reply.code(429).send({
            error: 'Plan Limit Exceeded',
            message: `トライアル期間が終了し、${planName}プランに移行しました。1日のトレース上限（${downgradedLimits.dailyTraces}件）に達しています。日本時間の深夜0時にリセットされます。プランをアップグレードしてください。`,
            usage: {
              current: dailyUsage.traceCount,
              limit: downgradedLimits.dailyTraces,
              period: 'daily',
              date: dailyUsage.date,
              resetsAt,
            },
            plan: { type: downgradedPlan.planType, name: planName },
            upgrade: downgradeUpgrade
              ? {
                  recommended: downgradeUpgrade,
                  priceMonthly: PLANS[downgradeUpgrade].priceMonthly,
                }
              : undefined,
          });
        }

        // Continue with Free plan limits (don't block the request)
        return;
      }

      // Paid subscription expired — block with 402
      return reply.code(402).send({
        error: 'Payment Required',
        message: 'プランの契約期間が終了しました。更新してください。',
        plan: {
          type: plan.planType,
          name: getPlanNameJa(plan.planType),
          expiresAt: plan.expiresAt,
        },
      });
    }

    // === Free プラン: 日次制限 (atomic increment-then-check) ===
    if (isFreePlan(plan.planType)) {
      // Increment FIRST to prevent race conditions where concurrent requests
      // all read the same count and bypass the limit.
      const newCount = await incrementDailyTraceCount(workspaceId);

      if (newCount > limits.dailyTraces) {
        // Free tier exceeded — before blocking, try to consume signup credit.
        // The credit (¥10,000 granted at workspace creation, 90-day expiry) is
        // the runway between trial end and paid upgrade. `consumeSignupCredit`
        // returns `consumed:false` for expired/empty credit, which falls
        // through to the 429 below.
        const creditResult = await consumeSignupCredit(
          workspaceId,
          SIGNUP_CREDIT_RESERVE_PER_REQUEST_JPY
        );
        if (creditResult.consumed) {
          reply.header('X-Plan-Type', plan.planType);
          reply.header('X-Usage-Traces-Today', newCount.toString());
          reply.header('X-Limit-Traces-Daily', limits.dailyTraces.toString());
          reply.header('X-Signup-Credit-Remaining-Jpy', creditResult.remainingJpy.toString());
          return; // Allow the request through.
        }

        const planName = getPlanNameJa(plan.planType);
        const resetsAt = getNextJSTMidnight();
        const dailyUsage = await getDailyUsageStats(workspaceId);

        reply.header('X-Plan-Type', plan.planType);
        reply.header('X-Usage-Traces-Today', newCount.toString());
        reply.header('X-Limit-Traces-Daily', limits.dailyTraces.toString());
        reply.header('X-Signup-Credit-Remaining-Jpy', creditResult.remainingJpy.toString());

        const freeUpgrade = getRecommendedUpgrade(plan.planType);
        return reply.code(429).send({
          error: 'Plan Limit Exceeded',
          message: `${planName}プランの1日のトレース上限（${limits.dailyTraces}件）に達しました。日本時間の深夜0時にリセットされます。プランをアップグレードしてください。`,
          usage: {
            current: newCount,
            limit: limits.dailyTraces,
            period: 'daily',
            date: dailyUsage.date,
            resetsAt,
          },
          plan: {
            type: plan.planType,
            name: planName,
          },
          upgrade: freeUpgrade
            ? {
                recommended: freeUpgrade,
                priceMonthly: PLANS[freeUpgrade].priceMonthly,
              }
            : undefined,
        });
      }

      reply.header('X-Plan-Type', plan.planType);
      reply.header('X-Usage-Traces-Today', newCount.toString());
      reply.header('X-Limit-Traces-Daily', limits.dailyTraces.toString());

      // 90%到達で警告ヘッダー
      const usagePercentage = newCount / limits.dailyTraces;
      if (usagePercentage >= 0.9) {
        reply.header('X-Plan-Warning', `1日のトレース上限の${(usagePercentage * 100).toFixed(0)}%に達しています`);
      }

      return;
    }

    // === Pro/Team/Max/Enterprise プラン: 月次制限 (atomic increment-then-check) ===
    // Increment FIRST to prevent race conditions where concurrent requests
    // all read the same count and bypass the limit.
    const newCount = await incrementTraceCount(workspaceId);
    const usage = await getUsageStats(workspaceId);

    if (newCount > limits.monthlyTraces) {
      const planName = getPlanNameJa(plan.planType);

      reply.header('X-Plan-Type', plan.planType);
      reply.header('X-Usage-Traces', newCount.toString());
      reply.header('X-Limit-Traces', limits.monthlyTraces.toString());

      const monthlyUpgrade = getRecommendedUpgrade(plan.planType);
      return reply.code(429).send({
        error: 'Plan Limit Exceeded',
        message: `${planName}プランの月間トレース上限（${limits.monthlyTraces.toLocaleString()}件）に達しました。プランをアップグレードしてください。`,
        usage: {
          current: newCount,
          limit: limits.monthlyTraces,
          period: 'monthly',
          month: usage.month,
        },
        plan: {
          type: plan.planType,
          name: planName,
        },
        upgrade: monthlyUpgrade
          ? {
              recommended: monthlyUpgrade,
              priceMonthly: PLANS[monthlyUpgrade].customQuote
                ? null
                : PLANS[monthlyUpgrade].priceMonthly,
            }
          : undefined,
      });
    }

    reply.header('X-Plan-Type', plan.planType);
    reply.header('X-Usage-Traces', newCount.toString());
    reply.header('X-Limit-Traces', limits.monthlyTraces === Infinity ? 'unlimited' : limits.monthlyTraces.toString());

    // 90%到達で警告ヘッダー
    const usagePercentage = newCount / limits.monthlyTraces;
    if (usagePercentage >= 0.9 && limits.monthlyTraces !== Infinity) {
      reply.header('X-Plan-Warning', `月間トレース上限の${(usagePercentage * 100).toFixed(0)}%に達しています`);
    }
  } catch (error) {
    // プランチェック失敗時はリクエストを許可（プラン機能でサービスを止めない）
    // budget-guardとは異なり、プランは課金機能なのでfail-open
    request.log.error(error, '[PlanGuard] プラン制限チェック失敗');
  }
}
