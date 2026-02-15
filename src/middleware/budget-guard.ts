/**
 * Budget Guard Middleware
 * 予算超過時にAPIリクエストをブロックしてクラウドコストを保護
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { getBudgetConfig, getCostStats, getWorkspaceCostStats } from '../kv/client.js';
import { isValidWorkspaceId } from '../utils/sanitize.js';

/** ブロック開始する予算使用率（デフォルト: 100%） */
const BUDGET_BLOCK_THRESHOLD = parseFloat(process.env.BUDGET_BLOCK_THRESHOLD || '1.0');

/** 警告を出す予算使用率（デフォルト: 90%） */
const BUDGET_WARN_THRESHOLD = parseFloat(process.env.BUDGET_WARN_THRESHOLD || '0.9');

/** エラー時にフェイルオープンにするか（デフォルト: false = fail-closed） */
const FAIL_OPEN_ON_ERROR = process.env.BUDGET_FAIL_OPEN === 'true';

export interface BudgetCheckResult {
  allowed: boolean;
  percentage: number;
  remaining: number;
  message?: string;
}

/**
 * 予算をチェックしてリクエストを許可するか判定
 */
export async function checkBudget(workspaceId?: string): Promise<BudgetCheckResult> {
  try {
    const budgetConfig = await getBudgetConfig();

    // 予算設定がない場合は許可
    if (!budgetConfig || budgetConfig.monthlyLimit <= 0) {
      return { allowed: true, percentage: 0, remaining: Infinity };
    }

    // ワークスペースIDのバリデーション
    if (workspaceId && workspaceId !== 'default' && !isValidWorkspaceId(workspaceId)) {
      console.warn(`[BudgetGuard] 不正なワークスペースID: ${workspaceId}`);
      return {
        allowed: false,
        percentage: 0,
        remaining: 0,
        message: '不正なワークスペースIDです',
      };
    }

    const month = new Date().toISOString().slice(0, 7); // YYYY-MM

    // ワークスペース別のコストを取得（あれば）
    let costStats;
    if (workspaceId && workspaceId !== 'default') {
      costStats = await getWorkspaceCostStats(workspaceId, month);
    } else {
      costStats = await getCostStats(month);
    }

    const percentage = costStats.totalCost / budgetConfig.monthlyLimit;
    const remaining = budgetConfig.monthlyLimit - costStats.totalCost;

    // 予算超過
    if (percentage >= BUDGET_BLOCK_THRESHOLD) {
      return {
        allowed: false,
        percentage: percentage * 100,
        remaining: Math.max(0, remaining),
        message: `予算超過: ${(percentage * 100).toFixed(1)}% 使用済み（月間上限: $${budgetConfig.monthlyLimit}）`,
      };
    }

    // 警告レベル
    if (percentage >= BUDGET_WARN_THRESHOLD) {
      return {
        allowed: true,
        percentage: percentage * 100,
        remaining,
        message: `予算警告: ${(percentage * 100).toFixed(1)}% 使用済み`,
      };
    }

    return {
      allowed: true,
      percentage: percentage * 100,
      remaining,
    };
  } catch (error) {
    console.error('[BudgetGuard] 予算チェックに失敗:', error);

    if (FAIL_OPEN_ON_ERROR) {
      // 明示的にフェイルオープンが設定されている場合のみ許可
      console.warn('[BudgetGuard] BUDGET_FAIL_OPEN=true のためリクエストを許可');
      return { allowed: true, percentage: 0, remaining: Infinity };
    }

    // デフォルト: fail-closed（安全側に倒す）
    return {
      allowed: false,
      percentage: 0,
      remaining: 0,
      message: '予算チェックシステムが一時的に利用できません。安全のためリクエストをブロックしました。',
    };
  }
}

/**
 * 予算チェック対象のパスパターン
 * コスト発生するエンドポイントを網羅的にチェック
 */
const BUDGET_CHECK_PATHS = [
  '/v1/chat/completions',
  '/v1/completions',
  '/v1/embeddings',
];

/**
 * Fastify用の予算ガードミドルウェア
 */
export async function budgetGuardMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // コスト発生するエンドポイントのみチェック
  const requiresBudgetCheck = BUDGET_CHECK_PATHS.some(path => request.url.startsWith(path));
  if (!requiresBudgetCheck) {
    return;
  }

  // ワークスペースIDの取得と検証
  const workspaceId = request.workspace?.workspaceId;
  if (workspaceId && workspaceId !== 'default' && !isValidWorkspaceId(workspaceId)) {
    return reply.code(400).send({
      error: 'Bad Request',
      message: '不正なワークスペースIDです',
    });
  }

  const result = await checkBudget(workspaceId);

  if (!result.allowed) {
    return reply.code(402).send({
      error: 'Payment Required',
      message: result.message,
      budgetInfo: {
        percentageUsed: result.percentage,
        remainingBudget: result.remaining,
      },
    });
  }

  // 警告レベルの場合はヘッダーに追加
  if (result.message) {
    reply.header('X-Budget-Warning', result.message);
    reply.header('X-Budget-Percentage', result.percentage.toFixed(1));
  }
}
