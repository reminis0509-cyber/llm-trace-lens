import { useState, useEffect } from 'react';

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

  useEffect(() => {
    loadWebhookConfig();
    loadBudgetConfig();
    loadCostStats();
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

  const saveWebhookConfig = async () => {
    setIsSavingWebhook(true);
    try {
      const res = await fetch('/api/webhook/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, events: selectedEvents }),
      });

      if (res.ok) {
        alert('Webhook settings saved successfully!');
      } else {
        const data = await res.json();
        alert('Failed to save webhook settings: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error saving webhook settings: ' + (error as Error).message);
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const testWebhook = async () => {
    setTestStatus('Sending...');
    try {
      const res = await fetch('/api/webhook/test', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setTestStatus('Test sent successfully!');
      } else {
        setTestStatus('Test failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      setTestStatus('Error: ' + (error as Error).message);
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
        alert('Budget settings saved!');
        loadCostStats();
      } else {
        const data = await res.json();
        alert('Failed to save budget settings: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to save budget settings: ' + (error as Error).message);
    } finally {
      setIsSavingBudget(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">Settings</span>
            <h1 className="text-xl font-bold text-gray-900">LLM Trace Lens Settings</h1>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Cost Overview */}
        {costData && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>Cost This Month</span>
            </h2>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-3xl font-bold">
                  ${costData.stats.totalCost.toFixed(2)}
                </span>
                {costData.budget && (
                  <span className="text-lg text-gray-600">
                    / ${costData.budget.monthlyLimit.toFixed(2)}
                  </span>
                )}
              </div>

              {costData.budget && (
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full transition-all ${
                      costData.percentage > 95
                        ? 'bg-red-600'
                        : costData.percentage > 80
                          ? 'bg-yellow-500'
                          : 'bg-green-600'
                    }`}
                    style={{ width: `${Math.min(costData.percentage, 100)}%` }}
                  />
                </div>
              )}

              {costData.budget && (
                <p className="mt-2 text-sm text-gray-600">
                  {costData.percentage.toFixed(1)}% of budget used
                </p>
              )}
            </div>

            {Object.keys(costData.stats.byProvider).length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Cost by Provider:</h4>
                <div className="space-y-2">
                  {Object.entries(costData.stats.byProvider).map(([provider, cost]) => (
                    <div key={provider} className="flex justify-between text-sm">
                      <span className="capitalize">{provider}</span>
                      <span className="font-medium">${cost.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Budget Management */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>Budget Management</span>
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Budget (USD)
            </label>
            <input
              type="number"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(Number(e.target.value))}
              min="0"
              step="10"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alert Thresholds
            </label>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={alertAt80}
                  onChange={(e) => setAlertAt80(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Alert at 80% of budget</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={alertAt95}
                  onChange={(e) => setAlertAt95(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Alert at 95% of budget</span>
              </label>
            </div>
          </div>

          <button
            onClick={saveBudgetConfig}
            disabled={isSavingBudget}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {isSavingBudget ? 'Saving...' : 'Save Budget Settings'}
          </button>
        </div>

        {/* Webhook Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>Webhook Notifications</span>
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook URL
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Supports Slack, Microsoft Teams, or any HTTP endpoint
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trigger Events
            </label>
            <div className="space-y-2">
              {['BLOCK', 'WARN', 'COST_ALERT'].map(event => (
                <label key={event} className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {event}
                    {event === 'BLOCK' && ' - Blocked requests (PII, security issues)'}
                    {event === 'WARN' && ' - Warning level issues'}
                    {event === 'COST_ALERT' && ' - Budget threshold alerts'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={saveWebhookConfig}
              disabled={isSavingWebhook || !webhookUrl}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {isSavingWebhook ? 'Saving...' : 'Save Settings'}
            </button>

            <button
              onClick={testWebhook}
              disabled={!webhookUrl}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              Send Test
            </button>
          </div>

          {testStatus && (
            <div className={`mt-3 text-sm ${testStatus.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
              {testStatus}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
