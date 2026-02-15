import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkBudget, type BudgetCheckResult } from '../../middleware/budget-guard.js';

// KVクライアントのモック
vi.mock('../../kv/client.js', () => ({
  getBudgetConfig: vi.fn(),
  getCostStats: vi.fn(),
  getWorkspaceCostStats: vi.fn(),
}));

vi.mock('../../utils/sanitize.js', () => ({
  isValidWorkspaceId: vi.fn((id: string) => /^[a-zA-Z0-9_-]{1,64}$/.test(id)),
}));

import { getBudgetConfig, getCostStats, getWorkspaceCostStats } from '../../kv/client.js';

const mockGetBudgetConfig = vi.mocked(getBudgetConfig);
const mockGetCostStats = vi.mocked(getCostStats);
const mockGetWorkspaceCostStats = vi.mocked(getWorkspaceCostStats);

describe('Budget Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkBudget', () => {
    it('予算設定がない場合はリクエストを許可する', async () => {
      mockGetBudgetConfig.mockResolvedValue(null);

      const result = await checkBudget();
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });

    it('予算上限が0以下の場合はリクエストを許可する', async () => {
      mockGetBudgetConfig.mockResolvedValue({
        monthlyLimit: 0,
        alertThresholds: [0.5, 0.8, 0.9],
      });

      const result = await checkBudget();
      expect(result.allowed).toBe(true);
    });

    it('予算超過時にリクエストをブロックする', async () => {
      mockGetBudgetConfig.mockResolvedValue({
        monthlyLimit: 100,
        alertThresholds: [0.5, 0.8, 0.9],
      });
      mockGetCostStats.mockResolvedValue({ totalCost: 105, currentMonth: '2026-03', byProvider: {}, byModel: {} });

      const result = await checkBudget();
      expect(result.allowed).toBe(false);
      expect(result.percentage).toBeGreaterThanOrEqual(100);
      expect(result.message).toContain('予算超過');
    });

    it('予算90%以上で警告を返す', async () => {
      mockGetBudgetConfig.mockResolvedValue({
        monthlyLimit: 100,
        alertThresholds: [0.5, 0.8, 0.9],
      });
      mockGetCostStats.mockResolvedValue({ totalCost: 92, currentMonth: '2026-03', byProvider: {}, byModel: {} });

      const result = await checkBudget();
      expect(result.allowed).toBe(true);
      expect(result.message).toContain('予算警告');
    });

    it('予算内の場合はメッセージなしで許可する', async () => {
      mockGetBudgetConfig.mockResolvedValue({
        monthlyLimit: 100,
        alertThresholds: [0.5, 0.8, 0.9],
      });
      mockGetCostStats.mockResolvedValue({ totalCost: 50, currentMonth: '2026-03', byProvider: {}, byModel: {} });

      const result = await checkBudget();
      expect(result.allowed).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('ワークスペース別にコストをチェックする', async () => {
      mockGetBudgetConfig.mockResolvedValue({
        monthlyLimit: 100,
        alertThresholds: [0.5, 0.8, 0.9],
      });
      mockGetWorkspaceCostStats.mockResolvedValue({ totalCost: 30, currentMonth: '2026-03', byProvider: {}, byModel: {} });

      const result = await checkBudget('workspace-123');
      expect(result.allowed).toBe(true);
      expect(mockGetWorkspaceCostStats).toHaveBeenCalledWith('workspace-123', expect.any(String));
      expect(mockGetCostStats).not.toHaveBeenCalled();
    });

    it('defaultワークスペースはグローバルコストを使用する', async () => {
      mockGetBudgetConfig.mockResolvedValue({
        monthlyLimit: 100,
        alertThresholds: [0.5, 0.8, 0.9],
      });
      mockGetCostStats.mockResolvedValue({ totalCost: 30, currentMonth: '2026-03', byProvider: {}, byModel: {} });

      const result = await checkBudget('default');
      expect(mockGetCostStats).toHaveBeenCalled();
      expect(mockGetWorkspaceCostStats).not.toHaveBeenCalled();
    });

    it('不正なワークスペースIDを拒否する', async () => {
      const result = await checkBudget('../../etc/passwd');
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('不正なワークスペースID');
    });

    it('エラー時はデフォルトでfail-closed（ブロック）する', async () => {
      mockGetBudgetConfig.mockRejectedValue(new Error('DB connection failed'));

      const result = await checkBudget();
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('予算チェックシステムが一時的に利用できません');
    });
  });
});
