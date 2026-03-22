/**
 * Benchmark API Routes
 *
 * 業界ベンチマーク機能のAPI。Enterprise向け。
 * ワークスペースのメトリクスと業界平均の比較データを提供する。
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getBenchmarkComparison,
  getWorkspaceIndustry,
  setWorkspaceIndustry,
  calculateWorkspaceMetrics,
} from '../benchmark/aggregator.js';
import { INDUSTRY_LABELS, type IndustryCategory } from '../benchmark/types.js';

export default async function benchmarkRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/benchmark
   * ベンチマーク比較データを取得
   */
  fastify.get('/api/benchmark', async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = (request as unknown as { workspace?: { workspaceId?: string } }).workspace?.workspaceId || 'default';
    const { period } = request.query as { period?: string };

    try {
      const comparison = await getBenchmarkComparison(workspaceId, period);

      if (!comparison) {
        return reply.code(404).send({
          error: 'ベンチマークデータなし',
          message: '業種を設定し、トレースデータが蓄積されるとベンチマークが利用できます。',
          needsIndustry: !(await getWorkspaceIndustry(workspaceId)),
        });
      }

      return {
        success: true,
        data: comparison,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'ベンチマーク取得に失敗しました',
      });
    }
  });

  /**
   * GET /api/benchmark/industry
   * 現在の業種設定を取得
   */
  fastify.get('/api/benchmark/industry', async (request: FastifyRequest) => {
    const workspaceId = (request as unknown as { workspace?: { workspaceId?: string } }).workspace?.workspaceId || 'default';
    const industry = await getWorkspaceIndustry(workspaceId);

    return {
      industry,
      label: industry ? INDUSTRY_LABELS[industry] : null,
      categories: Object.entries(INDUSTRY_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    };
  });

  /**
   * POST /api/benchmark/industry
   * 業種を設定
   */
  fastify.post('/api/benchmark/industry', async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = (request as unknown as { workspace?: { workspaceId?: string } }).workspace?.workspaceId || 'default';
    const body = request.body as { industry: string };

    if (!body.industry || !(body.industry in INDUSTRY_LABELS)) {
      return reply.code(400).send({
        error: '無効な業種カテゴリです',
        validCategories: Object.keys(INDUSTRY_LABELS),
      });
    }

    try {
      await setWorkspaceIndustry(workspaceId, body.industry as IndustryCategory);

      return {
        success: true,
        industry: body.industry,
        label: INDUSTRY_LABELS[body.industry as IndustryCategory],
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: '業種設定の保存に失敗しました',
      });
    }
  });

  /**
   * POST /api/benchmark/refresh
   * ベンチマークメトリクスを再計算（管理者向け）
   */
  fastify.post('/api/benchmark/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = (request as unknown as { workspace?: { workspaceId?: string } }).workspace?.workspaceId || 'default';
    const { period } = request.body as { period?: string };

    const targetPeriod = period || getCurrentPeriod();

    try {
      const metrics = await calculateWorkspaceMetrics(workspaceId, targetPeriod);

      if (!metrics) {
        return reply.code(404).send({
          error: '対象期間にトレースデータがありません',
        });
      }

      return {
        success: true,
        data: metrics,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        error: 'メトリクス再計算に失敗しました',
      });
    }
  });

  /**
   * GET /api/benchmark/industries
   * 業種一覧を取得（セレクトボックス用）
   */
  fastify.get('/api/benchmark/industries', async () => {
    return {
      categories: Object.entries(INDUSTRY_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    };
  });
}

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
