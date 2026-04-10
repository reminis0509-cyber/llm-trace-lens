import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, DollarSign, Bell, Webhook, Zap } from 'lucide-react';
import { PlanUsage } from './PlanUsage';
import { Playground } from './Playground';

interface CostData {
  stats: {
    totalCost: number;
    byProvider: Record<string, number>;
  };
  budget: {
    monthlyLimit: number;
    alertThresholds: number[];
  } | null;
  percentage: number;
}

interface SettingsProps {
  onBack?: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['BLOCK']);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [testStatus, setTestStatus] = useState('');

  // Budget state
  const [monthlyBudget, setMonthlyBudget] = useState(100);
  const [alertAt80, setAlertAt80] = useState(true);
  const [alertAt95, setAlertAt95] = useState(true);
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  // Cost data state
  const [costData, setCostData] = useState<CostData | null>(null);

  // Exchange rate state (USD to JPY)
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  useEffect(() => {
    loadWebhookConfig();
    loadBudgetConfig();
    loadCostStats();
    loadExchangeRate();
  }, []);

  const loadWebhookConfig = async () => {
    try {
      const res = await fetch('/api/webhook/config');
      const data = await res.json();
      if (data.config) {
        setWebhookUrl(data.config.url || '');
        setSelectedEvents(data.config.events || ['BLOCK']);
      }
    } catch (error) {
      console.error('Failed to load webhook config:', error);
    }
  };

  const loadBudgetConfig = async () => {
    try {
      const res = await fetch('/api/budget/config');
      const data = await res.json();
      if (data.config) {
        setMonthlyBudget(data.config.monthlyLimit || 100);
        setAlertAt80(data.config.alertThresholds?.includes(0.8) ?? true);
        setAlertAt95(data.config.alertThresholds?.includes(0.95) ?? true);
      }
    } catch (error) {
      console.error('Failed to load budget config:', error);
    }
  };

  const loadCostStats = async () => {
    try {
      const res = await fetch('/api/budget/stats');
      const data = await res.json();
      setCostData(data);
    } catch (error) {
      console.error('Failed to load cost stats:', error);
    }
  };

  const loadExchangeRate = async () => {
    try {
      const res = await fetch('/api/exchange-rate');
      const data = await res.json();
      setExchangeRate(data.rate);
    } catch (error) {
      console.error('Failed to load exchange rate:', error);
    }
  };

  const saveWebhookConfig = async () => {
    setIsSavingWebhook(true);
    try {
      const res = await fetch('/api/webhook/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, events: selectedEvents }),
      });

      if (res.ok) {
        alert('Webhook設定を保存しました！');
      } else {
        const data = await res.json();
        alert('Webhook設定の保存に失敗: ' + (data.error || '不明なエラー'));
      }
    } catch (error) {
      alert('Webhook設定の保存エラー: ' + (error as Error).message);
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const testWebhook = async () => {
    setTestStatus('送信中...');
    try {
      const res = await fetch('/api/webhook/test', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setTestStatus('テスト送信成功！');
      } else {
        setTestStatus('テスト失敗: ' + (data.error || '不明なエラー'));
      }
    } catch (error) {
      setTestStatus('エラー: ' + (error as Error).message);
    }

    setTimeout(() => setTestStatus(''), 5000);
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event)
        ? prev.filter(e => e !== event)
        : [...prev, event]
    );
  };

  const saveBudgetConfig = async () => {
    setIsSavingBudget(true);
    try {
      const thresholds: number[] = [];
      if (alertAt80) thresholds.push(0.8);
      if (alertAt95) thresholds.push(0.95);

      const res = await fetch('/api/budget/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyLimit: monthlyBudget,
          alertThresholds: thresholds,
        }),
      });

      if (res.ok) {
        alert('予算設定を保存しました！');
        loadCostStats();
      } else {
        const data = await res.json();
        alert('予算設定の保存に失敗: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('予算設定の保存に失敗: ' + (error as Error).message);
    } finally {
      setIsSavingBudget(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Plan & Usage */}
      <PlanUsage />

      {/* Cost Overview */}
      {costData && costData.stats && (
        <div className="surface-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-accent-dim flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">今月のコスト</h2>
              <p className="text-sm text-text-secondary">現在の支出と予算状況</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <span className="text-3xl font-bold font-mono text-text-primary">
                  ${costData.stats.totalCost.toFixed(2)}
                </span>
                {exchangeRate !== null && (
                  <div className="text-sm text-text-muted font-mono">
                    {`\u7D04 \u00A5${Math.round(costData.stats.totalCost * exchangeRate).toLocaleString()}`}
                  </div>
                )}
              </div>
              {costData.budget && (
                <div className="text-right">
                  <span className="text-lg text-text-secondary font-mono">
                    / ${costData.budget.monthlyLimit.toFixed(2)}
                  </span>
                  {exchangeRate !== null && (
                    <div className="text-sm text-text-muted font-mono">
                      {`/ \u7D04 \u00A5${Math.round(costData.budget.monthlyLimit * exchangeRate).toLocaleString()}`}
                    </div>
                  )}
                </div>
              )}
            </div>

            {costData.budget && (
              <div className="w-full bg-base-elevated rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    costData.percentage > 95
                      ? 'bg-status-fail'
                      : costData.percentage > 80
                        ? 'bg-status-warn'
                        : 'bg-status-pass'
                  }`}
                  style={{ width: `${Math.min(costData.percentage, 100)}%` }}
                />
              </div>
            )}

            {costData.budget && (
              <p className="mt-2 text-sm text-text-secondary">
                予算の{costData.percentage.toFixed(1)}%を使用
              </p>
            )}
          </div>

          {Object.keys(costData.stats.byProvider).length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <h4 className="text-sm font-medium text-text-secondary mb-3">プロバイダー別コスト</h4>
                <div className="space-y-2">
                  {Object.entries(costData.stats.byProvider).map(([provider, cost]) => (
                    <div key={provider} className="flex justify-between text-sm">
                      <span className="text-text-primary capitalize">{provider}</span>
                      <span className="font-mono text-text-primary">
                        ${cost.toFixed(2)}
                        {exchangeRate !== null && (
                          <span className="text-sm text-text-muted ml-2">
                            {`(\u7D04\u00A5${Math.round(cost * exchangeRate).toLocaleString()})`}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
          )}
        </div>
      )}

      {/* Budget Management */}
      <div className="surface-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent-dim flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">予算管理</h2>
            <p className="text-sm text-text-secondary">支出上限とアラートしきい値を設定</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-text-primary mb-2">
            月間予算（USD）
          </label>
          <input
            type="number"
            value={monthlyBudget}
            onChange={(e) => setMonthlyBudget(Number(e.target.value))}
            min="0"
            step="10"
            className="w-full px-4 py-2 bg-base-surface border border-border rounded-lg text-text-primary font-mono focus:ring-2 focus:ring-accent/50 focus:border-accent"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-3">
            アラートしきい値
          </label>
          <div className="space-y-3">
            <label className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={alertAt80}
                onChange={(e) => setAlertAt80(e.target.checked)}
                className="h-4 w-4 bg-base-surface border-border rounded text-accent focus:ring-accent/50"
              />
              <span className="ml-3 text-sm text-text-primary group-hover:text-text-primary">
                予算の80%でアラート
              </span>
            </label>
            <label className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={alertAt95}
                onChange={(e) => setAlertAt95(e.target.checked)}
                className="h-4 w-4 bg-base-surface border-border rounded text-accent focus:ring-accent/50"
              />
              <span className="ml-3 text-sm text-text-primary group-hover:text-text-primary">
                予算の95%でアラート
              </span>
            </label>
          </div>
        </div>

        <button
          onClick={saveBudgetConfig}
          disabled={isSavingBudget}
          className="px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-200 disabled:text-text-secondary disabled:cursor-not-allowed transition"
        >
          {isSavingBudget ? '保存中...' : '予算設定を保存'}
        </button>
      </div>

      {/* Webhook Settings */}
      <div className="surface-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-status-block/10 flex items-center justify-center">
            <Webhook className="w-5 h-5 text-status-block" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Webhook通知</h2>
            <p className="text-sm text-text-secondary">バリデーションイベントのアラートを設定</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-text-primary mb-2">
            Webhook URL
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full px-4 py-2 bg-base-surface border border-border rounded-lg text-text-primary placeholder-text-muted font-mono text-sm focus:ring-2 focus:ring-accent/50 focus:border-accent"
          />
          <p className="mt-1 text-sm text-text-muted">
            Slack、Microsoft Teams、または任意のHTTPエンドポイントに対応
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-3">
            トリガーイベント
          </label>
          <div className="space-y-3">
            {[
              { event: 'BLOCK', desc: 'ブロックされたリクエスト（PII、セキュリティ）' },
              { event: 'WARN', desc: '警告レベルの問題' },
              { event: 'COST_ALERT', desc: '予算しきい値アラート' },
            ].map(({ event, desc }) => (
              <label key={event} className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedEvents.includes(event)}
                  onChange={() => toggleEvent(event)}
                  className="h-4 w-4 bg-base-surface border-border rounded text-accent focus:ring-accent/50"
                />
                <span className="ml-3 text-sm text-text-primary group-hover:text-text-primary">
                  <span className="font-mono text-accent">{event}</span>
                  <span className="text-text-muted ml-2">- {desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={saveWebhookConfig}
            disabled={isSavingWebhook || !webhookUrl}
            className="px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-200 disabled:text-text-secondary disabled:cursor-not-allowed transition"
          >
            {isSavingWebhook ? '保存中...' : '設定を保存'}
          </button>

          <button
            onClick={testWebhook}
            disabled={!webhookUrl}
            className="px-4 py-2 border border-border text-text-primary rounded-lg font-medium hover:bg-base-elevated disabled:border-border disabled:text-text-muted disabled:cursor-not-allowed transition"
          >
            テスト送信
          </button>
        </div>

        {testStatus && (
          <div className={`mt-4 text-sm ${testStatus.includes('成功') ? 'text-status-pass' : 'text-status-fail'}`}>
            {testStatus}
          </div>
        )}
      </div>

      {/* API Connection Test */}
      <div className="surface-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent-dim flex items-center justify-center">
            <Zap className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">API接続テスト</h2>
            <p className="text-sm text-text-secondary">プロバイダーへの接続をテストします</p>
          </div>
        </div>
        <Playground onBack={() => {}} />
      </div>
    </div>
  );
}
